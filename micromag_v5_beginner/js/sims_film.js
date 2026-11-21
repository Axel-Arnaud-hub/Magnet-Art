class WallSim extends FilmSimBase {
  constructor(host, d, pinning) {
    super(host, d);
    this.pinning = !!pinning;
    this.nx = 160;
    this.dx = 3e-9;
    this.timeScale = 2.5e-9;
    this.core = new FilmCore(this.nx, 1, this.dx, { px: false, py: true });
    this.core.Ms = 5.8e5;
    this.hist = { t: [], x: [] };
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p, c = this.core;
    c.A = p.A * 1e-12;
    c.D = p.D * 1e-3;
    c.Kc = p.K * 1e3;
    if (this.pinning) {
      // Un "soft spot" : diminution gaussienne de Ku, pas force fictive.
      const xp = p.xPin * 1e-9, sigma = Math.max(this.dx, p.sigma * 1e-9);
      c.Kmap = new Float64Array(this.nx);
      for (let i = 0; i < this.nx; i++) {
        const x = (i + 0.5) * this.dx, u = (x - xp) / sigma;
        c.Kmap[i] = c.Kc * (1 - p.depth / 100 * Math.exp(-0.5 * u * u));
      }
    } else c.Kmap = null;
    c.Bx = 0; c.By = 0; c.Bz = p.Bz * 1e-3;
    c.alpha.fill(p.alpha);
    c.prepare();
    this.wallW = Math.sqrt(c.A / c.Kc);
    this.Dc = 4 / Math.PI * Math.sqrt(c.A * c.Kc);
    if (this.pinning) this.estimateDepinning();
  }
  // Approximation quasi-statique : profil rigide m_z=-tanh((x-q)/Delta).
  // U(q)= ∫[K(x)-K0] sech²((x-q)/Delta) dx (J/m²).
  // La force de Zeeman est 2 Ms B par unité de surface de section.
  estimateDepinning() {
    const c = this.core, w = this.wallW, U = new Float64Array(this.nx);
    for (let j = 0; j < this.nx; j++) {
      const q = (j + 0.5) * this.dx;
      for (let i = 0; i < this.nx; i++) {
        const x = (i + 0.5) * this.dx, v = (x - q) / w;
        if (Math.abs(v) > 20) continue;
        const sech = 1 / Math.cosh(v);
        U[j] += (c.Kmap[i] - c.Kc) * sech * sech * this.dx;
      }
    }
    let slopeRight = 0, slopeLeft = 0;
    const sigma = Math.max(this.dx, this.p.sigma * 1e-9), xp = this.p.xPin * 1e-9;
    for (let j = 1; j < this.nx - 1; j++) {
      const q = (j + 0.5) * this.dx;
      if (Math.abs(q - xp) > 4 * sigma + 4 * w) continue;
      const dU = (U[j + 1] - U[j - 1]) / (2 * this.dx);
      slopeRight = Math.max(slopeRight, dU);
      slopeLeft = Math.min(slopeLeft, dU);
    }
    this.BdepPlus = slopeRight / (2 * c.Ms);
    this.BdepMinus = -slopeLeft / (2 * c.Ms);
  }
  onParam(id) {
    this.applyParams();
    if (this.pinning && id === 'xPin') this.reset();
    else if (this.pinning) {
      // Rafraichit sans attendre une frame : le statut 'sans défaut' doit
      // devenir immédiatement visible lors du glissement du curseur.
      if (id === 'depth') { this.pinEverContact = false; this.pinEverTrapped = false; }
      this.afterFrame();
    }
  }
  action(id) {
    if (id === 'reset') this.reset();
    if (this.pinning && id === 'capture') {
      this.setParam('Bz', 12); this.host.setParamUI('Bz', 12);
      this.reset();
    }
    if (this.pinning && id === 'release') {
      this.setParam('Bz', 110); this.host.setParamUI('Bz', 110);
    }
  }
  reset() {
    const c = this.core, w = this.wallW;
    const x0 = this.pinning ? clamp(this.p.xPin * 1e-9 - 3.5 * w, 5 * this.dx, (this.nx - 5) * this.dx) : 0.3 * this.nx * this.dx;
    for (let i = 0; i < this.nx; i++) {
      const u = ((i + 0.5) * this.dx - x0) / w;
      c.mz[i] = -Math.tanh(u);
      if (this.pinning && c.D !== 0) {
        c.mx[i] = -Math.sign(c.D) / Math.cosh(u);
        c.my[i] = 0;
      } else {
        c.my[i] = 1 / Math.cosh(u);
        c.mx[i] = 0;
      }
    }
    c.normalizeAll();
    this.t = 0;
    this.hist = { t: [], x: [] };
    this.pinEverContact = false;
    this.pinEverTrapped = false;
    this.pinPhase = 'approche';
    this.pinPhaseEvents = [{ phase: 'approche', t: 0 }];
    this.afterFrame();
  }
  wallPos() {
    const mz = this.core.mz;
    for (let i = 0; i < this.nx - 1; i++) {
      if (mz[i] > 0 && mz[i + 1] <= 0) return (i + 0.5 + mz[i] / (mz[i] - mz[i + 1])) * this.dx;
    }
    return null;
  }
  afterFrame() {
    const c = this.core, h = this.hist, xw = this.wallPos();
    this.xw = xw;
    this.phi = null;
    if (xw !== null) {
      h.t.push(this.t);
      h.x.push(xw);
      if (h.t.length > 900) { h.t.shift(); h.x.shift(); }
      const ic = clamp(Math.round(xw / this.dx - 0.5), 0, this.nx - 1);
      this.phi = Math.atan2(c.my[ic], c.mx[ic]);
    }
    let v = null;
    const n = h.t.length;
    if (n > 2) {
      let k = n - 1;
      while (k > 0 && h.t[n - 1] - h.t[k] < 0.3e-9) k--;
      if (h.t[n - 1] - h.t[k] > 0.05e-9) v = (h.x[n - 1] - h.x[k]) / (h.t[n - 1] - h.t[k]);
    }
    if (xw === null) v = null;
    this.v = v;
    let type = '—';
    if (this.phi !== null) {
      const cc = Math.abs(Math.cos(this.phi)), ss = Math.abs(Math.sin(this.phi));
      type = cc > 0.85 ? 'Néel' : (ss > 0.85 ? 'Bloch' : 'intermédiaire');
    }
    this.type = type;
    this.pinStatus = '';
    if (this.pinning) {
      // Le défaut est fixe ; la classification dépend de la trajectoire mesurée.
      // Il s'agit de marqueurs VISUELS heuristiques, pas d'un critère de stabilité.
      const xp = this.p.xPin * 1e-9;
      const band = Math.max(this.p.sigma * 1e-9, 1.8 * this.wallW);
      const near = xw !== null && Math.abs(xw - xp) <= band;
      let phase;
      if (this.p.depth <= 0) phase = 'sans défaut';
      else if (xw === null) phase = this.pinEverTrapped ? 'libérée' : 'sortie';
      else if (near) {
        this.pinEverContact = true;
        // Une immobilité temporaire ne démontre pas un état épinglé asymptotique.
        if (this.pinEverTrapped && v !== null && Math.abs(v) > 15) phase = 'dépiégeage';
        else if (this.t >= 0.35e-9 && v !== null && Math.abs(v) < 5) {
          this.pinEverTrapped = true;
          phase = 'piégée';
        } else phase = this.pinEverTrapped ? 'piégée' : 'accrochage';
      } else if (this.pinEverTrapped) phase = 'libérée';
      else if (this.pinEverContact && xw > xp + band) phase = 'franchissement';
      else phase = 'approche';
      if (phase !== this.pinPhase) {
        this.pinPhaseEvents.push({ phase: phase, t: this.t });
        if (this.pinPhaseEvents.length > 24) this.pinPhaseEvents.shift();
        this.pinPhase = phase;
      }
      this.pinStatus = ({
        'approche':'approche du défaut', 'accrochage':'interaction / accrochage',
        'piégée':'immobile près du défaut (piégeage apparent)',
        'dépiégeage':'paroi en cours de dépiégeage',
        'libérée':'paroi libérée du défaut', 'franchissement':'défaut franchi sans arrêt établi',
        'sortie':'paroi sortie du film', 'sans défaut':'pas de défaut (ΔK = 0)'
      })[phase];
    }
    this.obs = { v: v, type: type, wallW: this.wallW, D: this.p.D,
      pinStatus: this.pinStatus, xw: xw,
      depEstimate: this.pinning ? this.BdepPlus : null };
  }
  hud() {
    const out = [
      ['Position de la paroi', this.xw === null ? 'sortie' : (this.xw * 1e9).toFixed(0) + ' nm'],
      ['Vitesse', this.v === null ? '—' : this.v.toFixed(0) + ' m/s', 'hot'],
      ['Type de paroi', this.type + (this.phi === null ? '' : ' (' + (this.phi / DEG).toFixed(0) + '°)'), this.type === 'Néel' ? 'good' : ''],
      ['Largeur Δ = √(A/K)', (this.wallW * 1e9).toFixed(1) + ' nm'],
      ['D / D_c', (this.p.D * 1e-3 / this.Dc).toFixed(2), this.p.D * 1e-3 > this.Dc ? 'bad' : '']
    ];
    if (this.pinning) {
      out.push(['Défaut xₚ', this.p.xPin.toFixed(0) + ' nm']);
      out.push(['Étape observée', this.pinStatus]);
      out.push(['Interprétation', this.pinEverTrapped ? 'une phase immobile a été détectée' : 'pas encore de piégeage établi']);
      out.push(['B dép. estimé (+z)', (this.BdepPlus * 1e3).toFixed(1) + ' mT', 'hot']);
      out.push(['Modèle', '1D, T = 0 K, sans champ démagnétisant']);
    }
    if (this.p.D * 1e-3 > this.Dc) out.push(['Alerte', 'D > D_c : la paroi devient instable', 'bad']);
    if (this.wallW < 1.2 * this.dx) out.push(['Alerte', 'paroi trop fine pour la grille', 'bad']);
    return out;
  }
  draw(ctx, W, H) {
    const c = this.core, nx = this.nx, pad = 22, w = W - 2 * pad, cw = w / nx;
    const yR = H * 0.13, hR = H * 0.17;
    // Un petit repère sous la bande indique x_p, sans bande orange au travers
    // des domaines. L'orange sur les spins ne s'affiche que là où la PAROI
    // chevauche le défaut magnétique (Ku diminué et |mz|<1).
    if (this.pinning && this.p.depth > 0) {
      const center = pad + this.p.xPin / (nx * this.dx * 1e9) * w;
      ctx.fillStyle = '#ffb774';
      ctx.beginPath();
      ctx.moveTo(center - 4, yR + hR + 3);
      ctx.lineTo(center + 4, yR + hR + 3);
      ctx.lineTo(center, yR + hR + 10);
      ctx.closePath(); ctx.fill();
      ctx.textAlign = 'center'; ctx.font = '11px system-ui';
      ctx.fillText('K↓', center, yR + hR + 23);
    }
    for (let i = 0; i < nx; i++) {
      const col = hsl2rgb(Math.atan2(c.my[i], c.mx[i]) / TAU, 1, clamp(0.5 + 0.5 * c.mz[i], 0.04, 0.96));
      ctx.fillStyle = rgbStr(col);
      ctx.fillRect(pad + i * cw, yR, cw + 0.8, hR);
      if (this.pinning && this.p.depth > 0) {
        const overlap = (1 - c.mz[i] * c.mz[i]) * Math.max(0, 1 - c.Kmap[i] / c.Kc);
        if (overlap > 0.014) {
          ctx.fillStyle = 'rgba(255,163,67,' + Math.min(.96, .18 + overlap * 1.9).toFixed(3) + ')';
          ctx.fillRect(pad + i * cw, yR + 1, cw + 0.85, hR - 2);
        }
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, yR, w, hR);
    ctx.fillStyle = 'rgba(200,215,255,0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('vue de dessus : couleur = direction dans le plan, blanc = ↑, noir = ↓', pad, yR - 8);
    const cy = H * 0.66, st = 4, L = cw * st * 0.46;
    ctx.fillStyle = 'rgba(200,215,255,0.85)';
    ctx.fillText('vue de profil : chaque flèche est un spin (couleur = composante y)', pad, cy - H * 0.2);
    ctx.lineWidth = 2.2;
    for (let i = 2; i < nx; i += st) {
      const cx = pad + (i + 0.5) * cw, ax = c.mx[i] * L, ay = -c.mz[i] * L;
      const col = this.pinning && Math.abs(c.my[i]) < 0.12 ? '#9db7d9' : rgbStr(divRGB(c.my[i]));
      const overlap = this.pinning && this.p.depth > 0 ?
        (1 - c.mz[i] * c.mz[i]) * Math.max(0, 1 - c.Kmap[i] / c.Kc) : 0;
      if (overlap > .025) {
        ctx.fillStyle = 'rgba(255,177,78,' + Math.min(.94, .22 + 1.6 * overlap).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(cx, cy, 3.8 + 4 * Math.sqrt(overlap), 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = col; ctx.fillStyle = col;
      const len = Math.sqrt(ax * ax + ay * ay);
      if (len < 0.25 * L) {
        ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, TAU); ctx.fill();
        continue;
      }
      const ux = ax / len, uy = ay / len;
      ctx.beginPath(); ctx.moveTo(cx - ax, cy - ay); ctx.lineTo(cx + ax, cy + ay); ctx.stroke();
      const hx = cx + ax, hy = cy + ay, hs = 5;
      ctx.beginPath();
      ctx.moveTo(hx + ux * hs, hy + uy * hs);
      ctx.lineTo(hx - ux * hs + uy * hs * 0.7, hy - uy * hs - ux * hs * 0.7);
      ctx.lineTo(hx - ux * hs - uy * hs * 0.7, hy - uy * hs + ux * hs * 0.7);
      ctx.closePath(); ctx.fill();
    }
    if (this.xw !== null) {
      const X = pad + this.xw / (nx * this.dx) * w, wl = this.wallW / (nx * this.dx) * w;
      ctx.strokeStyle = 'rgba(255,200,87,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(X, yR + hR + 6); ctx.lineTo(X, cy + H * 0.2); ctx.stroke();
      ctx.setLineDash([]);
      const by = cy + H * 0.2;
      ctx.beginPath();
      ctx.moveTo(X - wl, by - 5); ctx.lineTo(X - wl, by + 5);
      ctx.moveTo(X - wl, by); ctx.lineTo(X + wl, by);
      ctx.moveTo(X + wl, by - 5); ctx.lineTo(X + wl, by + 5);
      ctx.stroke();
      ctx.fillStyle = '#ffc857';
      ctx.textAlign = 'center';
      ctx.fillText('Δ = ' + (this.wallW * 1e9).toFixed(1) + ' nm', X, this.pinning ? by - 10 : by + 18);
    }
    if (this.pinning) {
      const steps = [
        ['Approche', 'approche'], ['Accrochage', 'accrochage'],
        ['Piégeage', 'piégée'], ['Libération', 'libérée']
      ];
      const active = this.pinPhase === 'approche' ? 0 :
        this.pinPhase === 'accrochage' ? 1 :
        (this.pinPhase === 'piégée' ? 2 : 3);
      const activeColor = ['#69baff', '#ffa85c', '#ffc857', '#8affd0'];
      const completed = [
        this.pinPhaseEvents.some(e => e.phase === 'approche'),
        this.pinPhaseEvents.some(e => e.phase === 'accrochage'),
        this.pinPhaseEvents.some(e => e.phase === 'piégée'),
        this.pinPhaseEvents.some(e => e.phase === 'libérée' || e.phase === 'dépiégeage')
      ];
      const gap = 5, sw = (w - 3 * gap) / 4, top = H * 0.902;
      for (let k = 0; k < 4; k++) {
        const x = pad + k * (sw + gap);
        ctx.fillStyle = k === active ? activeColor[k] : (completed[k] ? 'rgba(170,205,240,0.57)' : 'rgba(132,154,188,0.18)');
        ctx.fillRect(x, top, sw, 3);
        ctx.fillStyle = k === active ? activeColor[k] : 'rgba(200,210,228,0.68)';
        ctx.textAlign = 'center'; ctx.font = (k === active ? '600 ' : '') + '10px system-ui';
        ctx.fillText(steps[k][0], x + sw / 2, top + 15, sw);
      }
      // Le franchissement sans arrêt n'est pas étiqueté comme dépiégeage.
      if (this.pinPhase === 'franchissement' || this.pinPhase === 'sans défaut') {
        ctx.textAlign = 'right'; ctx.font = '10px system-ui'; ctx.fillStyle = '#ffb774';
        ctx.fillText(this.pinPhase === 'sans défaut' ? 'Sans défaut' : 'Franchissement direct', W - pad, top - 6);
      }
    }
    ctx.fillStyle = 'rgba(55,230,255,0.9)';
    ctx.textAlign = 'left';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('domaine ↑', pad + 6, H - 4);
    ctx.fillStyle = 'rgba(255,79,216,0.9)';
    ctx.textAlign = 'right';
    ctx.fillText('domaine ↓', W - pad - 6, H - 4);
    if (!this.pinning) drawScaleBar(ctx, W / 2 - cw * 16.7, H - 18, cw * 33.3, '100 nm');
  }
  drawPlots(p1, p2) {
    const c = this.core, xs = [], a = [], b = [], d = [];
    for (let i = 0; i < this.nx; i++) {
      xs.push((i + 0.5) * this.dx * 1e9);
      a.push(c.mx[i]); b.push(c.my[i]); d.push(c.mz[i]);
    }
    p1.begin(this.pinning ? 'Paroi + anisotropie K/K₀' : 'Profil de la paroi', 0, this.nx * this.dx * 1e9, -1.1, 1.1, 'x (nm)', this.pinning ? 'm ; K/K₀' : 'm');
    p1.clip();
    p1.line(xs, a, '#ff7a7a', 2);
    p1.line(xs, b, '#7affb0', 2);
    p1.line(xs, d, '#6ab7ff', 2);
    if (this.pinning) p1.line(xs, Array.from(c.Kmap, k => k/c.Kc), '#ffb774', 2);
    p1.unclip();
    const legend = [{ col: '#ff7a7a', label: 'mx' }, { col: '#7affb0', label: 'my' }, { col: '#6ab7ff', label: 'mz' }];
    if (this.pinning) legend.push({ col: '#ffb774', label: 'K/K₀' });
    p1.legend(legend);
    const h = this.hist, tn = h.t.map(function (v) { return v * 1e9; }), xn = h.x.map(function (v) { return v * 1e9; });
    const x0 = tn.length ? tn[0] : 0, x1 = tn.length > 1 ? tn[tn.length - 1] : x0 + 1;
    p2.begin('Position de la paroi au cours du temps', x0, x1, 0, this.nx * this.dx * 1e9, 't (ns)', 'x (nm)');
    p2.clip();
    if (this.pinning) p2.line([x0, x1], [this.p.xPin, this.p.xPin], '#ffb774', 1.4);
    p2.line(tn, xn, '#ffc857', 2.4);
    p2.unclip();
  }
}

class VortexSim extends FilmSimBase {
  constructor(host, d) {
    super(host, d);
    this.nx = 32;
    this.dx = 5e-9;
    this.timeScale = 6e-10;
    this.fv = new FilmView(this.nx, this.nx);
    this.mode = 'vortex';
    this.pulse = null;
    this.build();
  }
  build() {
    const nx = this.nx, mask = new Uint8Array(nx * nx), Rc = this.p.diam * 0.5e-9 / this.dx;
    for (let j = 0; j < nx; j++) {
      for (let i = 0; i < nx; i++) {
        const a = i + 0.5 - nx / 2, b = j + 0.5 - nx / 2;
        mask[j * nx + i] = a * a + b * b <= Rc * Rc ? 1 : 0;
      }
    }
    this.Rc = Rc;
    const c = new FilmCore(nx, nx, this.dx, { mask: mask, demag: true, thickness: this.p.thick * 1e-9 });
    c.Ms = 8e5;
    c.A = 1.3e-11;
    this.core = c;
    this.applyParams();
    this.init(this.mode);
  }
  applyParams() {
    const c = this.core, p = this.p;
    this.baseBx = p.Bx * 1e-3;
    this.baseBy = p.By * 1e-3;
    c.Bx = this.baseBx; c.By = this.baseBy; c.Bz = 0;
    c.alpha.fill(p.alpha);
    c.prepare();
  }
  onParam(id) {
    if (id === 'diam' || id === 'thick') this.build();
    else this.applyParams();
  }
  action(id) {
    if (id === 'pulse') this.pulse = { t0: this.t, dur: 120e-12 };
    else if (id === 'random') this.init('random');
    else if (id === 'uniform') this.init('uniform');
    else if (id === 'vortex') this.init('vortex');
  }
  init(mode) {
    this.mode = mode;
    const c = this.core, nx = this.nx, dx = this.dx;
    c.mx.fill(0); c.my.fill(0); c.mz.fill(0);
    if (mode === 'random') {
      c.randomize();
    } else {
      for (let j = 0; j < nx; j++) {
        for (let i = 0; i < nx; i++) {
          const id = j * nx + i;
          if (c.mask[id] !== 1) continue;
          if (mode === 'uniform') { c.mx[id] = 1; continue; }
          const x = (i + 0.5 - nx / 2 - 3) * dx, y = (j + 0.5 - nx / 2) * dx, r = Math.sqrt(x * x + y * y);
          const pz = Math.exp(-r * r / 128e-18), inpl = Math.sqrt(Math.max(0, 1 - pz * pz));
          if (r < 1e-12) c.mz[id] = 1;
          else { c.mx[id] = -y / r * inpl; c.my[id] = x / r * inpl; c.mz[id] = pz; }
        }
      }
    }
    c.normalizeAll();
    c.invalidate();
    this.t = 0;
    this.trail = [];
    this.ah = [];
    this.angU = 0;
    this.prevAng = null;
    this.fG = null;
    this.pulse = null;
    this.measure();
    this.obs = { mode: this.mode, circAbs: Math.abs(this.circ), coreR: this.coreR, fG: null, t: 0 };
  }
  reset() { this.init(this.mode); }
  beforeFrame() {
    const c = this.core, pl = this.pulse;
    if (pl && this.t < pl.t0 + pl.dur) c.Bx = this.baseBx + 0.1;
    else { c.Bx = this.baseBx; this.pulse = null; }
  }
  measure() {
    const c = this.core, nx = this.nx, dx = this.dx, act = c.act;
    let best = act[0], bv = 0;
    for (let q = 0; q < act.length; q++) {
      const id = act[q], v = Math.abs(c.mz[id]);
      if (v > bv) { bv = v; best = id; }
    }
    const pol = c.mz[best] >= 0 ? 1 : -1;
    let sx = 0, sy = 0, sw = 0, circ = 0, norm = 0;
    for (let q = 0; q < act.length; q++) {
      const id = act[q], i = id % nx, j = (id - i) / nx;
      const w = pol * c.mz[id] - 0.3;
      if (w > 0) { sx += w * (i + 0.5); sy += w * (j + 0.5); sw += w; }
      const rx = i + 0.5 - nx / 2, ry = j + 0.5 - nx / 2;
      circ += rx * c.my[id] - ry * c.mx[id];
      norm += Math.sqrt(rx * rx + ry * ry) * Math.sqrt(c.mx[id] * c.mx[id] + c.my[id] * c.my[id]);
    }
    const bi = best % nx, bj = Math.floor(best / nx);
    const cx = sw > 0 ? sx / sw : bi + 0.5, cy = sw > 0 ? sy / sw : bj + 0.5;
    this.circ = norm > 1e-9 ? circ / norm : 0;
    this.mzmax = bv;
    // Un maximum de |mz| dans une texture uniforme / aléatoire ne constitue
    // pas à lui seul un coeur de vortex. Ne pas conserver de faux marqueur.
    this.coreValid = Math.abs(this.circ) > 0.45 && bv > 0.35 && sw > 0.5;
    if (!this.coreValid) {
      this.coreX = null; this.coreY = null; this.coreR = null;
      this.pol = null; this.fG = null;
      this.trail = []; this.ah = [];
      this.prevAng = null; this.angU = 0;
      return;
    }
    this.coreX = (cx - nx / 2) * dx * 1e9;
    this.coreY = (cy - nx / 2) * dx * 1e9;
    this.coreR = Math.sqrt(this.coreX * this.coreX + this.coreY * this.coreY);
    this.pol = pol;
    this.trail.push([cx, cy]);
    if (this.trail.length > 420) this.trail.shift();
    const ang = Math.atan2(this.coreY, this.coreX);
    if (this.prevAng !== null) this.angU += wrapPi(ang - this.prevAng);
    this.prevAng = ang;
    this.ah.push({ t: this.t, a: this.angU, r: this.coreR });
    if (this.ah.length > 400) this.ah.shift();
    const last = this.ah[this.ah.length - 1];
    let k = this.ah.length - 1;
    while (k > 0 && last.t - this.ah[k].t < 0.6e-9) k--;
    const dt = last.t - this.ah[k].t;
    this.fG = (dt > 0.15e-9 && last.r > 3) ? Math.abs(last.a - this.ah[k].a) / (TAU * dt) / 1e9 : null;
  }
  afterFrame() {
    this.measure();
    this.obs = { mode: this.mode, circAbs: Math.abs(this.circ), coreR: this.coreR, fG: this.fG, t: this.t };
  }
  hud() {
    const circTxt = Math.abs(this.circ) < 0.3 ? 'pas de vortex' : (this.circ > 0 ? 'anti-horaire ↺' : 'horaire ↻');
    return [
      ['Circulation', circTxt, Math.abs(this.circ) > 0.6 ? 'good' : ''],
      ['Polarité du cœur', !this.coreValid ? '—' : (this.pol > 0 ? '↑ (blanc)' : '↓ (noir)')],
      ['Cœur à', !this.coreValid ? 'absent' : this.coreR.toFixed(0) + ' nm du centre', 'hot'],
      ['Fréquence gyrotropique', this.fG === null ? '—' : this.fG.toFixed(2) + ' GHz'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  draw(ctx, W, H) {
    this.fv.paint(this.core, this.p.disp === 'mz' ? 'mz' : 'wheel');
    const L = this.fv.draw(ctx, W, H, 22);
    const nx = this.nx, s = L.s;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(L.x0 + nx / 2 * s, L.y0 + nx / 2 * s, this.Rc * s, 0, TAU);
    ctx.stroke();
    if (this.p.arrows) drawArrowsOver(ctx, this.core, this.fv, 2);
    const tr = this.trail;
    ctx.lineWidth = 2.4;
    for (let i = 1; i < tr.length; i++) {
      const a = this.fv.px(tr[i - 1][0], tr[i - 1][1]), b = this.fv.px(tr[i][0], tr[i][1]);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 * i / tr.length).toFixed(2) + ')';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    if (this.coreValid && tr.length) {
      const q = this.fv.px(tr[tr.length - 1][0], tr[tr.length - 1][1]);
      ctx.strokeStyle = '#ffc857';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, TAU); ctx.stroke();
    }
    drawWheelLegend(ctx, 46, 54, 24);
    drawScaleBar(ctx, W - 110, H - 16, 50e-9 / this.dx * s, '50 nm');
  }
  drawPlots(p1, p2) {
    const tr = this.trail, xs = [], ys = [];
    for (let i = 0; i < tr.length; i++) {
      xs.push((tr[i][0] - this.nx / 2) * this.dx * 1e9);
      ys.push((tr[i][1] - this.nx / 2) * this.dx * 1e9);
    }
    const R = this.p.diam / 2;
    p2.begin('Trajectoire du cœur (nm)', -R, R, -R, R, 'x (nm)', 'y (nm)');
    p2.clip();
    p2.line(xs, ys, '#ffc857', 2);
    p2.unclip();
    const c = p2.ctx;
    c.strokeStyle = 'rgba(255,255,255,0.3)';
    c.beginPath();
    c.arc(p2.X(0), p2.Y(0), Math.min(p2.pw / 2, p2.ph / 2), 0, TAU);
    c.stroke();
    const a = this.ah, tn = [], rv = [];
    for (let i = 0; i < a.length; i++) { tn.push(a[i].t * 1e9); rv.push(a[i].r); }
    const x0 = tn.length ? tn[0] : 0, x1 = tn.length > 1 ? tn[tn.length - 1] : x0 + 1;
    p1.begin('Distance du cœur au centre', x0, x1, 0, Math.max(10, R), 't (ns)', 'r (nm)');
    p1.clip();
    p1.line(tn, rv, '#37e6ff', 2.2);
    p1.unclip();
  }
}

class SkyrmionSim extends FilmSimBase {
  constructor(host, d, mode) {
    super(host, d);
    this.mode = mode;
    this.nx = 40;
    this.ny = 40;
    this.dx = 6e-9;
    this.timeScale = 2e-9;
    this.core = new FilmCore(40, 40, 6e-9, { px: true, py: true });
    this.core.Ms = 5.8e5;
    this.core.A = 1.5e-11;
    this.fv = new FilmView(40, 40);
    this.hist = newHist(2);
    this.sp = { t: [], x: [], y: [] };
    this.vh = newHist(1);
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const c = this.core, p = this.p;
    if (this.mode === 'static') {
      c.D = p.D * 1e-3; c.Kc = p.K * 1e3; c.Bz = p.Bz * 1e-3;
      c.ux = 0; c.uy = 0; c.beta = 0;
    } else {
      c.D = 3.5e-3; c.Kc = 6e5; c.Bz = 0;
      c.ux = p.u * Math.cos(p.dir * DEG);
      c.uy = p.u * Math.sin(p.dir * DEG);
      c.beta = p.ratio * p.alpha;
    }
    c.alpha.fill(p.alpha);
    c.prepare();
    this.Dc = 4 / Math.PI * Math.sqrt(c.A * c.Kc);
  }
  onParam() { this.applyParams(); }
  action(id) {
    if (id === 'seed' || id === 'reset') this.init('seed');
    else if (id === 'random') this.init('random');
    else if (id === 'uniform') this.init('uniform');
    else if (id === 'clear') { this.sp = { t: [], x: [], y: [] }; this.trail = []; this.pos = null; this.lost = true; }
  }
  reset() { this.init('seed'); }
  init(kind) {
    const c = this.core, nx = this.nx, dx = this.dx;
    c.mx.fill(0); c.my.fill(0); c.mz.fill(1);
    if (kind === 'random') {
      c.randomize();
    } else if (kind === 'seed') {
      const s = c.D < 0 ? -1 : 1, cx = nx * dx * 0.5, cy = cx, R = 16e-9, w = 7e-9;
      for (let j = 0; j < nx; j++) {
        for (let i = 0; i < nx; i++) {
          const x = (i + 0.5) * dx - cx, y = (j + 0.5) * dx - cy, r = Math.sqrt(x * x + y * y);
          const th = 2 * Math.atan2(Math.sinh(R / w), Math.sinh(r / w));
          const ph = Math.atan2(y, x), sn = Math.sin(th), id = j * nx + i;
          c.mx[id] = s * sn * Math.cos(ph);
          c.my[id] = s * sn * Math.sin(ph);
          c.mz[id] = Math.cos(th);
        }
      }
    }
    c.normalizeAll();
    c.invalidate();
    this.t = 0;
    this.hist = newHist(2);
    this.vh = newHist(1);
    this.trail = [];
    this.pos = null;
    this.lost = false;
    this.sp = { t: [], x: [], y: [] };
    this.afterFrame();
  }
  track() {
    const c = this.core, nx = this.nx, ny = this.ny, mz = c.mz;
    // La position n'est valide que si un coeur inversé et une charge topologique
    // significative subsistent. Un minimum local uniforme ne suffit pas.
    let best = -1, bv = 1;
    for (let i = 0; i < c.n; i++) {
      if (mz[i] < bv) { bv = mz[i]; best = i; }
    }
    if (best < 0 || bv > -0.35 || Math.abs(this.Q) < 0.45) {
      this.lost = true;
      this.pos = null;
      this.trail = [];
      this.sp = { t: [], x: [], y: [] };
      return;
    }
    if (!this.pos) {
      this.pos = { x: (best % nx) + 0.5, y: Math.floor(best / nx) + 0.5 };
    }
    let sx = 0, sy = 0, sw = 0;
    const px = this.pos.x, py = this.pos.y;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const w = -mz[j * nx + i];
        if (w <= 0.2) continue;
        let ddx = i + 0.5 - px, ddy = j + 0.5 - py;
        ddx -= nx * Math.round(ddx / nx);
        ddy -= ny * Math.round(ddy / ny);
        if (ddx * ddx + ddy * ddy > 144) continue;
        sx += w * ddx; sy += w * ddy; sw += w;
      }
    }
    if (sw > 0.5) {
      this.pos.x += sx / sw;
      this.pos.y += sy / sw;
      this.lost = false;
    } else {
      this.lost = true;
      this.pos = null;
      this.trail = [];
      this.sp = { t: [], x: [], y: [] };
    }
  }
  afterFrame() {
    const c = this.core, Q = c.topoCharge();
    let mzs = 0, neg = 0;
    for (let i = 0; i < c.n; i++) { mzs += c.mz[i]; if (c.mz[i] < 0) neg++; }
    this.Q = Q;
    this.mzMean = mzs / c.n;
    this.frac = neg / c.n;
    this.v = null;
    this.hall = null;
    if (this.mode === 'current') {
      this.track();
      if (!this.lost) {
        const X = this.pos.x * this.dx * 1e9, Y = this.pos.y * this.dx * 1e9;
        const sp = this.sp;
        sp.t.push(this.t); sp.x.push(X); sp.y.push(Y);
        if (sp.t.length > 1500) { sp.t.shift(); sp.x.shift(); sp.y.shift(); }
        this.trail.push([this.pos.x, this.pos.y]);
        if (this.trail.length > 1500) this.trail.shift();
        const n = sp.t.length;
        if (n > 2) {
          let k = n - 1;
          while (k > 0 && sp.t[n - 1] - sp.t[k] < 0.3e-9) k--;
          const dtn = (sp.t[n - 1] - sp.t[k]) * 1e9;
          if (dtn > 0.05) {
            const vx = (sp.x[n - 1] - sp.x[k]) / dtn, vy = (sp.y[n - 1] - sp.y[k]) / dtn;
            this.v = Math.sqrt(vx * vx + vy * vy);
            this.hall = wrapPi(Math.atan2(vy, vx) - this.p.dir * DEG) / DEG;
          }
        }
      }
      if (!this.lost && this.v !== null) pushHist(this.vh, this.t, [this.v], 700);
      if (this.lost) this.vh = newHist(1);
    } else {
      pushHist(this.hist, this.t, [Q, this.mzMean], 700);
    }
    this.obs = {
      Q: Q, t: this.t, frac: this.frac,
      maze: this.frac > 0.25 && this.frac < 0.75 && Math.abs(Q) < 2 && this.t > 4e-10,
      v: this.v, hall: this.hall
    };
  }
  hud() {
    if (this.mode === 'current') {
      return [
        ['Vitesse du skyrmion', this.v === null ? '—' : this.v.toFixed(0) + ' m/s', 'hot'],
        ['Angle de Hall', this.hall === null ? '—' : this.hall.toFixed(0) + '°', 'good'],
        ['Vitesse des électrons u', this.p.u.toFixed(0) + ' m/s'],
        ['Charge topologique Q', this.Q.toFixed(2)],
        ['β', (this.p.ratio * this.p.alpha).toFixed(3) + ' (α = ' + this.p.alpha.toFixed(2) + ')'],
        ['État', this.lost ? 'skyrmion perdu' : 'suivi du skyrmion', this.lost ? 'bad' : '']
      ];
    }
    return [
      ['Charge topologique Q', this.Q.toFixed(2), Math.abs(Math.abs(this.Q) - 1) < 0.2 ? 'good' : 'hot'],
      ['Skyrmions ≈', String(Math.round(Math.abs(this.Q)))],
      ['Aimantation moyenne ⟨mz⟩', this.mzMean.toFixed(2)],
      ['D / D_c', (this.core.D / this.Dc).toFixed(2), this.core.D > this.Dc ? 'bad' : ''],
      ['Temps', fmtTime(this.t)]
    ];
  }
  draw(ctx, W, H) {
    this.fv.paint(this.core, this.p.disp === 'mz' ? 'mz' : 'wheel');
    const L = this.fv.draw(ctx, W, H, 16), s = L.s, nx = this.nx, ny = this.ny;
    if (this.p.arrows) drawArrowsOver(ctx, this.core, this.fv, 2);
    if (this.mode === 'current') {
      const tr = this.trail;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        const ax = tr[i - 1][0], ay = tr[i - 1][1], bx = tr[i][0], by = tr[i][1];
        if (Math.abs(bx - ax) > nx / 2 || Math.abs(by - ay) > ny / 2) continue;
        const wx = ((ax % nx) + nx) % nx, wy = ((ay % ny) + ny) % ny;
        const wx2 = wx + (bx - ax), wy2 = wy + (by - ay);
        const a = this.fv.px(wx, wy), b = this.fv.px(wx2, wy2);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * i / tr.length).toFixed(2) + ')';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      if (this.pos && !this.lost) {
        const q = this.fv.px(((this.pos.x % nx) + nx) % nx, ((this.pos.y % ny) + ny) % ny);
        ctx.strokeStyle = '#ffc857';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, TAU); ctx.stroke();
      }
      const ang = this.p.dir * DEG, cx0 = L.x0 + 40, cy0 = L.y0 + 40;
      ctx.strokeStyle = '#ffc857'; ctx.fillStyle = '#ffc857';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx0 - Math.cos(ang) * 22, cy0 + Math.sin(ang) * 22);
      ctx.lineTo(cx0 + Math.cos(ang) * 22, cy0 - Math.sin(ang) * 22);
      ctx.stroke();
      ctx.beginPath();
      const tx = cx0 + Math.cos(ang) * 22, ty = cy0 - Math.sin(ang) * 22;
      ctx.moveTo(tx + Math.cos(ang) * 8, ty - Math.sin(ang) * 8);
      ctx.lineTo(tx - Math.cos(ang) * 4 - Math.sin(ang) * 6, ty + Math.sin(ang) * 4 - Math.cos(ang) * 6);
      ctx.lineTo(tx - Math.cos(ang) * 4 + Math.sin(ang) * 6, ty + Math.sin(ang) * 4 + Math.cos(ang) * 6);
      ctx.closePath(); ctx.fill();
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('électrons', cx0, cy0 + 40);
    }
    drawWheelLegend(ctx, W - 100, 54, 24);
    drawScaleBar(ctx, L.x0 + 12, H - 14, 100e-9 / this.dx * s, '100 nm');
  }
  drawPlots(p1, p2) {
    const c = this.core, nx = this.nx;
    if (this.mode === 'current') {
      drawSeries(p1, this.vh, [{ i: 0, col: '#ffc857', label: 'v' }], 'Vitesse du skyrmion (m/s)', null, null, 'm/s');
      const sp = this.sp;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < sp.x.length; i++) {
        x0 = Math.min(x0, sp.x[i]); x1 = Math.max(x1, sp.x[i]);
        y0 = Math.min(y0, sp.y[i]); y1 = Math.max(y1, sp.y[i]);
      }
      if (!(x1 > x0)) { x0 = 0; x1 = 100; y0 = 0; y1 = 100; }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = Math.max(60, (x1 - x0) / 2 * 1.2, (y1 - y0) / 2 * 1.2);
      p2.begin('Trajectoire du skyrmion (nm)', cx - half, cx + half, cy - half, cy + half, 'x (nm)', 'y (nm)');
      p2.clip();
      p2.line(sp.x, sp.y, '#ffc857', 2.4);
      const ang = this.p.dir * DEG;
      p2.ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      p2.ctx.setLineDash([5, 4]);
      p2.ctx.beginPath();
      if (sp.x.length) {
        p2.ctx.moveTo(p2.X(sp.x[0]), p2.Y(sp.y[0]));
        p2.ctx.lineTo(p2.X(sp.x[0] + Math.cos(ang) * half * 3), p2.Y(sp.y[0] + Math.sin(ang) * half * 3));
      }
      p2.ctx.stroke();
      p2.ctx.setLineDash([]);
      p2.unclip();
      p2.text('pointillé : direction du courant', p2.box.l + 8, p2.box.t + p2.ph - 8, 'rgba(255,255,255,0.6)');
    } else {
      drawSeries(p1, this.hist, [
        { i: 0, col: '#ff4fd8', label: 'Q' },
        { i: 1, col: '#37e6ff', label: '⟨mz⟩' }
      ], 'Charge topologique et aimantation moyenne', null, null, '');
      const xs = [], ys = [], j = Math.floor(this.ny / 2);
      for (let i = 0; i < nx; i++) { xs.push((i + 0.5) * this.dx * 1e9); ys.push(c.mz[j * nx + i]); }
      p2.begin('Coupe de mz le long de la ligne centrale', 0, nx * this.dx * 1e9, -1.1, 1.1, 'x (nm)', 'mz');
      p2.clip();
      p2.line(xs, ys, '#6ab7ff', 2.4);
      p2.unclip();
    }
  }
}

