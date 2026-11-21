function newHist(k) {
  const v = [];
  for (let i = 0; i < k; i++) v.push([]);
  return { t: [], v: v };
}

function pushHist(h, t, vals, max) {
  h.t.push(t);
  for (let k = 0; k < vals.length; k++) h.v[k].push(vals[k]);
  if (h.t.length > max) {
    h.t.shift();
    for (let k = 0; k < h.v.length; k++) h.v[k].shift();
  }
}

function drawSeries(pl, hist, defs, title, ymin, ymax, ylab) {
  const t = hist.t, n = t.length, tn = new Array(n);
  for (let i = 0; i < n; i++) tn[i] = t[i] * 1e9;
  const x0 = n ? tn[0] : 0;
  let x1 = n > 1 ? tn[n - 1] : x0 + 1;
  if (x1 - x0 < 1e-6) x1 = x0 + 1;
  let lo = ymin, hi = ymax;
  if (lo === null || hi === null) {
    lo = Infinity; hi = -Infinity;
    for (let k = 0; k < defs.length; k++) {
      const a = hist.v[defs[k].i];
      for (let i = 0; i < a.length; i++) {
        if (a[i] < lo) lo = a[i];
        if (a[i] > hi) hi = a[i];
      }
    }
    if (!(hi > lo)) { lo = -1; hi = 1; }
    const pad = (hi - lo) * 0.1;
    lo -= pad; hi += pad;
  }
  pl.begin(title, x0, x1, lo, hi, 't (ns)', ylab || '');
  if (n < 2) return;
  pl.clip();
  for (let k = 0; k < defs.length; k++) pl.line(tn, hist.v[defs[k].i], defs[k].col, 2);
  pl.unclip();
  pl.legend(defs);
}

class CompassSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 1.2e-10;
    this.sign = 1;
    this.hist = newHist(4);
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p, th = p.thB * DEG;
    this.ph.alpha = p.alpha;
    this.dir = [Math.sin(th), 0, Math.cos(th)];
    this.perp = [Math.cos(th), 0, -Math.sin(th)];
    this.bScale = Math.max(2e-3, p.B * 1e-3);
  }
  onParam(id) {
    this.applyParams();
    if (id === 'th0') this.reset();
  }
  fieldAt(t, o) {
    const b = this.sign * this.p.B * 1e-3;
    o[0] = b * this.dir[0]; o[1] = 0; o[2] = b * this.dir[2];
  }
  angleNow() {
    const m = this.m, d = this.dir;
    return Math.acos(clamp(this.sign * (m[0] * d[0] + m[1] * d[1] + m[2] * d[2]), -1, 1)) / DEG;
  }
  reset() {
    const a = this.p.th0 * DEG, d = this.dir, e = this.perp;
    this.sign = 1;
    this.m = [Math.cos(a) * d[0] + Math.sin(a) * e[0], 0, Math.cos(a) * d[2] + Math.sin(a) * e[2]];
    this.t = 0;
    this.trail = [];
    this.hist = newHist(4);
    this.epT0 = 0;
    this.startAngle = this.p.th0;
    this.alignedDur = null;
    this.angle = this.p.th0;
    this.afterFrame();
  }
  action(id) {
    if (id === 'reset') { this.reset(); return; }
    if (id === 'kick') {
      const m = this.m;
      m[0] += 1.4 * (Math.random() - 0.5);
      m[1] += 1.4 * (Math.random() - 0.5);
      m[2] += 1.4 * (Math.random() - 0.5);
      const n = 1 / Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
      m[0] *= n; m[1] *= n; m[2] *= n;
    } else if (id === 'flip') {
      this.sign = -this.sign;
    }
    this.epT0 = this.t;
    this.alignedDur = null;
    this.startAngle = this.angleNow();
  }
  afterFrame() {
    const m = this.m;
    this.angle = this.angleNow();
    if (this.alignedDur === null && this.startAngle > 60 && this.angle < 5) this.alignedDur = this.t - this.epT0;
    pushHist(this.hist, this.t, [m[0], m[1], m[2], this.angle], this.histMax);
    this.pushTrail();
    this.obs = {
      f: GHZ_PER_T * this.p.B * 1e-3,
      angle: this.angle,
      alignedDur: this.alignedDur,
      sinceEvent: this.t - this.epT0
    };
  }
  vectors() {
    const s = this.sign, d = this.dir, L = 0.4 + 0.8 * this.p.B / 400;
    return [{ v: [s * d[0] * L, 0, s * d[2] * L], col: '#ffc857', label: 'B' }];
  }
  hud() {
    return [
      ['Fréquence de Larmor', this.obs.f.toFixed(2) + ' GHz', 'hot'],
      ['Angle entre m et B', this.angle.toFixed(0) + '°'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  drawPlots(p1, p2) {
    drawSeries(p1, this.hist, [
      { i: 0, col: '#ff7a7a', label: 'mx' },
      { i: 1, col: '#7affb0', label: 'my' },
      { i: 2, col: '#6ab7ff', label: 'mz' }
    ], 'Composantes de l’aimantation', -1.1, 1.1, 'm');
    drawSeries(p2, this.hist, [{ i: 3, col: '#ffc857', label: 'angle m–B' }], 'Angle entre m et B (°)', 0, 180, '°');
  }
}

class HysteresisSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 2.0e-9;
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p, ps = p.psi * DEG;
    this.ph.alpha = p.alpha;
    this.ph.BK = p.BK * 1e-3;
    this.ph.ux = 0; this.ph.uy = 0; this.ph.uz = 1;
    this.h = [Math.sin(ps), 0, Math.cos(ps)];
    this.bScale = (p.Bmax + p.BK) * 1e-3;
    this.th = Math.pow(Math.pow(Math.cos(ps), 2 / 3) + Math.pow(Math.sin(ps), 2 / 3), -1.5) * p.BK;
  }
  onParam(id, v) {
    this.applyParams();
    if (id === 'BK' || id === 'psi' || id === 'alpha') { this.reset(); return; }
    if (id === 'Bmax') this.Bm = clamp(this.Bm, -v, v);
    if (id === 'B') {
      if (this.p.auto) {
        this.p.auto = false;
        this.host.setParamUI('auto', false);
      }
      this.Bm = v;
    }
    if (id === 'auto' && v) {
      this.Bm = clamp(this.Bm, -this.p.Bmax, this.p.Bmax);
      this.dir = this.Bm > 0 ? -1 : 1;
    }
  }
  reset() {
    this.Bm = this.p.Bmax;
    this.dir = -1;
    this.m = [0, 0, 1];
    this.t = 0;
    this.trail = [];
    this.loop = { B: [], M: [], br: [] };
    this.swField = null;
    this.prevS = 1;
    this.host.setParamUI('B', this.Bm);
    this.afterFrame();
  }
  preStep(dt) {
    const p = this.p;
    if (p.auto) {
      this.Bm += this.dir * p.rate * dt * 1e9;
      if (this.Bm <= -p.Bmax) { this.Bm = -p.Bmax; this.dir = 1; }
      else if (this.Bm >= p.Bmax) { this.Bm = p.Bmax; this.dir = -1; }
    }
  }
  postStep() {
    const s = this.m[2] > 0 ? 1 : -1;
    if (s !== this.prevS) { this.swField = this.Bm; this.prevS = s; }
  }
  fieldAt(t, o) {
    const b = this.Bm * 1e-3;
    o[0] = b * this.h[0]; o[1] = 0; o[2] = b * this.h[2];
  }
  afterFrame() {
    const m = this.m, h = this.h;
    const M = m[0] * h[0] + m[1] * h[1] + m[2] * h[2];
    const lp = this.loop;
    lp.B.push(this.Bm); lp.M.push(M); lp.br.push(this.p.auto ? this.dir : 0);
    if (lp.B.length > 3000) { lp.B.splice(0, 600); lp.M.splice(0, 600); lp.br.splice(0, 600); }
    this.pushTrail();
    if (this.p.auto) this.host.setParamUI('B', this.Bm);
    this.M = M;
    this.obs = {
      sw: this.swField,
      swAbs: this.swField === null ? null : Math.abs(this.swField),
      th: this.th
    };
  }
  vectors() {
    const p = this.p, s = this.Bm >= 0 ? 1 : -1, L = 0.35 + 0.8 * Math.min(1, Math.abs(this.Bm) / Math.max(p.Bmax, 1));
    return [
      { v: [s * this.h[0] * L, 0, s * this.h[2] * L], col: '#ffc857', label: 'B' },
      { v: [0, 0, 1.2], col: '#37e6ff', label: 'axe facile', axis: true }
    ];
  }
  hud() {
    const o = this.obs;
    return [
      ['Champ B', this.Bm.toFixed(0) + ' mT', 'hot'],
      ['Aimantation M∥', this.M.toFixed(2)],
      ['Retournement mesuré', o.sw === null ? '—' : o.sw.toFixed(0) + ' mT'],
      ['Théorie Stoner-Wohlfarth', '±' + this.th.toFixed(0) + ' mT']
    ];
  }
  drawPlots(p1, p2) {
    const p = this.p, Bm = p.Bmax * 1.08, lp = this.loop;
    p1.begin('Cycle d’hystérésis  M∥(B)', -Bm, Bm, -1.15, 1.15, 'B (mT)', 'M∥ = m·h');
    p1.clip();
    p1.vline(this.th, 'rgba(255,200,87,0.55)', true);
    p1.vline(-this.th, 'rgba(255,200,87,0.55)', true);
    const ctx = p1.ctx;
    ctx.lineWidth = 2.2;
    for (let pass = 0; pass < 3; pass++) {
      const col = pass === 0 ? '#ff4fd8' : (pass === 1 ? '#37e6ff' : '#b8c6ee');
      const want = pass === 0 ? -1 : (pass === 1 ? 1 : 0);
      ctx.strokeStyle = col;
      ctx.beginPath();
      let pen = false;
      for (let i = 1; i < lp.B.length; i++) {
        if (lp.br[i] !== want || Math.abs(lp.B[i] - lp.B[i - 1]) > 0.5 * p.Bmax) { pen = false; continue; }
        if (!pen) { ctx.moveTo(p1.X(lp.B[i - 1]), p1.Y(lp.M[i - 1])); pen = true; }
        ctx.lineTo(p1.X(lp.B[i]), p1.Y(lp.M[i]));
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(p1.X(this.Bm), p1.Y(this.M), 5, 0, TAU); ctx.fill();
    p1.unclip();

    const ps = p.psi * DEG, bk = p.BK;
    p2.begin('Astroïde : zone où deux états coexistent', -1.25, 1.25, -1.25, 1.25, 'B⊥ / B_K', 'B∥ / B_K');
    const c2 = p2.ctx;
    c2.beginPath();
    for (let i = 0; i <= 120; i++) {
      const s = TAU * i / 120, cs = Math.cos(s), sn = Math.sin(s);
      const hx = Math.sign(sn) * Math.pow(Math.abs(sn), 3), hz = Math.sign(cs) * Math.pow(Math.abs(cs), 3);
      if (i === 0) c2.moveTo(p2.X(hx), p2.Y(hz)); else c2.lineTo(p2.X(hx), p2.Y(hz));
    }
    c2.closePath();
    c2.fillStyle = 'rgba(55,230,255,0.12)';
    c2.fill();
    c2.strokeStyle = '#37e6ff';
    c2.lineWidth = 2;
    c2.stroke();
    p2.clip();
    c2.strokeStyle = 'rgba(255,200,87,0.55)';
    c2.setLineDash([5, 4]);
    c2.lineWidth = 1.5;
    c2.beginPath();
    c2.moveTo(p2.X(-p.Bmax * Math.sin(ps) / bk), p2.Y(-p.Bmax * Math.cos(ps) / bk));
    c2.lineTo(p2.X(p.Bmax * Math.sin(ps) / bk), p2.Y(p.Bmax * Math.cos(ps) / bk));
    c2.stroke();
    c2.setLineDash([]);
    c2.fillStyle = '#ffc857';
    c2.beginPath(); c2.arc(p2.X(this.Bm * Math.sin(ps) / bk), p2.Y(this.Bm * Math.cos(ps) / bk), 6, 0, TAU); c2.fill();
    p2.unclip();
  }
  action(id) {
    if (id === 'reset') this.reset();
  }
}

class FmrSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 1.5e-10;
    this.phase = 0;
    this.omega = TAU * this.p.f * 1e9;
    this.spec = null;
    this.specDirty = true;
    this.specStamp = 0;
    this.specPeak = null;
    this.hist = newHist(2);
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p;
    this.BP = { py: 1.0, cofeb: 1.6, yig: 0.175 }[p.mat] || 1.0;
    this.ph.alpha = p.alpha;
    this.ph.BP = this.BP;
    this.ph.BK = 0;
    this.ph.a = 0;
    this.omega = TAU * p.f * 1e9;
    this.bScale = (p.B0 + p.bac) * 1e-3 + this.BP;
    this.fres = GHZ_PER_T * Math.sqrt(p.B0 * 1e-3 * (p.B0 * 1e-3 + this.BP));
  }
  onParam(id) {
    this.applyParams();
    if (id === 'B0' || id === 'mat' || id === 'alpha') {
      this.specDirty = true;
      this.specStamp = performance.now();
    }
  }
  fieldAt(t, o) {
    o[0] = this.p.B0 * 1e-3;
    o[1] = this.p.bac * 1e-3 * Math.sin(this.phase + this.omega * (t - this.t));
    o[2] = 0;
  }
  postStep(dt) {
    this.phase += this.omega * dt;
    if (this.phase > 1e4) this.phase = this.phase % TAU;
  }
  reset() {
    const n = 1 / Math.sqrt(1 + 0.02 * 0.02);
    this.m = [n, 0.02 * n, 0];
    this.t = 0;
    this.phase = 0;
    this.trail = [];
    this.hist = newHist(2);
    this.ampHold = 0;
    this.specDirty = true;
    this.specStamp = 0;
    this.afterFrame(0);
  }
  action(id) {
    if (id === 'kick') {
      const m = this.m;
      m[1] += 0.35; m[2] += 0.25;
      const n = 1 / Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
      m[0] *= n; m[1] *= n; m[2] *= n;
    } else if (id === 'tune') {
      const f = clamp(this.fres, 1, 40);
      this.host.setParamUI('f', f);
      this.setParam('f', f);
    }
  }
  computeSpec() {
    const p = this.p, ph = newPhys();
    ph.alpha = p.alpha; ph.BP = this.BP;
    const B0 = p.B0 * 1e-3;
    const m0 = [1, 0.05, 0], n = 1 / Math.sqrt(1.0025);
    m0[0] *= n; m0[1] *= n;
    const N = 512, Ts = 1e-11;
    const r = macroSeries(ph, m0, function (t, o) { o[0] = B0; o[1] = 0; o[2] = 0; }, B0 + this.BP, Ts, N);
    this.spec = spectrumOf(r.sy, Ts);
    let kb = 1, vb = 0;
    const mg = this.spec.mags;
    for (let k = 1; k < mg.length - 1; k++) if (mg[k] > vb) { vb = mg[k]; kb = k; }
    let d = 0;
    const a = mg[kb - 1], b = mg[kb], c = mg[kb + 1];
    if (a - 2 * b + c !== 0) d = clamp(0.5 * (a - c) / (a - 2 * b + c), -1, 1);
    this.specPeak = (kb + d) * this.spec.df / 1e9;
    this.specMax = vb;
    this.specDirty = false;
  }
  update(dtReal, speed) {
    if (this.specDirty && performance.now() - this.specStamp > 150) this.computeSpec();
    super.update(dtReal, speed);
  }
  afterFrame(tf) {
    const m = this.m, cur = Math.sqrt(m[1] * m[1] + m[2] * m[2]);
    const tau = Math.max(2e-10, 3 / (this.p.f * 1e9));
    this.ampHold = Math.max(cur, (this.ampHold || 0) * Math.exp(-(tf || 0) / tau));
    pushHist(this.hist, this.t, [m[1], m[2]], this.histMax);
    this.pushTrail();
    this.obs = {
      amp: this.ampHold,
      f: this.p.f,
      fres: this.fres,
      B0: this.p.B0
    };
  }
  vectors() {
    return [
      { v: [0.9, 0, 0], col: '#ffc857', label: 'B' },
      { v: [0, 0.55 * Math.sin(this.phase), 0], col: '#ff4fd8', label: 'b(t)' }
    ];
  }
  hud() {
    const o = this.obs, amp = Math.asin(Math.min(1, o.amp)) / DEG;
    const near = Math.abs(o.f - o.fres) < 0.06 * Math.max(o.fres, 1);
    return [
      ['Fréquence de résonance (Kittel)', o.fres.toFixed(2) + ' GHz', 'hot'],
      ['Fréquence de pilotage', o.f.toFixed(1) + ' GHz'],
      ['Amplitude du cône', amp.toFixed(1) + '°', near ? 'good' : ''],
      ['Pic du spectre libre', this.specPeak === null ? '—' : this.specPeak.toFixed(2) + ' GHz']
    ];
  }
  drawPlots(p1, p2) {
    drawSeries(p1, this.hist, [
      { i: 0, col: '#7affb0', label: 'my' },
      { i: 1, col: '#6ab7ff', label: 'mz' }
    ], 'Oscillations de l’aimantation', null, null, 'm');
    const xmax = Math.max(20, Math.min(50, this.fres * 1.6 + 5));
    p2.begin('Spectre libre : la « note » de l’aimant', 0, xmax, 0, 1.12, 'fréquence (GHz)', 'amplitude');
    if (this.spec) {
      const mg = this.spec.mags, df = this.spec.df / 1e9, xs = [], ys = [];
      for (let k = 0; k < mg.length; k++) {
        if (k * df > xmax) break;
        xs.push(k * df); ys.push(mg[k] / (this.specMax || 1));
      }
      p2.clip();
      p2.line(xs, ys, '#37e6ff', 2);
      p2.vline(this.fres, '#ffc857', true, 'Kittel');
      p2.vline(this.p.f, '#ff4fd8', false, 'pilotage');
      p2.unclip();
    }
  }
}

class PulseSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 6e-11;
    this.hist = newHist(2);
    this.phase = 'ready';
    this.result = null;
    this.dur = 0;
    this.map = null;
    this.mapJob = null;
    this.mapStamp = performance.now();
    this.mapDirty = true;
    this.mph = newPhys();
    this.mint = new MacroIntegrator();
    this.NX = 40;
    this.NY = 40;
    this.BPMAX = 500;
    this.TAUMAX = 400;
    this.applyParams();
    const tau = this.findTau();
    if (tau !== null) {
      this.p.tau = tau;
      this.host.setParamUI('tau', tau);
    }
    this.fire();
  }
  applyParams() {
    const p = this.p;
    this.ph.alpha = p.alpha;
    this.ph.BK = p.BK * 1e-3;
    this.ph.ux = 0; this.ph.uy = 0; this.ph.uz = 1;
    this.bScale = (p.BK + p.Bp) * 1e-3;
  }
  onParam(id) {
    this.applyParams();
    if (id === 'BK' || id === 'alpha') {
      this.map = null;
      this.mapJob = null;
      this.mapDirty = true;
      this.mapStamp = performance.now();
    }
  }
  tsNow() {
    if (this.phase === 'pulse') return 6e-11;
    return this.result === null ? 3e-10 : 1.2e-9;
  }
  fieldAt(t, o) {
    o[0] = this.phase === 'pulse' ? this.p.Bp * 1e-3 : 0;
    o[1] = 0; o[2] = 0;
  }
  fire() {
    this.m = [0, 0, 1];
    this.t = 0;
    this.trail = [];
    this.hist = newHist(2);
    this.phase = 'pulse';
    this.dur = this.p.tau * 1e-12;
    this.result = null;
    this.firedBp = this.p.Bp;
    this.firedTau = this.p.tau;
    this.afterFrame();
  }
  simFlip(Bp, tau, BK, alpha) {
    const ph = this.mph, integ = this.mint;
    ph.alpha = alpha; ph.BK = BK; ph.ux = 0; ph.uy = 0; ph.uz = 1; ph.a = 0; ph.BP = 0;
    const m = [0, 0, 1];
    const f1 = function (t, o) { o[0] = Bp; o[1] = 0; o[2] = 0; };
    const f0 = function (t, o) { o[0] = 0; o[1] = 0; o[2] = 0; };
    const dtb = Math.min(3e-12, 0.1 / (GAMMA * (BK + Bp + 1e-3)));
    const n = Math.max(1, Math.ceil(tau / dtb)), dt = tau / n;
    let t = 0;
    for (let i = 0; i < n; i++) { integ.step(m, t, dt, ph, f1); t += dt; }
    const nmax = Math.ceil(6e-9 / dtb);
    for (let i = 0; i < nmax; i++) {
      if (Math.abs(m[2]) > 0.2) break;
      integ.step(m, t, dtb, ph, f0);
      t += dtb;
    }
    return m[2] < 0;
  }
  findTau() {
    const BK = this.p.BK * 1e-3, Bp = this.p.Bp * 1e-3, al = this.p.alpha;
    const res = [];
    for (let tau = 8; tau <= 400; tau += 4) res.push(this.simFlip(Bp, tau * 1e-12, BK, al));
    let i = 0;
    while (i < res.length) {
      if (!res[i]) { i++; continue; }
      let j = i;
      while (j + 1 < res.length && res[j + 1]) j++;
      if (j - i >= 1) return 8 + 4 * Math.round((i + j) / 2);
      i = j + 1;
    }
    return null;
  }
  stepMap(budget) {
    const job = this.mapJob;
    if (!job) return;
    const t0 = performance.now(), total = this.NX * this.NY;
    while (job.i < total && performance.now() - t0 < budget) {
      const jx = job.i % this.NX, jy = Math.floor(job.i / this.NX);
      const Bp = (jx + 0.5) / this.NX * this.BPMAX * 1e-3;
      const tau = (jy + 0.5) / this.NY * this.TAUMAX * 1e-12;
      job.data[job.i] = this.simFlip(Bp, tau, job.BK, job.alpha) ? 1 : 0;
      job.i++;
    }
    if (job.i >= total) { this.map = job; this.mapJob = null; }
  }
  update(dtReal, speed) {
    const now = performance.now();
    if (this.mapDirty && !this.mapJob && now - this.mapStamp > 400) {
      this.mapJob = { i: 0, data: new Uint8Array(this.NX * this.NY), BK: this.p.BK * 1e-3, alpha: this.p.alpha };
      this.mapDirty = false;
    }
    if (this.mapJob) this.stepMap(8);
    const tf = this.tsNow() * speed * dtReal, dm = this.dtMax();
    let rem = tf, guard = 0;
    while (rem > 1e-18 && guard++ < 20000) {
      if (this.phase === 'pulse' && this.t >= this.dur - 1e-18) this.phase = 'free';
      let dt = Math.min(dm, rem);
      if (this.phase === 'pulse' && this.t + dt > this.dur) dt = Math.max(this.dur - this.t, 1e-16);
      this.integ.step(this.m, this.t, dt, this.ph, this.fieldFn);
      this.t += dt;
      rem -= dt;
      if (this.phase === 'pulse' && this.t >= this.dur - 1e-18) this.phase = 'free';
      if (this.phase === 'free' && this.result === null) {
        if (Math.abs(this.m[2]) > 0.2 || this.t > this.dur + 8e-9) {
          this.result = this.m[2] < 0 ? 'flip' : 'noflip';
          this.host.toast(this.result === 'flip' ? '↻ Retourné ! L’aimant est passé de ↑ à ↓' : '✗ Raté : l’aimant est retombé du même côté');
        }
      }
    }
    this.afterFrame(tf);
  }
  afterFrame() {
    pushHist(this.hist, this.t, [this.m[2], this.m[0]], 4000);
    this.pushTrail();
    this.obs = {
      flipped: this.result === 'flip',
      decided: this.result !== null,
      Bp: this.firedBp,
      tau: this.firedTau
    };
  }
  action(id) {
    if (id === 'fire') this.fire();
    else if (id === 'cal') {
      const tau = this.findTau();
      if (tau === null) { this.host.toast('Aucune durée ne marche : augmente B_p (au moins B_K / 2)'); return; }
      this.p.tau = tau;
      this.host.setParamUI('tau', tau);
      this.fire();
    }
  }
  plotClick(which, px, py, pl) {
    if (which !== 2) return;
    const bp = pl.invX(px), tau = pl.invY(py);
    if (bp < 0 || bp > this.BPMAX || tau < 0 || tau > this.TAUMAX) return;
    this.p.Bp = Math.max(0, Math.round(bp));
    this.p.tau = Math.max(10, Math.round(tau));
    this.host.setParamUI('Bp', this.p.Bp);
    this.host.setParamUI('tau', this.p.tau);
    this.applyParams();
    this.fire();
  }
  vectors() {
    const out = [{ v: [0, 0, 1.2], col: '#37e6ff', label: 'axe facile', axis: true }];
    if (this.phase === 'pulse') out.push({ v: [0.4 + 0.8 * this.p.Bp / 500, 0, 0], col: '#ffc857', label: 'B_p' });
    return out;
  }
  hud() {
    let st = 'impulsion en cours…', cl = 'hot';
    if (this.phase === 'free' && this.result === null) st = 'relaxation…';
    if (this.result === 'flip') { st = 'RETOURNÉ ✓'; cl = 'good'; }
    if (this.result === 'noflip') { st = 'raté ✗'; cl = 'bad'; }
    return [
      ['Résultat', st, cl],
      ['Seuil théorique B_p', '> ' + (this.p.BK / 2).toFixed(0) + ' mT'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  drawPlots(p1, p2) {
    const tn = this.hist.t.map(function (v) { return v * 1e9; });
    const x1 = Math.max(1.5, tn.length ? tn[tn.length - 1] : 1.5, this.dur * 1e9 * 1.2);
    p1.begin('Aimantation pendant et après l’impulsion', 0, x1, -1.1, 1.1, 't (ns)', 'm');
    p1.ctx.fillStyle = 'rgba(255,200,87,0.16)';
    p1.ctx.fillRect(p1.X(0), p1.box.t, p1.X(this.dur * 1e9) - p1.X(0), p1.ph);
    p1.clip();
    p1.line(tn, this.hist.v[0], '#37e6ff', 2.2);
    p1.line(tn, this.hist.v[1], '#ff4fd8', 1.6);
    p1.unclip();
    p1.legend([{ col: '#37e6ff', label: 'mz' }, { col: '#ff4fd8', label: 'mx' }, { col: '#ffc857', label: 'impulsion' }]);

    p2.begin('Carte de retournement (clique dessus !)', 0, this.BPMAX, 0, this.TAUMAX, 'amplitude B_p (mT)', 'durée (ps)');
    const job = this.map || this.mapJob;
    if (job) {
      const ctx = p2.ctx, cw = p2.pw / this.NX, ch = p2.ph / this.NY, total = this.NX * this.NY;
      const upto = this.map ? total : job.i;
      for (let i = 0; i < upto; i++) {
        const jx = i % this.NX, jy = Math.floor(i / this.NX);
        ctx.fillStyle = job.data[i] ? 'rgba(255,79,216,0.85)' : 'rgba(20,30,70,0.8)';
        ctx.fillRect(p2.box.l + jx * cw, p2.box.t + p2.ph - (jy + 1) * ch, cw + 0.6, ch + 0.6);
      }
    } else {
      p2.text('calcul de la carte…', p2.box.l + 10, p2.box.t + 20, '#8fa0c8');
    }
    const ctx2 = p2.ctx;
    ctx2.strokeStyle = '#ffffff';
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.arc(p2.X(this.p.Bp), p2.Y(this.p.tau), 6, 0, TAU);
    ctx2.stroke();
    p2.vline(this.p.BK / 2, 'rgba(255,200,87,0.8)', true, 'B_K/2');
  }
}

class SttSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 1.5e-9;
    this.hist = newHist(2);
    this.scatter = { a: [], m: [] };
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p;
    this.ph.alpha = p.alpha;
    this.ph.BK = p.BK * 1e-3;
    this.ph.ux = 0; this.ph.uy = 0; this.ph.uz = 1;
    this.ph.px = 0; this.ph.py = 0; this.ph.pz = 1;
    this.acUp = p.alpha * (p.BK + p.Bz);
    this.acDn = p.alpha * (p.BK - p.Bz);
    this.bScale = (p.BK + Math.abs(p.Bz) + 45) * 1e-3;
  }
  onParam() { this.applyParams(); }
  aEff() { return this.auto ? this.auto.val : this.p.aJ; }
  preStep() { this.ph.a = this.aEff() * 1e-3; }
  fieldAt(t, o) { o[0] = 0; o[1] = 0; o[2] = this.p.Bz * 1e-3; }
  reset() {
    const n = 1 / Math.sqrt(1 + 0.06 * 0.06 + 0.02 * 0.02);
    this.m = [0.06 * n, 0.02 * n, n];
    this.t = 0;
    this.trail = [];
    this.hist = newHist(2);
    this.scatter = { a: [], m: [] };
    this.auto = null;
    this.swAmp = null;
    this.prevS = 1;
    this.sawDown = false;
    this.cycle = false;
    this.afterFrame();
  }
  postStep() {
    const s = this.m[2] > 0 ? 1 : -1;
    if (s !== this.prevS) { this.swAmp = this.aEff(); this.prevS = s; }
    const a = this.auto;
    if (a && (a.target * this.m[2] > 0.95 || this.t > a.t0 + 12e-9)) this.auto = null;
  }
  action(id) {
    if (id === 'reset') { this.reset(); return; }
    if (id === 'writeDown') this.auto = { val: 1.6 * Math.max(this.acUp, 0.5), target: -1, t0: this.t };
    if (id === 'writeUp') {
      if (this.acDn <= 0) { this.host.toast('Le champ de biais est trop fort : l’état ↓ n’est pas stable'); return; }
      this.auto = { val: -1.6 * Math.max(this.acDn, 0.5), target: 1, t0: this.t };
    }
  }
  afterFrame() {
    const mz = this.m[2], a = this.aEff();
    if (mz < -0.9) this.sawDown = true;
    if (this.sawDown && mz > 0.9) this.cycle = true;
    pushHist(this.hist, this.t, [mz, a / 40], this.histMax);
    this.scatter.a.push(a); this.scatter.m.push(mz);
    if (this.scatter.a.length > 1600) { this.scatter.a.splice(0, 300); this.scatter.m.splice(0, 300); }
    this.pushTrail();
    this.obs = { mz: mz, swAmp: this.swAmp, cycle: this.cycle };
  }
  vectors() {
    const out = [
      { v: [0, 0, 1.2], col: '#37e6ff', label: '', axis: true },
      { v: [0, 0, 0.62], col: '#b27bff', label: 'p' }
    ];
    if (Math.abs(this.p.Bz) > 0.1) out.push({ v: [0, 0, Math.sign(this.p.Bz) * (0.35 + Math.abs(this.p.Bz) / 80)], col: '#ffc857', label: 'B' });
    return out;
  }
  draw(ctx, W, H) {
    super.draw(ctx, W, H);
    const up = this.m[2] > 0, x = W - 86, y = 16;
    ctx.fillStyle = up ? 'rgba(55,230,255,0.18)' : 'rgba(255,79,216,0.18)';
    ctx.strokeStyle = up ? '#37e6ff' : '#ff4fd8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, 70, 78, 14) : ctx.rect(x, y, 70, 78);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = up ? '#37e6ff' : '#ff4fd8';
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(up ? '↑' : '↓', x + 35, y + 42);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('bit = ' + (up ? '1' : '0'), x + 35, y + 64);
  }
  hud() {
    const a = this.aEff();
    return [
      ['Torque de spin a_J', a.toFixed(1) + ' mT', Math.abs(a) > 0.01 ? 'hot' : ''],
      ['Seuil ↑→↓', '≈ ' + this.acUp.toFixed(1) + ' mT'],
      ['Seuil ↓→↑', this.acDn > 0 ? '≈ −' + this.acDn.toFixed(1) + ' mT' : 'état ↓ instable'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  drawPlots(p1, p2) {
    drawSeries(p1, this.hist, [
      { i: 0, col: '#37e6ff', label: 'mz' },
      { i: 1, col: '#ffc857', label: 'courant' }
    ], 'Aimantation et courant au cours du temps', -1.2, 1.2, '');
    const lim = 40;
    p2.begin('Trace  mz  en fonction du courant', -lim, lim, -1.15, 1.15, 'torque de spin a_J (mT)', 'mz');
    p2.clip();
    p2.vline(this.acUp, 'rgba(255,200,87,0.6)', true);
    if (this.acDn > 0) p2.vline(-this.acDn, 'rgba(255,200,87,0.6)', true);
    const ctx = p2.ctx, sa = this.scatter.a, sm = this.scatter.m;
    for (let i = 0; i < sa.length; i++) {
      ctx.fillStyle = 'rgba(255,79,216,' + (0.25 + 0.6 * i / sa.length).toFixed(2) + ')';
      ctx.fillRect(p2.X(sa[i]) - 1.5, p2.Y(sm[i]) - 1.5, 3, 3);
    }
    p2.unclip();
  }
}

class StoSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 1.5e-10;
    this.hist = newHist(2);
    this.orbit = [];
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p;
    this.ph.alpha = p.alpha;
    this.ph.BP = p.mu0Ms;
    this.ph.BK = 0;
    this.ph.a = p.aJ * 1e-3;
    this.ph.px = 1; this.ph.py = 0; this.ph.pz = 0;
    this.bScale = (p.B + p.aJ) * 1e-3 + p.mu0Ms;
    const B = p.B * 1e-3;
    this.f0 = GHZ_PER_T * Math.sqrt(B * (B + p.mu0Ms));
    this.ac = p.alpha * (p.B + p.mu0Ms * 500);
  }
  onParam() {
    this.applyParams();
    this.cross = [];
  }
  fieldAt(t, o) { o[0] = this.p.B * 1e-3; o[1] = 0; o[2] = 0; }
  reset() {
    const n = 1 / Math.sqrt(1 + 0.12 * 0.12 + 0.05 * 0.05);
    this.m = [n, 0.12 * n, 0.05 * n];
    this.t = 0;
    this.trail = [];
    this.hist = newHist(2);
    this.orbit = [];
    this.cross = [];
    this.prevY = this.m[1];
    this.ampHold = 0;
    this.afterFrame(0);
  }
  postStep(dt) {
    const y = this.m[1];
    if (this.prevY < 0 && y >= 0) {
      this.cross.push(this.t - dt * y / (y - this.prevY));
      if (this.cross.length > 9) this.cross.shift();
    }
    this.prevY = y;
  }
  action(id) {
    if (id === 'kick') {
      const m = this.m;
      m[1] += 0.4; m[2] += 0.3;
      const n = 1 / Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
      m[0] *= n; m[1] *= n; m[2] *= n;
    } else if (id === 'reset') this.reset();
  }
  afterFrame(tf) {
    const m = this.m, cur = Math.sqrt(m[1] * m[1] + m[2] * m[2]);
    this.ampHold = Math.max(cur, (this.ampHold || 0) * Math.exp(-(tf || 0) / 5e-10));
    pushHist(this.hist, this.t, [m[1], m[2]], this.histMax);
    this.orbit.push([m[1], m[2]]);
    if (this.orbit.length > 700) this.orbit.shift();
    this.pushTrail();
    let f = null;
    const c = this.cross;
    if (c.length >= 3) {
      const per = (c[c.length - 1] - c[0]) / (c.length - 1);
      if (this.t - c[c.length - 1] < 3 * per) f = 1 / per / 1e9;
    }
    this.fMeas = f;
    this.obs = { amp: this.ampHold, f: f, ac: this.ac };
  }
  vectors() {
    return [
      { v: [1.25, 0, 0], col: '#ffc857', label: 'B' },
      { v: [0.62, 0, 0], col: '#b27bff', label: 'p' }
    ];
  }
  hud() {
    const o = this.obs, amp = Math.asin(Math.min(1, o.amp)) / DEG;
    const on = o.amp > 0.15 && this.p.aJ > this.ac;
    return [
      ['Seuil a_c = α(B + μ₀Ms/2)', this.ac.toFixed(1) + ' mT', 'hot'],
      ['Courant a_J', this.p.aJ.toFixed(1) + ' mT'],
      ['Fréquence mesurée', o.f === null ? '—' : o.f.toFixed(2) + ' GHz', on ? 'good' : ''],
      ['Amplitude', amp.toFixed(0) + '°', on ? 'good' : '']
    ];
  }
  drawPlots(p1, p2) {
    drawSeries(p1, this.hist, [
      { i: 0, col: '#7affb0', label: 'my' },
      { i: 1, col: '#6ab7ff', label: 'mz' }
    ], 'Signal micro-onde produit', null, null, 'm');
    let lim = 0.2;
    for (let i = 0; i < this.orbit.length; i++) lim = Math.max(lim, Math.abs(this.orbit[i][0]), Math.abs(this.orbit[i][1]));
    lim *= 1.2;
    p2.begin('Portrait de phase (my, mz) : cycle limite', -lim, lim, -lim, lim, 'my', 'mz');
    p2.clip();
    const ctx = p2.ctx, o = this.orbit;
    ctx.lineWidth = 2;
    for (let i = 1; i < o.length; i++) {
      ctx.strokeStyle = 'hsla(' + (300 - 120 * i / o.length).toFixed(0) + ',100%,65%,' + (0.15 + 0.85 * i / o.length).toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(p2.X(o[i - 1][0]), p2.Y(o[i - 1][1]));
      ctx.lineTo(p2.X(o[i][0]), p2.Y(o[i][1]));
      ctx.stroke();
    }
    if (o.length) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(p2.X(o[o.length - 1][0]), p2.Y(o[o.length - 1][1]), 5, 0, TAU); ctx.fill();
    }
    p2.unclip();
  }
}
