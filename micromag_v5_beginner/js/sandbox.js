// Sandbox est un « mode » : aucune équation LLG ne se trouve ici.
// Le solveur est entièrement dans js/engine/film_llg.js.
const SANDBOX_MATERIALS = Object.freeze({
  // Ubermag µMAG problem 4, https://ubermag.github.io/examples/notebooks/08-tutorial-standard-problem4.html
  py: { Ms: 800, A: 13, K: 0, D: 0, alpha: 0.02, thick: 3, Lx: 500, Ly: 125, nx: 96, ny: 24, Bx: 0, By: 0, Bz: 0, demag: true, radius: 30, brush: 'none', shape: 'rectangle' },
  // Simulated Co/Pt multilayers, https://pmc.ncbi.nlm.nih.gov/articles/PMC6702348/
  cop: { Ms: 580, A: 15, K: 800, D: 3.5, alpha: 0.3, thick: 1, Lx: 192, Ly: 192, nx: 64, ny: 64, Bx: 0, By: 0, Bz: 0, demag: false, radius: 30, brush: 'sky', shape: 'rectangle' },
  // Préselection demo : K ~ Ku - mu0 Ms²/2 (Ku publié=800 kJ/m³ ; Keff≈589).
  // 600 kJ/m³ est une approximation arrondie, Bz et rayon sont des choix testés ici ;
  // ce n’est pas un jeu de constantes mesuré, ni une garantie de stabilité à long terme.
  sky: { Ms: 580, A: 15, K: 600, D: 3.5, alpha: 0.3, thick: 1, Lx: 192, Ly: 192, nx: 64, ny: 64, Bx: 0, By: 0, Bz: 20, demag: false, radius: 25, brush: 'laser', shape: 'rectangle' },
  // Option FFT non locale (film mince) : K du terme uniaxial choisi a 800 kJ/m3 ; ne suppose pas que la publication utilise une convention identique.
  skyfft: { Ms: 580, A: 15, K: 800, D: 3.5, alpha: 0.3, thick: 1, Lx: 192, Ly: 192, nx: 64, ny: 64, Bx: 0, By: 0, Bz: 20, demag: true, radius: 25, brush: 'laser', shape: 'rectangle' }
});

class SandboxSim extends FilmSimBase {
  constructor(host, d) {
    super(host, d);
    this.fv = null;
    this.warning = '';
    this.tilt = { beta: 0, gamma: 0 };
    this.timeScale = 1.8e-9;
    this.hist = newHist(2);
    this.lastInjection = null;
    this.initialQ = null;
    this.rebuild();
  }

  onParam(id) {
    if (id === 'material') {
      const preset = SANDBOX_MATERIALS[this.p.material];
      if (preset) {
        Object.keys(preset).forEach((key) => {
          this.p[key] = preset[key];
          this.host.setParamUI(key, preset[key]);
        });
      }
      this.rebuild();
      return;
    }
    if (['drawMode', 'arrows', 'brush', 'radius', 'sensorGain'].includes(id)) {
      if (id === 'sensorGain') {
        this.core.extraFieldBound = this.p.sensorGain * 1e-3 * Math.SQRT2;
        this.core.prepare();
        this.updateField();
      }
      if (id === 'brush') this.applyPhysics();
      return;
    }
    if (id !== 'Bx' && id !== 'By' && id !== 'Bz') {
      if (['Ms', 'A', 'K', 'D', 'alpha'].includes(id) && this.p.material !== 'custom') {
        this.p.material = 'custom';
        this.host.setParamUI('material', 'custom');
      }
    }
    if (['Lx', 'Ly', 'thick', 'nx', 'ny', 'shape', 'demag'].includes(id)) this.rebuild();
    else this.applyPhysics();
  }