class SpinWaveSim extends FilmSimBase {
  constructor(host, d) {
    super(host, d);
    this.nx = 80;
    this.ny = 48;
    this.dx = 10e-9;
    this.timeScale = 6e-10;
    const c = new FilmCore(this.nx, this.ny, this.dx, { px: false, py: false });
    c.Ms = 8e5;
    c.A = 1.3e-11;
    c.Kc = 0.5 * c.Ms * 0.04;
    c.acS = new Float64Array(c.n);
    c.acDx = 1; c.acDy = 0; c.acDz = 0;
    c.acPhi = 0;
    this.core = c;
    this.fv = new FilmView(this.nx, this.ny);
    this.applyParams();
    this.reset();
  }
  buildSource() {
    const c = this.core, nx = this.nx, ny = this.ny, S = c.acS, cyc = ny / 2;
    S.fill(0);
    const blob = function (cx, cy) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const r2 = (i + 0.5 - cx) * (i + 0.5 - cx) + (j + 0.5 - cy) * (j + 0.5 - cy);
          S[j * nx + i] += Math.exp(-r2 / (2 * 1.6 * 1.6));
        }
      }
    };
    const src = this.p.src;
    if (src === 'line') {
      for (let j = 0; j < ny; j++) {
        const e = Math.min(j, ny - 1 - j), wgt = clamp((e - 8) / 8, 0, 1);
        S[j * nx + 14] = wgt; S[j * nx + 15] = wgt;
      }
    } else if (src === 'two') {
      blob(20, cyc - 8);
      blob(20, cyc + 8);
    } else {
      blob(20, cyc);
    }
  }
  applyParams() {
    const c = this.core, p = this.p, nx = this.nx, ny = this.ny, wc = 10;
    c.Bz = p.B * 1e-3;
    c.acAmp = p.b0 * 1e-3;
    c.acOmega = TAU * p.f * 1e9;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const dist = Math.min(i, nx - 1 - i, j, ny - 1 - j);
        const s = clamp((wc - dist) / wc, 0, 1);
        c.alpha[j * nx + i] = p.alpha + (0.35 - p.alpha) * s * s;
      }
    }
    c.prepare();
    this.buildSource();
    const Btot = p.B * 1e-3 + 2 * c.Kc / c.Ms, cex = 2 * c.A / c.Ms;
    this.f0 = GHZ_PER_T * Btot;
    const kk = (TAU * p.f * 1e9 / GAMMA - Btot) / cex;
    if (kk > 0) {
      this.k = Math.sqrt(kk);
      this.lambda = TAU / this.k;
      this.vg = 2 * GAMMA * cex * this.k;
    } else {
      this.k = null; this.lambda = null; this.vg = null;
    }
    this.Btot = Btot;
    this.cex = cex;
  }
  onParam(id) {
    if (id === 'f') this.core.acPhi += (this.core.acOmega - TAU * this.p.f * 1e9) * this.t;
    this.applyParams();
  }
  action(id) { if (id === 'reset') this.reset(); }
  reset() {
    const c = this.core;
    c.mx.fill(0); c.my.fill(0); c.mz.fill(1);
    c.acPhi = 0;
    this.t = 0;
    this.fv.vmax = 0.01;
    this.afterFrame();
  }
  afterFrame() {
    this.obs = {
      prop: this.k !== null,
      f: this.p.f, f0: this.f0, lambda: this.lambda, t: this.t
    };
  }
  hud() {
    const o = this.obs;
    return [
      ['Fréquence de coupure f₀', this.f0.toFixed(2) + ' GHz', 'hot'],
      ['Fréquence de la source', this.p.f.toFixed(1) + ' GHz'],
      ['Longueur d’onde', o.prop ? (this.lambda * 1e9).toFixed(0) + ' nm' : '— (pas de propagation)', o.prop ? 'good' : 'bad'],
      ['Vitesse de groupe', o.prop ? (this.vg).toFixed(0) + ' m/s' : '—'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  draw(ctx, W, H) {
    this.fv.paint(this.core, 'mx');
    const L = this.fv.draw(ctx, W, H, 10), s = L.s, nx = this.nx, ny = this.ny;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(L.x0 + 10 * s, L.y0 + 10 * s, (nx - 20) * s, (ny - 20) * s);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('zone absorbante (pas de réflexion)', L.x0 + 6, L.y0 + ny * s - 6);
    ctx.strokeStyle = '#ffc857';
    ctx.lineWidth = 2.4;
    const src = this.p.src, cyc = ny / 2;
    const ring = function (cx, cy) {
      const q = [L.x0 + cx * s, L.y0 + (ny - cy) * s];
      ctx.beginPath(); ctx.arc(q[0], q[1], 2.6 * s, 0, TAU); ctx.stroke();
    };
    if (src === 'line') {
      ctx.beginPath();
      ctx.moveTo(L.x0 + 15 * s, L.y0 + 10 * s);
      ctx.lineTo(L.x0 + 15 * s, L.y0 + (ny - 10) * s);
      ctx.stroke();
    } else if (src === 'two') {
      ring(20, cyc - 8);
      ring(20, cyc + 8);
    } else {
      ring(20, cyc);
    }
    drawScaleBar(ctx, W - 120, H - 14, 200e-9 / this.dx * s, '200 nm');
    ctx.fillStyle = 'rgba(255,200,87,0.95)';
    ctx.textAlign = 'left';
    ctx.fillText('antenne', L.x0 + 22 * s, L.y0 + (ny - cyc) * s - 3 * s);
  }
  drawPlots(p1, p2) {
    const xmax = 120, ymax = 24, cex = this.cex, B = this.Btot;
    p1.begin('Relation de dispersion  f(k)', 0, xmax, 0, ymax, 'nombre d’onde k (rad/µm)', 'f (GHz)');
    const kl = 2 * Math.PI / (6 * this.dx) / 1e6;
    p1.ctx.fillStyle = 'rgba(255,90,90,0.12)';
    p1.ctx.fillRect(p1.X(kl), p1.box.t, p1.X(xmax) - p1.X(kl), p1.ph);
    const ks = [], fs = [];
    for (let k = 0; k <= xmax; k += 2) { ks.push(k); fs.push(GHZ_PER_T * (B + cex * Math.pow(k * 1e6, 2))); }
    p1.clip();
    p1.line(ks, fs, '#37e6ff', 2.4);
    p1.hline(this.p.f, '#ff4fd8', true);
    p1.hline(this.f0, '#ffc857', true, 'f₀');
    if (this.k !== null) {
      const q = p1.ctx;
      q.fillStyle = '#ffffff';
      q.beginPath(); q.arc(p1.X(this.k * 1e-6), p1.Y(this.p.f), 6, 0, TAU); q.fill();
    }
    p1.unclip();
    p1.text('zone rouge : maille trop grossière', p1.X(kl) - 6, p1.box.t + p1.ph - 8, 'rgba(255,150,150,0.9)', 'right');
    const c = this.core, nx = this.nx, j = Math.floor(this.ny / 2), xs = [], ys = [];
    let lim = 0.01;
    for (let i = 0; i < nx; i++) {
      xs.push((i + 0.5) * this.dx * 1e9);
      const v = c.mx[j * nx + i];
      ys.push(v);
      lim = Math.max(lim, Math.abs(v));
    }
    lim *= 1.2;
    p2.begin('Coupe de mx le long de la ligne centrale', 0, nx * this.dx * 1e9, -lim, lim, 'x (nm)', 'mx');
    p2.clip();
    p2.line(xs, ys, '#ff7a7a', 2.2);
    p2.unclip();
  }
}