  rebuild() {
    const p = this.p;
    const nx = Math.floor(p.nx), ny = Math.floor(p.ny);
    const dx = (p.Lx * 1e-9) / nx, dy = (p.Ly * 1e-9) / ny;
    let mask = null;
    if (p.shape === 'disk') {
      mask = new Uint8Array(nx * ny);
      const cx = p.Lx * 0.5, cy = p.Ly * 0.5;
      const radius = 0.49 * Math.min(p.Lx, p.Ly);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * p.Lx / nx - cx;
        const y = (j + 0.5) * p.Ly / ny - cy;
        mask[j * nx + i] = (x * x + y * y <= radius * radius) ? 1 : 0;
      }
    }
    this.core = new FilmCore(nx, ny, dx, { dy: dy, mask: mask, thickness: p.thick * 1e-9, demag: !!p.demag });
    this.fv = new FilmView(nx, ny);
    this.nx = nx; this.ny = ny;
    this.applyPhysics();
    this.reset();
  }

  applyPhysics() {
    const p = this.p, c = this.core;
    c.Ms = p.Ms * 1e3;
    c.A = p.A * 1e-12;
    c.Kc = p.K * 1e3;
    c.D = p.D * 1e-3;
    c.alpha.fill(p.alpha);
    c.extraFieldBound = p.sensorGain * 1e-3 * Math.SQRT2;
    this.updateField();
    c.prepare();
    const lex = Math.sqrt(2 * c.A / (MU0 * c.Ms * c.Ms));
    const dw = Math.abs(c.Kc) < 1 ? Infinity : Math.sqrt(c.A / Math.abs(c.Kc));
    this.lex = lex;
    this.dw = dw;
    const hmax = Math.max(c.dx, c.dy);
    const critical = Math.min(lex, dw);
    const msgs = [];
    if (hmax > critical) msgs.push('Maillage sous-résolu (pas > longueur caractéristique).');
    else if (hmax > 0.7 * critical) msgs.push('Maillage assez grossier : vérifie la convergence.');
    if (p.thick * 1e-9 > Math.min(p.Lx, p.Ly) * 1e-9 * 0.3) msgs.push('Approximation uniforme en z discutable pour cette épaisseur.');
    if (p.demag && c.nx * c.ny > 2500) msgs.push('Champ démagnétisant FFT : calcul coûteux sur téléphone.');
    if (!p.demag) msgs.push('Magnétostatique désactivée : K représente ici un coefficient effectif (≈ Ku − μ₀Ms²/2 en film mince uniforme), pas nécessairement Ku intrinsèque. Stabilité non quantitative.');
    if (p.D !== 0 && p.shape === 'disk') msgs.push('DMI aux bords : condition naturelle discrétisée sur un contour en escalier (disque). Test de convergence indispensable.');
    if (p.brush === 'laser') msgs.push('Laser idéalisé : graine imposée, sans chauffage ni bruit thermique.');
    this.warning = msgs.join(' ');
  }

  updateField() {
    const c = this.core, p = this.p;
    const gain = p.sensorGain * 1e-3;
    c.Bx = p.Bx * 1e-3 + gain * clamp(this.tilt.gamma / 35, -1, 1);
    c.By = p.By * 1e-3 - gain * clamp(this.tilt.beta / 35, -1, 1);
    c.Bz = p.Bz * 1e-3;
  }

  setSensorTilt(beta, gamma) {
    this.tilt.beta = Number.isFinite(beta) ? beta : 0;
    this.tilt.gamma = Number.isFinite(gamma) ? gamma : 0;
    this.updateField();
  }

  reset() {
    this.init('up');
  }

  action(id) {
    if (id === 'random' || id === 'up' || id === 'inplane' || id === 'stripes') this.init(id);
    if (id === 'seed' || id === 'laser') {
      this.init('up'); this.placeSeed(this.nx / 2, this.ny / 2, id === 'laser' ? 'laser' : 'sky');
      this.afterFrame();
    }
  }

  init(kind) {
    const c = this.core;
    c.mx.fill(0); c.my.fill(0); c.mz.fill(1);
    if (kind === 'inplane') { c.mx.fill(1); c.mz.fill(0); }
    if (kind === 'stripes') for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      c.mz[j * this.nx + i] = Math.sin(TAU * (i + 0.5) / Math.max(6, this.nx / 3)) >= 0 ? 1 : -1;
    }
    if (kind === 'random') c.randomize();
    c.normalizeAll(); c.invalidate();
    if (c.demagOn) c.updateDemag(); // diagnostic disponible dès la réinitialisation
    this.t = 0; this.hist = newHist(2);
    this.lastInjection = null; this.initialQ = null;
    this.afterFrame();
  }

  // La variante laser est un substitut phénoménologique : crée une graine
  // chirale ; aucun transport de chaleur ni fluctuation thermique n’est résolu.
  placeSeed(cx, cy, kind) {
    const c = this.core, nx = this.nx, ny = this.ny, radius = this.p.radius * 1e-9;
    const width = Math.max(Math.min(this.lex, radius / 3), Math.min(c.dx, c.dy));
    const chirality = this.p.D < 0 ? -1 : 1;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = j * nx + i;
      if (c.mask && c.mask[id] !== 1) continue;
      const x = (i + 0.5 - cx) * c.dx;
      const y = (j + 0.5 - cy) * c.dy;
      const r = Math.hypot(x, y);
      if (r > radius + 4 * width) continue;
      if (kind === 'reverse') {
        if (r < radius) { c.mx[id] *= -1; c.my[id] *= -1; c.mz[id] *= -1; }
      } else {
        const theta = 2 * Math.atan(Math.exp(clamp((radius - r) / width, -35, 35)));
        const phi = Math.atan2(y, x);
        c.mx[id] = chirality * Math.sin(theta) * Math.cos(phi);
        c.my[id] = chirality * Math.sin(theta) * Math.sin(phi);
        c.mz[id] = Math.cos(theta);
      }
    }
    c.normalizeAll(); c.invalidate();
    this.lastInjection = { t: this.t, x: cx, y: cy, mode: kind };
    this.initialQ = c.topoCharge();
  }

  tap(x, y) {
    if (this.p.brush === 'none') return;
    const layout = this.fv.lay;
    const ix = (x - layout.x0) / layout.s;
    const iy = this.ny - (y - layout.y0) / layout.s;
    if (ix < 0 || ix >= this.nx || iy < 0 || iy >= this.ny) return;
    const i = Math.floor(ix), j = Math.floor(iy);
    if (this.core.mask && this.core.mask[j * this.nx + i] !== 1) return;
    this.placeSeed(ix, iy, this.p.brush);
    this.afterFrame();
  }

  afterFrame() {
    const c = this.core, n = c.act.length;
    let mmean = 0, mxmean = 0;
    for (let q = 0; q < n; q++) { const id = c.act[q]; mmean += c.mz[id]; mxmean += c.mx[id]; }
    this.mzMean = mmean / n; this.mxMean = mxmean / n;
    this.Q = c.topoCharge();
    this.obs = { Q: this.Q, mz: this.mzMean, t: this.t };
    pushHist(this.hist, this.t, [this.Q, this.mzMean], 420);
  }

  hud() {
    const c = this.core;
    let dip = 'non calculé';
    if (c.demagOn && c.hdx && c.act.length) {
      let sum=0;
      for(let i=0;i<c.act.length;i++){const k=c.act[i];sum+=Math.hypot(c.hdx[k],c.hdy[k],c.hdz[k]);}
      dip=(sum / c.act.length * 1e3).toFixed(0) + ' mT (approx.)';
    }
    const out = [
      ['Champ dipolaire moyen', dip],
      ['Dimensions', this.p.Lx + ' × ' + this.p.Ly + ' × ' + this.p.thick + ' nm'],
      ['Maillage', this.nx + ' × ' + this.ny + ' ; ' + (c.dx * 1e9).toFixed(2) + ' × ' + (c.dy * 1e9).toFixed(2) + ' nm'],
      ['ℓex', (this.lex * 1e9).toFixed(2) + ' nm'],
      ['Δ', Number.isFinite(this.dw) ? (this.dw * 1e9).toFixed(2) + ' nm' : '— (Ku = 0)'],
      ['⟨mz⟩', this.mzMean.toFixed(3)],
      ['Charge Q (approx.)', this.Q.toFixed(2)],
      ['Magnétostatique', this.p.demag ? 'FFT mince-film (approchée, lente)' : 'Désactivée ; K effectif'],
      ['Skyrmion détecté', Math.abs(this.Q) > 0.7 ? 'Oui (critère |Q| > 0,7)' : 'Non / à vérifier'],
      ['Depuis graine', this.lastInjection ? fmtTime(this.t - this.lastInjection.t) : '—'],
      ['Temps', fmtTime(this.t)]
    ];
    if (this.warning) out.push(['Précautions', 'Voir avertissement ci-dessous', 'bad']);
    return out;
  }

  draw(ctx, W, H) {
    const c = this.core;
    this.fv.paint(c, this.p.drawMode);
    const L = this.fv.draw(ctx, W, H, 16);
    if (this.p.arrows) drawArrowsOver(ctx, c, this.fv, Math.max(2, Math.round(Math.max(this.nx, this.ny) / 24)));
    if (this.p.drawMode === 'wheel') drawWheelLegend(ctx, W - 66, 50, 22);
    const barNM = Math.min(100, this.p.Lx / 4);
    drawScaleBar(ctx, L.x0 + 12, H - 12, barNM / (c.dx * 1e9) * L.s, barNM.toFixed(0) + ' nm');
    if (this.warning) {
      ctx.fillStyle = 'rgba(15,18,29,0.85)';
      ctx.fillRect(3, H - 54, W - 6, 28);
      ctx.fillStyle = '#ffc857'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'left';
      const first = this.warning.length > 92 ? this.warning.substring(0, 89) + '…' : this.warning;
      ctx.fillText('⚠ ' + first, 10, H - 36, W - 20);
    }
  }

  drawPlots(p1, p2) {
    drawSeries(p1, this.hist, [
      { i: 0, col: '#ff4fd8', label: 'Q' },
      { i: 1, col: '#37e6ff', label: '⟨mz⟩' }
    ], 'Topologie et aimantation moyenne', null, null, '');
    const c = this.core, xs = [], ys = [], iy = Math.floor(this.ny / 2);
    for (let i = 0; i < this.nx; i++) {
      xs.push((i + .5) * c.dx * 1e9);
      ys.push(c.mz[iy * this.nx + i]);
    }
    p2.begin('Profil mz à mi-hauteur', 0, this.p.Lx, -1.1, 1.1, 'x (nm)', 'mz');
    p2.clip(); p2.line(xs, ys, '#6ab7ff', 2.4); p2.unclip();
  }
}
