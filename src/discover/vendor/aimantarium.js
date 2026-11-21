/* eslint-disable */
// Code de simulation du prototype Aimantarium (version accompagnée V12),
// repris tel quel : fichiers js/noyau, js/vue, js/modes et js/catalogue
// concaténés dans un module. Ne pas modifier ici sans raison : c'est la
// référence physique des parcours de découverte.
// Bouchons pour ce qui n'est pas repris (capteurs, son, code Ubermag) :
const Sensors = { real: false, heading: null, start: () => Promise.resolve(), label: () => '' };
const Snd = { on: false };
const UB_HEAD = '';
const UB = { links: {}, map: {}, cells: {}, code: {}, notes: {} };

// ===== noyau/util.js =====
const TAU = Math.PI * 2;
const GAMMA = 1.760859e11;
const MU0 = 4e-7 * Math.PI;
const GHZ_PER_T = GAMMA / TAU / 1e9;
const DEG = Math.PI / 180;
const KB = 1.380649e-23;
const FONT = 'Atkinson Hyperlegible, system-ui, sans-serif';
const FONTD = 'Archivo, Atkinson Hyperlegible, system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const PAL = {
  paper: '#F4EFE6', card: '#FBF8F2', ink: '#17140F', ink2: '#4A443A', ink3: '#8A8275', rule: '#D8CFBF',
  red: '#D7301F', blue: '#1F4E9C', gold: '#C98A00', plum: '#7B3FA0', leaf: '#2F7D4F', teal: '#0F7C80', ember: '#B4532A',
  x: '#D9480F', y: '#2F7D4F', z: '#1F4E9C'
};

function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

function qs(sel, root) { return (root || document).querySelector(sel); }

function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function mk(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function hsl2rgb(h, s, l) {
  h = h - Math.floor(h);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = function (t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function divRGB(v) {
  const t = clamp(v, -1, 1), w = [247, 243, 236];
  if (t >= 0) return lerp3(w, [215, 48, 31], t);
  return lerp3(w, [31, 78, 156], -t);
}

function arrowRGB(v) {
  const t = clamp(v, -1, 1), k = [40, 36, 30];
  if (t >= 0) return lerp3(k, [215, 48, 31], t);
  return lerp3(k, [31, 78, 156], -t);
}

function rgbStr(c) {
  return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

function fnt(px, w, fam) { return (w || 400) + ' ' + px + 'px ' + (fam || FONT); }

function frNum(v, d) {
  if (!isFinite(v)) return '—';
  const k = d === undefined ? 2 : d;
  return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: k, maximumFractionDigits: k });
}

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };

function sciStr(v, d) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e <= 4) return frNum(v, d === undefined ? 2 : d);
  const m = v / Math.pow(10, e);
  return frNum(m, d === undefined ? 1 : d) + '·10' + String(e).split('').map(function (c) { return SUP[c] || c; }).join('');
}

function fmtTime(t) {
  if (Math.abs(t) < 1e-9) return frNum(t * 1e12, 0) + ' ps';
  return frNum(t * 1e9, 2) + ' ns';
}

function fmtSpan(s) {
  const a = Math.abs(s);
  const U = [[3.156e7, 'an'], [86400, 'jour'], [3600, 'h'], [60, 'min'], [1, 's'], [1e-3, 'ms'], [1e-6, 'µs'], [1e-9, 'ns'], [1e-12, 'ps'], [1e-15, 'fs']];
  for (let i = 0; i < U.length; i++) {
    const k = U[i][0], n = U[i][1];
    if (a >= k * 0.999 || i === U.length - 1) {
      const v = s / k, d = v < 10 ? 2 : (v < 100 ? 1 : 0);
      let txt = v >= 1e5 ? sciStr(v, 1) : frNum(v, d);
      if (n === 'an' || n === 'jour') txt += ' ' + n + (v >= 2 ? 's' : '');
      else txt += ' ' + n;
      return txt;
    }
  }
  return '0 s';
}

function niceStep(range, target) {
  const raw = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const nice = f < 1.5 ? 1 : (f < 3 ? 2 : (f < 7 ? 5 : 10));
  return nice * pow;
}

function tickLabel(v) {
  const s = Math.abs(v) < 1e-12 ? 0 : v;
  return String(parseFloat(s.toPrecision(4))).replace('.', ',');
}

function wrapPi(a) {
  while (a > Math.PI) a -= TAU;
  while (a <= -Math.PI) a += TAU;
  return a;
}

function xorshift(seed) {
  let x = (seed >>> 0) || 1;
  return function () {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
}

function uni(r) { return function () { return r() / 4294967296; }; }

function gauss(u) {
  let a = u();
  if (a < 1e-12) a = 1e-12;
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(TAU * u());
}

function packRGB(r, g, b) { return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; }

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function download(name, data, mime) {
  const b = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ===== noyau/fft.js =====
function makeFFT(n) {
  let bits = 0;
  while ((1 << bits) < n) bits++;
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  const cs = new Float64Array(n >> 1), sn = new Float64Array(n >> 1);
  for (let i = 0; i < (n >> 1); i++) {
    cs[i] = Math.cos(TAU * i / n);
    sn[i] = Math.sin(TAU * i / n);
  }
  return function (re, im, inv, o) {
    o = o | 0;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[o + i]; re[o + i] = re[o + j]; re[o + j] = t;
        t = im[o + i]; im[o + i] = im[o + j]; im[o + j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0, w = 0; k < half; k++, w += step) {
          const wr = cs[w], wi = inv ? sn[w] : -sn[w];
          const a = o + start + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
    if (inv) {
      const s = 1 / n;
      for (let i = 0; i < n; i++) { re[o + i] *= s; im[o + i] *= s; }
    }
  };
}

function makeFFT2R(Px, Py) {
  const fx = makeFFT(Px), fy = Py === Px ? fx : makeFFT(Py);
  const tr = new Float64Array(Py), ti = new Float64Array(Py);
  return function (re, im, inv) {
    for (let y = 0; y < Py; y++) fx(re, im, inv, y * Px);
    for (let x = 0; x < Px; x++) {
      for (let y = 0; y < Py; y++) { tr[y] = re[y * Px + x]; ti[y] = im[y * Px + x]; }
      fy(tr, ti, inv, 0);
      for (let y = 0; y < Py; y++) { re[y * Px + x] = tr[y]; im[y * Px + x] = ti[y]; }
    }
  };
}

function makeFFT2(P) { return makeFFT2R(P, P); }

// ===== noyau/macro.js =====
function spectrumOf(sig, Ts) {
  const N = sig.length, re = new Float64Array(N), im = new Float64Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) mean += sig[i];
  mean /= N;
  for (let i = 0; i < N; i++) re[i] = (sig[i] - mean) * (0.5 - 0.5 * Math.cos(TAU * i / (N - 1)));
  makeFFT(N)(re, im, false, 0);
  const H = N >> 1, mags = new Float64Array(H);
  for (let k = 0; k < H; k++) mags[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
  return { mags: mags, df: 1 / (N * Ts) };
}

function newPhys() {
  return { alpha: 0.1, BK: 0, ux: 0, uy: 0, uz: 1, BP: 0, a: 0, px: 0, py: 0, pz: 1 };
}

function llgMacro(m, B, ph, o) {
  const x = m[0], y = m[1], z = m[2];
  let bx = B[0], by = B[1], bz = B[2];
  if (ph.BK !== 0) {
    const d = ph.BK * (x * ph.ux + y * ph.uy + z * ph.uz);
    bx += d * ph.ux; by += d * ph.uy; bz += d * ph.uz;
  }
  if (ph.BP !== 0) bz -= ph.BP * z;
  const al = ph.alpha, g = GAMMA / (1 + al * al);
  const cx = y * bz - z * by, cy = z * bx - x * bz, cz = x * by - y * bx;
  const ex = y * cz - z * cy, ey = z * cx - x * cz, ez = x * cy - y * cx;
  let dx = -g * (cx + al * ex), dy = -g * (cy + al * ey), dz = -g * (cz + al * ez);
  if (ph.a !== 0) {
    const px = ph.px, py = ph.py, pz = ph.pz;
    const qx = y * pz - z * py, qy = z * px - x * pz, qz = x * py - y * px;
    const rx = y * qz - z * qy, ry = z * qx - x * qz, rz = x * qy - y * qx;
    dx += g * ph.a * (rx - al * qx);
    dy += g * ph.a * (ry - al * qy);
    dz += g * ph.a * (rz - al * qz);
  }
  o[0] = dx; o[1] = dy; o[2] = dz;
}

class MacroIntegrator {
  constructor() {
    this.k1 = [0, 0, 0]; this.k2 = [0, 0, 0]; this.k3 = [0, 0, 0]; this.k4 = [0, 0, 0];
    this.tmp = [0, 0, 0];
    this.B1 = [0, 0, 0]; this.B2 = [0, 0, 0]; this.B3 = [0, 0, 0];
  }
  step(m, t, dt, ph, fieldFn) {
    const k1 = this.k1, k2 = this.k2, k3 = this.k3, k4 = this.k4, tmp = this.tmp;
    const B1 = this.B1, B2 = this.B2, B3 = this.B3;
    fieldFn(t, B1);
    fieldFn(t + 0.5 * dt, B2);
    fieldFn(t + dt, B3);
    llgMacro(m, B1, ph, k1);
    for (let i = 0; i < 3; i++) tmp[i] = m[i] + 0.5 * dt * k1[i];
    llgMacro(tmp, B2, ph, k2);
    for (let i = 0; i < 3; i++) tmp[i] = m[i] + 0.5 * dt * k2[i];
    llgMacro(tmp, B2, ph, k3);
    for (let i = 0; i < 3; i++) tmp[i] = m[i] + dt * k3[i];
    llgMacro(tmp, B3, ph, k4);
    for (let i = 0; i < 3; i++) m[i] += dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    const n = 1 / Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
    m[0] *= n; m[1] *= n; m[2] *= n;
  }
}

function macroSeries(ph, m0, fieldFn, bScale, Ts, N) {
  const integ = new MacroIntegrator();
  const m = [m0[0], m0[1], m0[2]];
  const dtMax = Math.min(3e-12, 0.08 / (GAMMA * Math.max(bScale, 1e-3)));
  const ns = Math.max(1, Math.ceil(Ts / dtMax)), dt = Ts / ns;
  const sy = new Float64Array(N), sz = new Float64Array(N);
  let t = 0;
  for (let k = 0; k < N; k++) {
    sy[k] = m[1]; sz[k] = m[2];
    for (let s = 0; s < ns; s++) { integ.step(m, t, dt, ph, fieldFn); t += dt; }
  }
  return { sy: sy, sz: sz };
}

// ===== noyau/film.js =====
class FilmCore {
  constructor(nx, ny, dx, o) {
    o = o || {};
    const n = nx * ny;
    this.nx = nx; this.ny = ny; this.n = n; this.dx = dx;
    this.mx = new Float64Array(n); this.my = new Float64Array(n); this.mz = new Float64Array(n);
    this.tx = new Float64Array(n); this.ty = new Float64Array(n); this.tz = new Float64Array(n);
    this.K = [];
    for (let q = 0; q < 4; q++) this.K.push([new Float64Array(n), new Float64Array(n), new Float64Array(n)]);
    this.alpha = new Float64Array(n).fill(0.1);
    this.mask = o.mask || null;
    this.nbL = new Int32Array(n); this.nbR = new Int32Array(n);
    this.nbU = new Int32Array(n); this.nbD = new Int32Array(n);
    const act = [];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i;
        if (!this.mask || this.mask[id] === 1) act.push(id);
        this.nbL[id] = this.neighbor(id, i - 1, j, o.px, o.py);
        this.nbR[id] = this.neighbor(id, i + 1, j, o.px, o.py);
        this.nbU[id] = this.neighbor(id, i, j + 1, o.px, o.py);
        this.nbD[id] = this.neighbor(id, i, j - 1, o.px, o.py);
      }
    }
    this.act = Int32Array.from(act);
    this.Ms = 8e5; this.A = 1.3e-11; this.D = 0; this.Kc = 0;
    this.Bx = 0; this.By = 0; this.Bz = 0;
    this.beta = 0; this.ux = 0; this.uy = 0;
    this.acS = null; this.acAmp = 0; this.acOmega = 0; this.acPhi = 0;
    this.acDx = 1; this.acDy = 0; this.acDz = 0;
    this.dt = 1e-13;
    this.demagOn = false;
    this.dmCount = 0;
    this.demagEvery = 2;
    if (o.demag) {
      this.demagOn = true;
      let P = 1;
      while (P < 2 * Math.max(nx, ny)) P <<= 1;
      this.P = P;
      this.fft2 = makeFFT2(P);
      const PP = P * P;
      this.fr1 = new Float64Array(PP); this.fi1 = new Float64Array(PP);
      this.fr2 = new Float64Array(PP); this.fi2 = new Float64Array(PP);
      this.fr3 = new Float64Array(PP); this.fi3 = new Float64Array(PP);
      this.gxx = new Float64Array(PP); this.gxy = new Float64Array(PP);
      this.gyy = new Float64Array(PP); this.gz = new Float64Array(PP);
      this.hdx = new Float64Array(n); this.hdy = new Float64Array(n); this.hdz = new Float64Array(n);
      this.thickness = o.thickness || 20e-9;
    }
  }

  neighbor(id, i, j, px, py) {
    const nx = this.nx, ny = this.ny;
    if (i < 0) i = px ? nx - 1 : 0; else if (i >= nx) i = px ? 0 : nx - 1;
    if (j < 0) j = py ? ny - 1 : 0; else if (j >= ny) j = py ? 0 : ny - 1;
    const q = j * nx + i;
    if (this.mask && this.mask[q] !== 1) return id;
    return q;
  }

  prepare() {
    const dx = this.dx, Ms = this.Ms;
    this.cEx = 2 * this.A / (Ms * dx * dx);
    this.cD = this.D / (Ms * dx);
    this.cK = 2 * this.Kc / Ms;
    this.inv2dx = 1 / (2 * dx);
    const dimf = (this.nx > 1 && this.ny > 1) ? 8 : 4;
    let stiff = dimf * this.cEx + Math.abs(this.cK) + 4 * Math.abs(this.cD);
    stiff += Math.sqrt(this.Bx * this.Bx + this.By * this.By + this.Bz * this.Bz) + this.acAmp;
    stiff += (Math.abs(this.ux) + Math.abs(this.uy)) / (dx * GAMMA);
    if (this.demagOn) {
      stiff += MU0 * Ms;
      this.buildKernel();
    }
    this.dt = 1.0 / (GAMMA * stiff);
  }

  buildKernel() {
    const P = this.P, dx = this.dx, t = this.thickness;
    for (let ky = 0; ky < P; ky++) {
      const iy = ky < P / 2 ? ky : ky - P, kyv = TAU * iy / (P * dx);
      for (let kx = 0; kx < P; kx++) {
        const ix = kx < P / 2 ? kx : kx - P, kxv = TAU * ix / (P * dx);
        const p = ky * P + kx, k2 = kxv * kxv + kyv * kyv;
        if (k2 === 0) {
          this.gxx[p] = 0; this.gxy[p] = 0; this.gyy[p] = 0; this.gz[p] = -1;
          continue;
        }
        const k = Math.sqrt(k2), f = (1 - Math.exp(-k * t)) / (k * t), w = (1 - f) / k2;
        this.gxx[p] = -w * kxv * kxv;
        this.gxy[p] = -w * kxv * kyv;
        this.gyy[p] = -w * kyv * kyv;
        this.gz[p] = -f;
      }
    }
  }

  invalidate() { this.dmCount = 0; }

  updateDemag() {
    const P = this.P, nx = this.nx, ny = this.ny, mask = this.mask;
    const r1 = this.fr1, i1 = this.fi1, r2 = this.fr2, i2 = this.fi2, r3 = this.fr3, i3 = this.fi3;
    r1.fill(0); i1.fill(0); r2.fill(0); i2.fill(0);
    const mx = this.mx, my = this.my, mz = this.mz;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i;
        if (mask && mask[id] !== 1) continue;
        const p = j * P + i;
        r1[p] = mx[id]; i1[p] = my[id]; r2[p] = mz[id];
      }
    }
    this.fft2(r1, i1, false);
    this.fft2(r2, i2, false);
    const gxx = this.gxx, gxy = this.gxy, gyy = this.gyy, gz = this.gz;
    for (let ky = 0; ky < P; ky++) {
      const qy = ((P - ky) % P) * P;
      for (let kx = 0; kx < P; kx++) {
        const p = ky * P + kx, q = qy + ((P - kx) % P);
        const ar = r1[p], ai = i1[p], br = r1[q], bi = -i1[q];
        const mxr = 0.5 * (ar + br), mxi = 0.5 * (ai + bi);
        const myr = 0.5 * (ai - bi), myi = -0.5 * (ar - br);
        const hxr = gxx[p] * mxr + gxy[p] * myr, hxi = gxx[p] * mxi + gxy[p] * myi;
        const hyr = gxy[p] * mxr + gyy[p] * myr, hyi = gxy[p] * mxi + gyy[p] * myi;
        r3[p] = hxr - hyi; i3[p] = hxi + hyr;
        r2[p] *= gz[p]; i2[p] *= gz[p];
      }
    }
    this.fft2(r3, i3, true);
    this.fft2(r2, i2, true);
    const s = MU0 * this.Ms;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i, p = j * P + i;
        if (mask && mask[id] !== 1) { this.hdx[id] = 0; this.hdy[id] = 0; this.hdz[id] = 0; continue; }
        this.hdx[id] = s * r3[p]; this.hdy[id] = s * i3[p]; this.hdz[id] = s * r2[p];
      }
    }
  }

  deriv(ax, ay, az, ox, oy, oz, t) {
    const act = this.act, na = act.length, L = this.nbL, R = this.nbR, U = this.nbU, Dn = this.nbD;
    const cEx = this.cEx, cD = this.cD, cK = this.cK, al = this.alpha;
    const bx0 = this.Bx, by0 = this.By, bz0 = this.Bz;
    const useD = cD !== 0, ux = this.ux, uy = this.uy, useZ = ux !== 0 || uy !== 0;
    const i2 = this.inv2dx, beta = this.beta;
    const useAc = this.acAmp !== 0 && this.acS !== null;
    let acv = 0;
    if (useAc) acv = this.acAmp * Math.sin(this.acOmega * t + this.acPhi);
    const acS = this.acS, adx = this.acDx, ady = this.acDy, adz = this.acDz;
    const dm = this.demagOn, hx = this.hdx, hy = this.hdy, hz = this.hdz;
    for (let q = 0; q < na; q++) {
      const i = act[q], l = L[i], r = R[i], u = U[i], d = Dn[i];
      const x = ax[i], y = ay[i], z = az[i];
      let Bx = bx0 + cEx * (ax[l] + ax[r] + ax[u] + ax[d] - 4 * x);
      let By = by0 + cEx * (ay[l] + ay[r] + ay[u] + ay[d] - 4 * y);
      let Bz = bz0 + cEx * (az[l] + az[r] + az[u] + az[d] - 4 * z) + cK * z;
      if (useD) {
        Bx += cD * (az[r] - az[l]);
        By += cD * (az[u] - az[d]);
        Bz -= cD * (ax[r] - ax[l] + ay[u] - ay[d]);
      }
      if (useAc) {
        const s = acv * acS[i];
        Bx += s * adx; By += s * ady; Bz += s * adz;
      }
      if (dm) { Bx += hx[i]; By += hy[i]; Bz += hz[i]; }
      const a = al[i], g = GAMMA / (1 + a * a);
      const cx = y * Bz - z * By, cy = z * Bx - x * Bz, cz = x * By - y * Bx;
      let tx = -g * (cx + a * (y * cz - z * cy));
      let ty = -g * (cy + a * (z * cx - x * cz));
      let tz = -g * (cz + a * (x * cy - y * cx));
      if (useZ) {
        const Dx = (ux * (ax[r] - ax[l]) + uy * (ax[u] - ax[d])) * i2;
        const Dy = (ux * (ay[r] - ay[l]) + uy * (ay[u] - ay[d])) * i2;
        const Dz = (ux * (az[r] - az[l]) + uy * (az[u] - az[d])) * i2;
        const wx = y * Dz - z * Dy, wy = z * Dx - x * Dz, wz = x * Dy - y * Dx;
        const md = x * Dx + y * Dy + z * Dz;
        const inv = 1 / (1 + a * a);
        const f1 = -(1 + a * beta) * inv, f2 = (beta - a) * inv, f3 = a * beta * inv;
        tx += f1 * Dx + f2 * wx + f3 * md * x;
        ty += f1 * Dy + f2 * wy + f3 * md * y;
        tz += f1 * Dz + f2 * wz + f3 * md * z;
      }
      ox[i] = tx; oy[i] = ty; oz[i] = tz;
    }
  }

  step(dt, t) {
    const act = this.act, na = act.length;
    const mx = this.mx, my = this.my, mz = this.mz, tx = this.tx, ty = this.ty, tz = this.tz;
    const K = this.K, k1 = K[0], k2 = K[1], k3 = K[2], k4 = K[3];
    if (this.demagOn) {
      if (this.dmCount <= 0) { this.updateDemag(); this.dmCount = this.demagEvery; }
      this.dmCount--;
    }
    const h2 = 0.5 * dt;
    this.deriv(mx, my, mz, k1[0], k1[1], k1[2], t);
    for (let q = 0; q < na; q++) {
      const i = act[q];
      tx[i] = mx[i] + h2 * k1[0][i]; ty[i] = my[i] + h2 * k1[1][i]; tz[i] = mz[i] + h2 * k1[2][i];
    }
    this.deriv(tx, ty, tz, k2[0], k2[1], k2[2], t + h2);
    for (let q = 0; q < na; q++) {
      const i = act[q];
      tx[i] = mx[i] + h2 * k2[0][i]; ty[i] = my[i] + h2 * k2[1][i]; tz[i] = mz[i] + h2 * k2[2][i];
    }
    this.deriv(tx, ty, tz, k3[0], k3[1], k3[2], t + h2);
    for (let q = 0; q < na; q++) {
      const i = act[q];
      tx[i] = mx[i] + dt * k3[0][i]; ty[i] = my[i] + dt * k3[1][i]; tz[i] = mz[i] + dt * k3[2][i];
    }
    this.deriv(tx, ty, tz, k4[0], k4[1], k4[2], t + dt);
    const d6 = dt / 6;
    for (let q = 0; q < na; q++) {
      const i = act[q];
      let x = mx[i] + d6 * (k1[0][i] + 2 * k2[0][i] + 2 * k3[0][i] + k4[0][i]);
      let y = my[i] + d6 * (k1[1][i] + 2 * k2[1][i] + 2 * k3[1][i] + k4[1][i]);
      let z = mz[i] + d6 * (k1[2][i] + 2 * k2[2][i] + 2 * k3[2][i] + k4[2][i]);
      const nn = 1 / Math.sqrt(x * x + y * y + z * z);
      mx[i] = x * nn; my[i] = y * nn; mz[i] = z * nn;
    }
  }

  normalizeAll() {
    const act = this.act;
    for (let q = 0; q < act.length; q++) {
      const i = act[q];
      const n = Math.sqrt(this.mx[i] * this.mx[i] + this.my[i] * this.my[i] + this.mz[i] * this.mz[i]);
      if (n < 1e-12) { this.mx[i] = 0; this.my[i] = 0; this.mz[i] = 1; continue; }
      this.mx[i] /= n; this.my[i] /= n; this.mz[i] /= n;
    }
  }

  randomize() {
    const act = this.act;
    for (let q = 0; q < act.length; q++) {
      const i = act[q];
      this.mx[i] = Math.random() * 2 - 1;
      this.my[i] = Math.random() * 2 - 1;
      this.mz[i] = Math.random() * 2 - 1;
    }
    this.normalizeAll();
  }

  topoCharge() {
    const act = this.act, L = this.nbL, R = this.nbR, U = this.nbU, D = this.nbD;
    const mx = this.mx, my = this.my, mz = this.mz;
    let s = 0;
    for (let q = 0; q < act.length; q++) {
      const i = act[q];
      const ax = mx[R[i]] - mx[L[i]], ay = my[R[i]] - my[L[i]], az = mz[R[i]] - mz[L[i]];
      const bx = mx[U[i]] - mx[D[i]], by = my[U[i]] - my[D[i]], bz = mz[U[i]] - mz[D[i]];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      s += mx[i] * cx + my[i] * cy + mz[i] * cz;
    }
    return s / 4 / (4 * Math.PI);
  }
}

// ===== noyau/engine.js =====
const HBAR = 1.054571817e-34;
const QE = 1.602176634e-19;
const GAMMA0 = 2.211e5;

function unit3(v) {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (!(n > 0)) return [0, 0, 1];
  return [v[0] / n, v[1] / n, v[2] / n];
}

function isPow2(n) { return n > 0 && (n & (n - 1)) === 0; }

function zlVec(z) {
  if (!z) return [0, 0];
  return z.ux !== undefined ? [z.ux, z.uy || 0] : [z.u || 0, 0];
}

class Engine {
  constructor(g) {
    const n = g.nx * g.ny;
    this.nx = g.nx; this.ny = g.ny; this.n = n;
    this.c = g.c; this.dz = g.dz; this.Ms = g.Ms;
    this.mask = g.mask || null;
    this.px = !!g.px; this.py = !!g.py;
    this.kmul = null; this.kfac = null;
    this.pulses = []; this.Tc = 0; this.Dth = 1e-5;
    this.hot = false; this.sc = null; this.Tl = null; this.kf2 = null;
    this.mx = new Float64Array(n); this.my = new Float64Array(n); this.mz = new Float64Array(n);
    this.sx = new Float64Array(n); this.sy = new Float64Array(n); this.sz = new Float64Array(n);
    this.Bx = new Float64Array(n); this.By = new Float64Array(n); this.Bz = new Float64Array(n);
    this.fx = new Float64Array(n); this.fy = new Float64Array(n); this.fz = new Float64Array(n);
    this.K = [];
    for (let q = 0; q < 4; q++) this.K.push([new Float64Array(n), new Float64Array(n), new Float64Array(n)]);
    this.alpha = new Float64Array(n);
    this.thx = null; this.thy = null; this.thz = null;
    this.L = new Int32Array(n); this.R = new Int32Array(n); this.U = new Int32Array(n); this.D = new Int32Array(n);
    const act = [];
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const id = j * g.nx + i;
        if (!this.mask || this.mask[id]) act.push(id);
        this.L[id] = this.nb(id, i - 1, j, g.px, g.py);
        this.R[id] = this.nb(id, i + 1, j, g.px, g.py);
        this.U[id] = this.nb(id, i, j + 1, g.px, g.py);
        this.D[id] = this.nb(id, i, j - 1, g.px, g.py);
      }
    }
    this.act = Int32Array.from(act);
    this.terms = [];
    this.dyn = { prec: true, gamma0: GAMMA0, alpha: 0.1, edge: 0, zl: null, sl: null };
    this.T = 0;
    this.t = 0;
    this.dt = 1e-13;
    this.hasDemag = false;
    this.P = 0;
    this.rnd = uni(xorshift(20211));
  }

  nb(id, i, j, px, py) {
    const nx = this.nx, ny = this.ny;
    if (i < 0) { if (!px) return id; i = nx - 1; } else if (i >= nx) { if (!px) return id; i = 0; }
    if (j < 0) { if (!py) return id; j = ny - 1; } else if (j >= ny) { if (!py) return id; j = 0; }
    const q = j * nx + i;
    if (this.mask && !this.mask[q]) return id;
    return q;
  }

  gamma() { return (this.dyn.gamma0 || GAMMA0) / MU0; }

  aJ() {
    const s = this.dyn.sl;
    return s ? HBAR * s.J / (QE * this.dz * this.Ms) : 0;
  }

  setup(terms, dyn, T) {
    this.terms = terms;
    this.dyn = dyn;
    this.T = T || 0;
    this.prepare();
  }

  prepare() {
    const c = this.c, Ms = this.Ms, two = this.nx > 1 && this.ny > 1, macro = this.n === 1;
    let stiff = 0, km = 1;
    if (this.kmul) for (let i = 0; i < this.n; i++) if (this.kmul[i] > km) km = this.kmul[i];
    this.hasDemag = false;
    for (let k = 0; k < this.terms.length; k++) {
      const tm = this.terms[k];
      if (tm.kind === 'exchange') { if (!macro) stiff += (two ? 8 : 4) * 2 * Math.abs(tm.A) / (Ms * c * c); }
      else if (tm.kind === 'dmi') { if (!macro) stiff += 4 * Math.abs(tm.D) / (Ms * c); }
      else if (tm.kind === 'uniaxial') { tm._u = unit3(tm.u); stiff += 2 * km * Math.abs(tm.K) / Ms; }
      else if (tm.kind === 'cubic') {
        const a = unit3(tm.u1);
        let b = unit3(tm.u2);
        const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        b = unit3([b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]]);
        tm._u1 = a; tm._u2 = b;
        tm._u3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        stiff += 4 * km * Math.abs(tm.K) / Ms;
      } else if (tm.kind === 'zeeman') {
        const h = Math.sqrt(tm.H[0] * tm.H[0] + tm.H[1] * tm.H[1] + tm.H[2] * tm.H[2]);
        stiff += MU0 * (tm.phone ? 5 * Math.max(h, 8e4) : h);
        tm._w = null;
        if (tm.region === 'band') {
          const w = new Float64Array(this.n);
          for (let j = 0; j < this.ny; j++) {
            for (let i = 0; i < this.nx; i++) {
              const x = (i + 0.5) * c;
              w[j * this.nx + i] = Math.abs(x - tm.x0) <= tm.w / 2 ? 1 : 0;
            }
          }
          tm._w = w;
        }
      } else if (tm.kind === 'demag') { stiff += MU0 * Ms; this.hasDemag = true; }
    }
    const d = this.dyn;
    if (d.zl) { const u = zlVec(d.zl); stiff += (Math.abs(u[0]) + Math.abs(u[1])) / (c * this.gamma()); }
    if (d.sl) stiff += Math.abs(this.aJ()) * Math.max(1, d.sl.P || 1);
    stiff = Math.max(stiff, 1e-3);
    this.stiff = stiff;
    this.dt = 0.95 / (this.gamma() * stiff);
    this.fillAlpha();
    if (!this.hot) this.kfac = this.kmul;
    if (this.hasDemag) this.ensureDemag();
  }

  setKmul(a) {
    this.kmul = a;
    if (!this.hot) this.kfac = a;
    this.prepare();
  }

  msRel(T) {
    const Tc = this.Tc;
    if (!(Tc > 0)) return 1;
    const f = function (x) { return x >= Tc ? 0 : Math.pow(1 - x / Tc, 0.36); };
    const m0 = Math.max(f(this.T), 1e-3);
    return Math.max(f(T) / m0, 0.02);
  }

  laser(x, y, w, dT, tau) {
    if (this.pulses.length > 7) this.pulses.shift();
    this.pulses.push({ x: x, y: y, w: w, dT: dT, tau: tau, t0: this.t });
  }

  peakT() {
    if (!this.hot) return this.T;
    let m = 0;
    for (let i = 0; i < this.n; i++) if (this.Tl[i] > m) m = this.Tl[i];
    return m;
  }

  coolDown() {
    this.hot = false;
    this.kfac = this.kmul;
  }

  updateHeat() {
    const ps = this.pulses;
    if (!ps.length) { if (this.hot) this.coolDown(); return; }
    const n = this.n, nx = this.nx, ny = this.ny, c = this.c, t = this.t, live = [], keep = [];
    for (let k = 0; k < ps.length; k++) {
      const q = ps[k], dt = Math.max(0, t - q.t0), w2 = q.w * q.w + 8 * this.Dth * dt;
      const a = q.dT * (q.w * q.w / w2) * Math.exp(-dt / q.tau);
      if (a > 0.5) { keep.push(q); live.push([q.x, q.y, w2, a]); }
    }
    this.pulses = keep;
    if (!live.length) { this.coolDown(); return; }
    if (!this.sc) { this.sc = new Float64Array(n); this.Tl = new Float64Array(n); this.kf2 = new Float64Array(n); }
    const sc = this.sc, Tl = this.Tl, kf = this.kf2, km = this.kmul;
    for (let j = 0; j < ny; j++) {
      const y = (j + 0.5) * c;
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * c, id = j * nx + i;
        let T = this.T;
        for (let k = 0; k < live.length; k++) {
          const L = live[k], dx = x - L[0], dy = y - L[1];
          T += L[3] * Math.exp(-2 * (dx * dx + dy * dy) / L[2]);
        }
        const m = this.msRel(T);
        Tl[id] = T; sc[id] = m; kf[id] = (km ? km[id] : 1) * m * m;
      }
    }
    this.hot = true;
    this.kfac = kf;
  }

  fillAlpha() {
    const d = this.dyn, a0 = d.alpha, ew = d.edge || 0, c = this.c, nx = this.nx, ny = this.ny;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let a = a0;
        if (ew > 0) {
          const x = (i + 0.5) * c, y = (j + 0.5) * c, Lx = nx * c, Ly = ny * c;
          let dist = Math.min(x, Lx - x);
          if (ny > 1) dist = Math.min(dist, y, Ly - y);
          const s = clamp((ew - dist) / ew, 0, 1);
          a = a0 + (0.5 - a0) * s * s;
        }
        this.alpha[j * nx + i] = a;
      }
    }
  }

  ensureDemag() {
    const per = this.px && this.py && isPow2(this.nx) && isPow2(this.ny);
    let Px = this.nx, Py = this.ny;
    if (!per) {
      Px = 2; while (Px < 2 * this.nx) Px <<= 1;
      Py = 2; while (Py < 2 * this.ny) Py <<= 1;
    }
    if (this.Px === Px && this.Py === Py && this.gz) {
      if (this._kt !== this.dz) this.buildKernel();
      return;
    }
    this.Px = Px; this.Py = Py; this.per = per; this.P = Px;
    this.fft2 = makeFFT2R(Px, Py);
    const PP = Px * Py;
    this.r1 = new Float64Array(PP); this.i1 = new Float64Array(PP);
    this.r2 = new Float64Array(PP); this.i2 = new Float64Array(PP);
    this.r3 = new Float64Array(PP); this.i3 = new Float64Array(PP);
    this.gxx = new Float64Array(PP); this.gxy = new Float64Array(PP);
    this.gyy = new Float64Array(PP); this.gz = new Float64Array(PP);
    this.hdx = new Float64Array(this.n); this.hdy = new Float64Array(this.n); this.hdz = new Float64Array(this.n);
    this.buildKernel();
  }

  buildKernel() {
    const Px = this.Px, Py = this.Py, c = this.c, t = this.dz;
    this._kt = t;
    for (let ky = 0; ky < Py; ky++) {
      const iy = ky < Py / 2 ? ky : ky - Py, kyv = TAU * iy / (Py * c);
      for (let kx = 0; kx < Px; kx++) {
        const ix = kx < Px / 2 ? kx : kx - Px, kxv = TAU * ix / (Px * c);
        const p = ky * Px + kx, k2 = kxv * kxv + kyv * kyv;
        if (k2 === 0) {
          this.gxx[p] = 0; this.gxy[p] = 0; this.gyy[p] = 0; this.gz[p] = -1;
          continue;
        }
        const k = Math.sqrt(k2), f = (1 - Math.exp(-k * t)) / (k * t), w = (1 - f) / k2;
        this.gxx[p] = -w * kxv * kxv;
        this.gxy[p] = -w * kxv * kyv;
        this.gyy[p] = -w * kyv * kyv;
        this.gz[p] = -f;
      }
    }
  }

  updateDemag(ax, ay, az) {
    const Px = this.Px, Py = this.Py, nx = this.nx, ny = this.ny, mask = this.mask, sc = this.hot ? this.sc : null;
    const r1 = this.r1, i1 = this.i1, r2 = this.r2, i2 = this.i2, r3 = this.r3, i3 = this.i3;
    r1.fill(0); i1.fill(0); r2.fill(0); i2.fill(0);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i;
        if (mask && !mask[id]) continue;
        const p = j * Px + i, w = sc ? sc[id] : 1;
        r1[p] = w * ax[id]; i1[p] = w * ay[id]; r2[p] = w * az[id];
      }
    }
    this.fft2(r1, i1, false);
    this.fft2(r2, i2, false);
    const gxx = this.gxx, gxy = this.gxy, gyy = this.gyy, gz = this.gz;
    for (let ky = 0; ky < Py; ky++) {
      const qy = ((Py - ky) % Py) * Px;
      for (let kx = 0; kx < Px; kx++) {
        const p = ky * Px + kx, q = qy + ((Px - kx) % Px);
        const ar = r1[p], ai = i1[p], br = r1[q], bi = -i1[q];
        const mxr = 0.5 * (ar + br), mxi = 0.5 * (ai + bi);
        const myr = 0.5 * (ai - bi), myi = -0.5 * (ar - br);
        const hxr = gxx[p] * mxr + gxy[p] * myr, hxi = gxx[p] * mxi + gxy[p] * myi;
        const hyr = gxy[p] * mxr + gyy[p] * myr, hyi = gxy[p] * mxi + gyy[p] * myi;
        r3[p] = hxr - hyi; i3[p] = hxi + hyr;
        r2[p] *= gz[p]; i2[p] *= gz[p];
      }
    }
    this.fft2(r3, i3, true);
    this.fft2(r2, i2, true);
    const s = MU0 * this.Ms;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i, p = j * Px + i;
        if (mask && !mask[id]) { this.hdx[id] = 0; this.hdy[id] = 0; this.hdz[id] = 0; continue; }
        this.hdx[id] = s * r3[p]; this.hdy[id] = s * i3[p]; this.hdz[id] = s * r2[p];
      }
    }
  }

  zfun(tm, t) {
    if (tm.func === 'sin') return Math.sin(TAU * tm.f * (t - tm.t0));
    if (tm.func === 'sinc') {
      const x = TAU * tm.f * (t - tm.t0);
      return Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x;
    }
    if (tm.func === 'window') return (t >= tm.t0 && t < tm.t0 + tm.tw) ? 1 : 0;
    if (tm.func === 'ramp') return t < tm.t0 ? 0 : Math.min(1, (t - tm.t0) / Math.max(tm.tw, 1e-15));
    if (tm.func === 'gauss') { const x = (t - tm.t0) / Math.max(tm.tw, 1e-15); return Math.exp(-0.5 * x * x); }
    return 1;
  }

  fieldInto(ax, ay, az, t, Bx, By, Bz, only) {
    const act = this.act, na = act.length, L = this.L, R = this.R, U = this.U, D = this.D;
    const Ms = this.Ms, c = this.c, macro = this.n === 1, hot = this.hot, sc = this.sc, kf = this.kfac;
    for (let q = 0; q < na; q++) { const i = act[q]; Bx[i] = 0; By[i] = 0; Bz[i] = 0; }
    for (let k = 0; k < this.terms.length; k++) {
      if (only >= 0 && k !== only) continue;
      const tm = this.terms[k];
      if (tm.kind === 'exchange') {
        if (macro) continue;
        const f = 2 * tm.A / (Ms * c * c);
        if (hot) {
          for (let q = 0; q < na; q++) {
            const i = act[q], l = L[i], r = R[i], u = U[i], d = D[i];
            const wl = sc[l], wr = sc[r], wu = sc[u], wd = sc[d], x = ax[i], y = ay[i], z = az[i];
            Bx[i] += f * (wl * (ax[l] - x) + wr * (ax[r] - x) + wu * (ax[u] - x) + wd * (ax[d] - x));
            By[i] += f * (wl * (ay[l] - y) + wr * (ay[r] - y) + wu * (ay[u] - y) + wd * (ay[d] - y));
            Bz[i] += f * (wl * (az[l] - z) + wr * (az[r] - z) + wu * (az[u] - z) + wd * (az[d] - z));
          }
          continue;
        }
        for (let q = 0; q < na; q++) {
          const i = act[q], l = L[i], r = R[i], u = U[i], d = D[i];
          Bx[i] += f * (ax[l] + ax[r] + ax[u] + ax[d] - 4 * ax[i]);
          By[i] += f * (ay[l] + ay[r] + ay[u] + ay[d] - 4 * ay[i]);
          Bz[i] += f * (az[l] + az[r] + az[u] + az[d] - 4 * az[i]);
        }
      } else if (tm.kind === 'dmi') {
        if (macro) continue;
        const f = tm.D / (Ms * c);
        if (tm.cls === 'T') {
          for (let q = 0; q < na; q++) {
            const i = act[q], l = L[i], r = R[i], u = U[i], d = D[i], g = hot ? f * sc[i] : f;
            Bx[i] -= g * (az[u] - az[d]);
            By[i] += g * (az[r] - az[l]);
            Bz[i] -= g * ((ay[r] - ay[l]) - (ax[u] - ax[d]));
          }
        } else {
          for (let q = 0; q < na; q++) {
            const i = act[q], l = L[i], r = R[i], u = U[i], d = D[i], g = hot ? f * sc[i] : f;
            Bx[i] += g * (az[r] - az[l]);
            By[i] += g * (az[u] - az[d]);
            Bz[i] -= g * ((ax[r] - ax[l]) + (ay[u] - ay[d]));
          }
        }
      } else if (tm.kind === 'uniaxial') {
        const f = 2 * tm.K / Ms, u = tm._u || unit3(tm.u);
        for (let q = 0; q < na; q++) {
          const i = act[q], p = (kf ? f * kf[i] : f) * (ax[i] * u[0] + ay[i] * u[1] + az[i] * u[2]);
          Bx[i] += p * u[0]; By[i] += p * u[1]; Bz[i] += p * u[2];
        }
      } else if (tm.kind === 'cubic') {
        const f = 4 * tm.K / Ms, a = tm._u1, b = tm._u2, e = tm._u3;
        for (let q = 0; q < na; q++) {
          const i = act[q], x = ax[i], y = ay[i], z = az[i];
          const p1 = x * a[0] + y * a[1] + z * a[2], p2 = x * b[0] + y * b[1] + z * b[2], p3 = x * e[0] + y * e[1] + z * e[2];
          const g = kf ? f * kf[i] : f, c1 = g * p1 * p1 * p1, c2 = g * p2 * p2 * p2, c3 = g * p3 * p3 * p3;
          Bx[i] += c1 * a[0] + c2 * b[0] + c3 * e[0];
          By[i] += c1 * a[1] + c2 * b[1] + c3 * e[1];
          Bz[i] += c1 * a[2] + c2 * b[2] + c3 * e[2];
        }
      } else if (tm.kind === 'zeeman') {
        const g = this.zfun(tm, t);
        if (g === 0) continue;
        const H = tm.Hnow || tm.H, bx = MU0 * H[0] * g, by = MU0 * H[1] * g, bz = MU0 * H[2] * g, w = tm._w;
        for (let q = 0; q < na; q++) {
          const i = act[q], s = w ? w[i] : 1;
          if (s === 0) continue;
          Bx[i] += s * bx; By[i] += s * by; Bz[i] += s * bz;
        }
      } else if (tm.kind === 'demag') {
        const hx = this.hdx, hy = this.hdy, hz = this.hdz;
        for (let q = 0; q < na; q++) {
          const i = act[q];
          Bx[i] += hx[i]; By[i] += hy[i]; Bz[i] += hz[i];
        }
      }
    }
  }

  thermal(dt) {
    const n = this.n;
    if (!this.thx) { this.thx = new Float64Array(n); this.thy = new Float64Array(n); this.thz = new Float64Array(n); }
    const V = this.c * this.c * this.dz, g = this.gamma(), act = this.act, u = this.rnd;
    const Tl = this.hot ? this.Tl : null, sc = this.hot ? this.sc : null;
    for (let q = 0; q < act.length; q++) {
      const i = act[q], T = Tl ? Tl[i] : this.T;
      if (!(T > 0)) { this.thx[i] = 0; this.thy[i] = 0; this.thz[i] = 0; continue; }
      const s = Math.sqrt(2 * Math.max(this.alpha[i], 1e-4) * KB * T / (g * this.Ms * (sc ? Math.max(sc[i], 0.05) : 1) * V * dt));
      this.thx[i] = s * gauss(u); this.thy[i] = s * gauss(u); this.thz[i] = s * gauss(u);
    }
  }

  deriv(ax, ay, az, t, ox, oy, oz, relax, th) {
    this.fieldInto(ax, ay, az, t, this.Bx, this.By, this.Bz, -1);
    const act = this.act, na = act.length, Bx = this.Bx, By = this.By, Bz = this.Bz, al = this.alpha;
    const g = this.gamma(), d = this.dyn, prec = d.prec;
    const zu = zlVec(d.zl), zl = !relax && d.zl && (zu[0] !== 0 || zu[1] !== 0) ? d.zl : null, sl = !relax && d.sl && d.sl.J !== 0 ? d.sl : null;
    const L = this.L, R = this.R, Uu = this.U, Dd = this.D, i2 = 1 / (2 * this.c), zux = zu[0], zuy = zu[1];
    const aj = sl ? this.aJ() : 0, mp = sl ? unit3(sl.mp) : null, P = sl ? sl.P : 0, Lam2 = sl ? sl.Lambda * sl.Lambda : 1, ep = sl ? (sl.eps || 0) : 0;
    const useTh = th && this.thx;
    for (let q = 0; q < na; q++) {
      const i = act[q], x = ax[i], y = ay[i], z = az[i];
      let bx = Bx[i], by = By[i], bz = Bz[i];
      if (useTh) { bx += this.thx[i]; by += this.thy[i]; bz += this.thz[i]; }
      const cx = y * bz - z * by, cy = z * bx - x * bz, cz = x * by - y * bx;
      const ex = y * cz - z * cy, ey = z * cx - x * cz, ez = x * cy - y * cx;
      if (relax) { ox[i] = -g * ex; oy[i] = -g * ey; oz[i] = -g * ez; continue; }
      const a = al[i], inv = 1 / (1 + a * a), k = g * inv;
      let tx = -k * a * ex, ty = -k * a * ey, tz = -k * a * ez;
      if (prec) { tx -= k * cx; ty -= k * cy; tz -= k * cz; }
      let Tx = 0, Ty = 0, Tz = 0;
      if (zl) {
        const l = L[i], r = R[i], uu = Uu[i], dd = Dd[i], beta = zl.beta;
        const Dx = (zux * (ax[r] - ax[l]) + zuy * (ax[uu] - ax[dd])) * i2;
        const Dy = (zux * (ay[r] - ay[l]) + zuy * (ay[uu] - ay[dd])) * i2;
        const Dz = (zux * (az[r] - az[l]) + zuy * (az[uu] - az[dd])) * i2;
        const wx = y * Dz - z * Dy, wy = z * Dx - x * Dz, wz = x * Dy - y * Dx;
        Tx += -Dx + beta * wx; Ty += -Dy + beta * wy; Tz += -Dz + beta * wz;
      }
      if (sl) {
        const mdp = x * mp[0] + y * mp[1] + z * mp[2];
        const eps = P * Lam2 / ((Lam2 + 1) + (Lam2 - 1) * mdp);
        const px = mp[0] - mdp * x, py = mp[1] - mdp * y, pz = mp[2] - mdp * z;
        const qx = y * mp[2] - z * mp[1], qy = z * mp[0] - x * mp[2], qz = x * mp[1] - y * mp[0];
        Tx += g * aj * (eps * px - ep * qx);
        Ty += g * aj * (eps * py - ep * qy);
        Tz += g * aj * (eps * pz - ep * qz);
      }
      if (zl || sl) {
        const mx2 = y * Tz - z * Ty, my2 = z * Tx - x * Tz, mz2 = x * Ty - y * Tx;
        tx += inv * (Tx + a * mx2); ty += inv * (Ty + a * my2); tz += inv * (Tz + a * mz2);
      }
      ox[i] = tx; oy[i] = ty; oz[i] = tz;
    }
  }

  rk4(dt, relax) {
    const act = this.act, na = act.length;
    const mx = this.mx, my = this.my, mz = this.mz, sx = this.sx, sy = this.sy, sz = this.sz;
    const k1 = this.K[0], k2 = this.K[1], k3 = this.K[2], k4 = this.K[3];
    if (!relax) this.updateHeat(); else if (this.hot) this.coolDown();
    const t = this.t, h2 = 0.5 * dt, th = !relax && (this.T > 0 || this.hot);
    if (this.hasDemag) this.updateDemag(mx, my, mz);
    if (th) this.thermal(dt);
    this.deriv(mx, my, mz, t, k1[0], k1[1], k1[2], relax, th);
    for (let q = 0; q < na; q++) { const i = act[q]; sx[i] = mx[i] + h2 * k1[0][i]; sy[i] = my[i] + h2 * k1[1][i]; sz[i] = mz[i] + h2 * k1[2][i]; }
    this.deriv(sx, sy, sz, t + h2, k2[0], k2[1], k2[2], relax, th);
    for (let q = 0; q < na; q++) { const i = act[q]; sx[i] = mx[i] + h2 * k2[0][i]; sy[i] = my[i] + h2 * k2[1][i]; sz[i] = mz[i] + h2 * k2[2][i]; }
    this.deriv(sx, sy, sz, t + h2, k3[0], k3[1], k3[2], relax, th);
    for (let q = 0; q < na; q++) { const i = act[q]; sx[i] = mx[i] + dt * k3[0][i]; sy[i] = my[i] + dt * k3[1][i]; sz[i] = mz[i] + dt * k3[2][i]; }
    this.deriv(sx, sy, sz, t + dt, k4[0], k4[1], k4[2], relax, th);
    const d6 = dt / 6;
    for (let q = 0; q < na; q++) {
      const i = act[q];
      const x = mx[i] + d6 * (k1[0][i] + 2 * k2[0][i] + 2 * k3[0][i] + k4[0][i]);
      const y = my[i] + d6 * (k1[1][i] + 2 * k2[1][i] + 2 * k3[1][i] + k4[1][i]);
      const z = mz[i] + d6 * (k1[2][i] + 2 * k2[2][i] + 2 * k3[2][i] + k4[2][i]);
      const nn = 1 / Math.sqrt(x * x + y * y + z * z);
      mx[i] = x * nn; my[i] = y * nn; mz[i] = z * nn;
    }
    if (!relax) this.t += dt;
  }

  step(dt) { this.rk4(dt, false); }

  relax(nsteps) {
    const dt = 2.2 / (this.gamma() * this.stiff);
    for (let s = 0; s < nsteps; s++) this.rk4(dt, true);
  }

  fields(only) {
    if (this.hasDemag) this.updateDemag(this.mx, this.my, this.mz);
    this.fieldInto(this.mx, this.my, this.mz, this.t, this.fx, this.fy, this.fz, only === undefined ? -1 : only);
    return [this.fx, this.fy, this.fz];
  }

  maxTorque() {
    const f = this.fields(-1), act = this.act, mx = this.mx, my = this.my, mz = this.mz;
    let mt = 0;
    for (let q = 0; q < act.length; q++) {
      const i = act[q], x = mx[i], y = my[i], z = mz[i], bx = f[0][i], by = f[1][i], bz = f[2][i];
      const cx = y * bz - z * by, cy = z * bx - x * bz, cz = x * by - y * bx;
      const v = cx * cx + cy * cy + cz * cz;
      if (v > mt) mt = v;
    }
    return Math.sqrt(mt);
  }

  energies() {
    if (this.hasDemag) this.updateDemag(this.mx, this.my, this.mz);
    const V = this.c * this.c * this.dz, Ms = this.Ms, act = this.act, mx = this.mx, my = this.my, mz = this.mz;
    const out = [];
    let tot = 0;
    for (let k = 0; k < this.terms.length; k++) {
      const tm = this.terms[k];
      let E = 0;
      if (tm.kind === 'cubic') {
        const a = tm._u1, b = tm._u2, e = tm._u3;
        for (let q = 0; q < act.length; q++) {
          const i = act[q], x = mx[i], y = my[i], z = mz[i];
          const p1 = x * a[0] + y * a[1] + z * a[2], p2 = x * b[0] + y * b[1] + z * b[2], p3 = x * e[0] + y * e[1] + z * e[2];
          E -= tm.K * (p1 * p1 * p1 * p1 + p2 * p2 * p2 * p2 + p3 * p3 * p3 * p3) * V;
        }
      } else {
        this.fieldInto(mx, my, mz, this.t, this.fx, this.fy, this.fz, k);
        let s = 0;
        for (let q = 0; q < act.length; q++) { const i = act[q]; s += mx[i] * this.fx[i] + my[i] * this.fy[i] + mz[i] * this.fz[i]; }
        E = (tm.kind === 'zeeman' ? -1 : -0.5) * Ms * V * s;
      }
      out.push(E);
      tot += E;
    }
    return { total: tot, terms: out };
  }

  mean() {
    const act = this.act, na = act.length || 1;
    let x = 0, y = 0, z = 0;
    for (let q = 0; q < act.length; q++) { const i = act[q]; x += this.mx[i]; y += this.my[i]; z += this.mz[i]; }
    return [x / na, y / na, z / na];
  }

  topoCharge() {
    if (this.nx < 2 || this.ny < 2) return 0;
    const act = this.act, L = this.L, R = this.R, U = this.U, D = this.D, mx = this.mx, my = this.my, mz = this.mz;
    let s = 0;
    for (let q = 0; q < act.length; q++) {
      const i = act[q];
      const ax = mx[R[i]] - mx[L[i]], ay = my[R[i]] - my[L[i]], az = mz[R[i]] - mz[L[i]];
      const bx = mx[U[i]] - mx[D[i]], by = my[U[i]] - my[D[i]], bz = mz[U[i]] - mz[D[i]];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      s += mx[i] * cx + my[i] * cy + mz[i] * cz;
    }
    return s / 4 / (4 * Math.PI);
  }

  snapshot() {
    const n = this.n, s = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) { s[3 * i] = this.mx[i]; s[3 * i + 1] = this.my[i]; s[3 * i + 2] = this.mz[i]; }
    return s;
  }
}

// ===== vue/viz.js =====
class Plot {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.box = { l: 52, t: 26, r: 14, b: 34 };
    this.xmin = 0; this.xmax = 1; this.ymin = 0; this.ymax = 1;
    this.W = 300; this.H = 160; this.pw = 200; this.ph = 100;
  }

  begin(title, xmin, xmax, ymin, ymax, xlab, ylab) {
    const c = this.c, ctx = this.ctx, dpr = c._dpr || 1;
    const W = c._w || c.clientWidth || 300, H = c._h || c.clientHeight || 160;
    this.W = W; this.H = H;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!(xmax > xmin)) xmax = xmin + 1;
    if (!(ymax > ymin)) ymax = ymin + 1;
    this.xmin = xmin; this.xmax = xmax; this.ymin = ymin; this.ymax = ymax;
    const b = this.box;
    this.pw = Math.max(10, W - b.l - b.r);
    this.ph = Math.max(10, H - b.t - b.b);
    ctx.fillStyle = PAL.ink;
    ctx.font = fnt(12.5, 700);
    ctx.textAlign = 'left';
    ctx.fillText(title, b.l, 16);
    const sx = niceStep(xmax - xmin, Math.max(3, Math.round(this.pw / 70))), sy = niceStep(ymax - ymin, 4);
    ctx.lineWidth = 1;
    ctx.font = fnt(11, 400);
    ctx.textAlign = 'center';
    const x0 = Math.ceil(xmin / sx - 1e-9) * sx;
    for (let i = 0; i < 80; i++) {
      const v = x0 + i * sx;
      if (v > xmax + sx * 1e-6) break;
      const x = this.X(v);
      ctx.strokeStyle = 'rgba(23,20,15,0.07)';
      ctx.beginPath(); ctx.moveTo(x, b.t); ctx.lineTo(x, b.t + this.ph); ctx.stroke();
      ctx.fillStyle = PAL.ink3;
      ctx.fillText(tickLabel(v), x, b.t + this.ph + 14);
    }
    ctx.textAlign = 'right';
    const y0 = Math.ceil(ymin / sy - 1e-9) * sy;
    for (let i = 0; i < 80; i++) {
      const v = y0 + i * sy;
      if (v > ymax + sy * 1e-6) break;
      const y = this.Y(v);
      ctx.strokeStyle = Math.abs(v) < sy * 1e-6 ? 'rgba(23,20,15,0.35)' : 'rgba(23,20,15,0.07)';
      ctx.beginPath(); ctx.moveTo(b.l, y); ctx.lineTo(b.l + this.pw, y); ctx.stroke();
      ctx.fillStyle = PAL.ink3;
      ctx.fillText(tickLabel(v), b.l - 6, y + 4);
    }
    ctx.fillStyle = PAL.ink2;
    ctx.textAlign = 'center';
    if (xlab) ctx.fillText(xlab, b.l + this.pw / 2, H - 5);
    if (ylab) {
      ctx.save();
      ctx.translate(12, b.t + this.ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(ylab, 0, 0);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(23,20,15,0.6)';
    ctx.strokeRect(b.l + 0.5, b.t + 0.5, this.pw, this.ph);
  }

  X(v) { return this.box.l + (v - this.xmin) / (this.xmax - this.xmin) * this.pw; }
  Y(v) { return this.box.t + (1 - (v - this.ymin) / (this.ymax - this.ymin)) * this.ph; }
  invX(px) { return this.xmin + (px - this.box.l) / this.pw * (this.xmax - this.xmin); }
  invY(py) { return this.ymin + (1 - (py - this.box.t) / this.ph) * (this.ymax - this.ymin); }

  clip() {
    const ctx = this.ctx, b = this.box;
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.l, b.t, this.pw, this.ph);
    ctx.clip();
  }
  unclip() { this.ctx.restore(); }

  line(xs, ys, col, lw, dash) {
    const ctx = this.ctx, n = Math.min(xs.length, ys.length);
    if (n < 2) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw || 2;
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash ? [5, 4] : []);
    ctx.beginPath();
    ctx.moveTo(this.X(xs[0]), this.Y(ys[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(this.X(xs[i]), this.Y(ys[i]));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  dots(xs, ys, col, r) {
    const ctx = this.ctx, n = Math.min(xs.length, ys.length), rr = r || 3;
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(this.X(xs[i]), this.Y(ys[i]), rr, 0, TAU);
      ctx.fill();
    }
  }

  dot(x, y, col, r) {
    const ctx = this.ctx;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(this.X(x), this.Y(y), r || 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PAL.card;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  vline(x, col, dash, label) {
    const ctx = this.ctx, b = this.box, px = this.X(x);
    if (px < b.l || px > b.l + this.pw) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash ? [5, 4] : []);
    ctx.beginPath(); ctx.moveTo(px, b.t); ctx.lineTo(px, b.t + this.ph); ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
      ctx.fillStyle = col;
      ctx.font = fnt(11, 700);
      ctx.textAlign = 'left';
      ctx.fillText(label, px + 4, b.t + 13);
    }
  }

  hline(y, col, dash, label) {
    const ctx = this.ctx, b = this.box, py = this.Y(y);
    if (py < b.t || py > b.t + this.ph) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash ? [5, 4] : []);
    ctx.beginPath(); ctx.moveTo(b.l, py); ctx.lineTo(b.l + this.pw, py); ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
      ctx.fillStyle = col;
      ctx.font = fnt(11, 700);
      ctx.textAlign = 'right';
      ctx.fillText(label, b.l + this.pw - 4, py - 4);
    }
  }

  text(s, x, y, col, align) {
    const ctx = this.ctx;
    ctx.fillStyle = col || PAL.ink2;
    ctx.font = fnt(11.5, 400);
    ctx.textAlign = align || 'left';
    ctx.fillText(s, x, y);
  }

  legend(defs) {
    const ctx = this.ctx;
    let x = this.W - this.box.r - 4;
    ctx.font = fnt(11, 700);
    ctx.textAlign = 'right';
    for (let i = defs.length - 1; i >= 0; i--) {
      const d = defs[i], w = ctx.measureText(d.label).width;
      ctx.fillStyle = PAL.ink2;
      ctx.fillText(d.label, x, 16);
      ctx.fillStyle = d.col;
      ctx.fillRect(x - w - 16, 11, 11, 4);
      x -= w + 26;
    }
  }
}

function drawSphere(ctx, W, H, view, it) {
  const R = Math.min(W, H) * 0.34, cx = (it.cx !== undefined ? it.cx : W * 0.5), cy = H * 0.53;
  const cyw = Math.cos(view.yaw), syw = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const P = function (x, y, z) {
    const x1 = x * cyw - y * syw, y1 = x * syw + y * cyw;
    return [cx + R * x1, cy - R * (y1 * sp + z * cp), -y1 * cp + z * sp];
  };
  ctx.fillStyle = 'rgba(23,20,15,0.07)';
  ctx.beginPath(); ctx.ellipse(cx, cy + R * 1.1, R * 0.78, R * 0.1, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.05, cx, cy, R);
  g.addColorStop(0, 'rgba(255,255,255,0.98)');
  g.addColorStop(1, 'rgba(216,207,191,0.6)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(23,20,15,0.55)';
  ctx.stroke();

  const ring = function (f, colFront, colBack) {
    let prev = P.apply(null, f(0));
    for (let i = 1; i <= 96; i++) {
      const cur = P.apply(null, f(TAU * i / 96));
      ctx.strokeStyle = (prev[2] + cur[2]) > 0 ? colFront : colBack;
      ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(cur[0], cur[1]); ctx.stroke();
      prev = cur;
    }
  };
  ctx.lineWidth = 1;
  ring(function (a) { return [Math.cos(a), Math.sin(a), 0]; }, 'rgba(23,20,15,0.42)', 'rgba(23,20,15,0.10)');
  ring(function (a) { return [Math.cos(a), 0, Math.sin(a)]; }, 'rgba(23,20,15,0.22)', 'rgba(23,20,15,0.06)');
  ring(function (a) { return [0, Math.cos(a), Math.sin(a)]; }, 'rgba(23,20,15,0.22)', 'rgba(23,20,15,0.06)');
  ring(function (a) { return [0.7071 * Math.cos(a), 0.7071 * Math.sin(a), 0.7071]; }, 'rgba(23,20,15,0.13)', 'rgba(23,20,15,0.04)');
  ring(function (a) { return [0.7071 * Math.cos(a), 0.7071 * Math.sin(a), -0.7071]; }, 'rgba(23,20,15,0.13)', 'rgba(23,20,15,0.04)');

  ctx.font = fnt(13, 700);
  ctx.textAlign = 'center';
  const axes = it.axes || [[1.32, 0, 0, 'x'], [0, 1.32, 0, 'y'], [0, 0, 1.32, 'z']];
  for (let k = 0; k < 3; k++) {
    const a = axes[k], p0 = P(-a[0] / 1.32 * 1.15, -a[1] / 1.32 * 1.15, -a[2] / 1.32 * 1.15), p1 = P(a[0] / 1.32 * 1.15, a[1] / 1.32 * 1.15, a[2] / 1.32 * 1.15);
    ctx.strokeStyle = 'rgba(23,20,15,0.22)';
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    const pl = P(a[0], a[1], a[2]);
    ctx.fillStyle = PAL.ink3;
    ctx.fillText(a[3], pl[0], pl[1] + 4);
  }

  const arrow = function (a, b, col, lw, o) {
    o = o || {};
    const p0 = P(a[0], a[1], a[2]), p1 = P(b[0], b[1], b[2]);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.setLineDash(o.dash ? [6, 5] : []);
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / L, uy = dy / L, hs = o.head || 11;
    if (!o.nohead) {
      ctx.beginPath();
      ctx.moveTo(p1[0] + ux * hs * 0.6, p1[1] + uy * hs * 0.6);
      ctx.lineTo(p1[0] - ux * hs + uy * hs * 0.5, p1[1] - uy * hs - ux * hs * 0.5);
      ctx.lineTo(p1[0] - ux * hs - uy * hs * 0.5, p1[1] - uy * hs + ux * hs * 0.5);
      ctx.closePath(); ctx.fill();
    }
    if (o.label) {
      ctx.font = fnt(14, 700, FONTD);
      ctx.textAlign = 'center';
      ctx.fillText(o.label, p1[0] + ux * 18, p1[1] + uy * 18 + 5);
    }
  };

  const vecs = it.vecs || [];
  for (let k = 0; k < vecs.length; k++) {
    const v = vecs[k];
    if (v.axis) arrow([-v.v[0], -v.v[1], -v.v[2]], v.v, rgba(PAL.ink, 0.45), 1.5, { dash: true, nohead: true, label: v.label });
    else arrow([0, 0, 0], v.v, v.col, 3.2, { label: v.label, head: 12 });
  }

  const tr = it.trail || [];
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let i = 1; i < tr.length; i++) {
    const a = P(tr[i - 1][0], tr[i - 1][1], tr[i - 1][2]), b = P(tr[i][0], tr[i][1], tr[i][2]);
    const f = i / tr.length, c = lerp3([31, 78, 156], [215, 48, 31], (clamp(tr[i][2], -1, 1) + 1) / 2);
    ctx.strokeStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (Math.pow(f, 1.5) * 0.85).toFixed(3) + ')';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.lineCap = 'butt';

  const m = it.m;
  if (m) {
    arrow([0, 0, 0], [m[0], m[1], 0], 'rgba(23,20,15,0.25)', 1.2, { dash: true, nohead: true });
    arrow([m[0], m[1], 0], [m[0], m[1], m[2]], 'rgba(23,20,15,0.25)', 1.2, { dash: true, nohead: true });
    const pf = P(m[0], m[1], 0);
    ctx.fillStyle = 'rgba(23,20,15,0.3)';
    ctx.beginPath(); ctx.arc(pf[0], pf[1], 3, 0, TAU); ctx.fill();
    arrow([-0.26 * m[0], -0.26 * m[1], -0.26 * m[2]], [0, 0, 0], PAL.blue, 7, { nohead: true });
    arrow([0, 0, 0], m, PAL.red, 4.6, { head: 15, label: it.mLabel === undefined ? 'm' : it.mLabel });
    const pc = P(0, 0, 0);
    ctx.fillStyle = PAL.ink;
    ctx.beginPath(); ctx.arc(pc[0], pc[1], 4.2, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.card;
    ctx.beginPath(); ctx.arc(pc[0], pc[1], 1.6, 0, TAU); ctx.fill();
  }
}

class FilmView {
  constructor(nx, ny) {
    this.nx = nx; this.ny = ny;
    this.off = document.createElement('canvas');
    this.off.width = nx; this.off.height = ny;
    this.octx = this.off.getContext('2d');
    this.img = this.octx.createImageData(nx, ny);
    this.vmax = 0.02;
    this.lay = { x0: 0, y0: 0, s: 1 };
  }

  paint(core, mode) {
    const nx = this.nx, ny = this.ny, d = this.img.data;
    const mx = core.mx, my = core.my, mz = core.mz, mask = core.mask;
    let comp = null;
    if (mode === 'mx') comp = mx; else if (mode === 'my') comp = my; else if (mode === 'mz') comp = mz;
    if (comp && mode !== 'mz') {
      let vm = 0;
      for (let i = 0; i < core.n; i++) { const a = Math.abs(comp[i]); if (a > vm) vm = a; }
      this.vmax = Math.max(this.vmax * 0.985, vm, 0.01);
    } else {
      this.vmax = 1;
    }
    const vmax = this.vmax;
    for (let j = 0; j < ny; j++) {
      const row = ny - 1 - j;
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i, o = (row * nx + i) * 4;
        if (mask && mask[id] !== 1) { d[o + 3] = 0; continue; }
        let c;
        if (comp) {
          c = divRGB(comp[id] / vmax);
        } else {
          const hue = Math.atan2(my[id], mx[id]) / TAU;
          c = hsl2rgb(hue, 0.82, clamp(0.5 + 0.5 * mz[id], 0.05, 0.97));
        }
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    this.octx.putImageData(this.img, 0, 0);
  }

  draw(ctx, W, H, pad) {
    pad = pad === undefined ? 14 : pad;
    const s = Math.min((W - 2 * pad) / this.nx, (H - 2 * pad) / this.ny);
    this.lay = { s: s, x0: (W - this.nx * s) / 2, y0: (H - this.ny * s) / 2 };
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.off, this.lay.x0, this.lay.y0, this.nx * s, this.ny * s);
    ctx.strokeStyle = 'rgba(23,20,15,0.5)';
    ctx.lineWidth = 1;
    if (!this.noFrame) ctx.strokeRect(this.lay.x0 - 0.5, this.lay.y0 - 0.5, this.nx * s + 1, this.ny * s + 1);
    return this.lay;
  }

  px(i, j) { return [this.lay.x0 + i * this.lay.s, this.lay.y0 + (this.ny - j) * this.lay.s]; }
}

function drawArrowsOver(ctx, core, view, step) {
  const L = view.lay, nx = core.nx, ny = core.ny, s = L.s, len = s * step * 0.42;
  const half = Math.floor(step / 2);
  const pass = function (style, lw) {
    ctx.strokeStyle = style;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let j = half; j < ny; j += step) {
      for (let i = half; i < nx; i += step) {
        const id = j * nx + i;
        if (core.mask && core.mask[id] !== 1) continue;
        const ax = core.mx[id], ay = core.my[id];
        const cx = L.x0 + (i + 0.5) * s, cy = L.y0 + (ny - j - 0.5) * s;
        ctx.moveTo(cx - ax * len, cy + ay * len);
        ctx.lineTo(cx + ax * len, cy - ay * len);
      }
    }
    ctx.stroke();
  };
  pass('rgba(255,255,255,0.7)', 3);
  pass('rgba(23,20,15,0.9)', 1.3);
  ctx.fillStyle = PAL.ink;
  for (let j = half; j < ny; j += step) {
    for (let i = half; i < nx; i += step) {
      const id = j * nx + i;
      if (core.mask && core.mask[id] !== 1) continue;
      const ax = core.mx[id], ay = core.my[id];
      const cx = L.x0 + (i + 0.5) * s, cy = L.y0 + (ny - j - 0.5) * s;
      ctx.beginPath();
      ctx.arc(cx + ax * len, cy - ay * len, 1.8, 0, TAU);
      ctx.fill();
    }
  }
}

function drawCard(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(251,248,242,0.93)';
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(23,20,15,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawWheelLegend(ctx, x, y, r) {
  ctx.save();
  drawCard(ctx, x - r - 12, y - r - 12, 2 * r + 80, 2 * r + 46);
  ctx.lineWidth = r * 0.34;
  for (let a = 0; a < 360; a += 4) {
    ctx.strokeStyle = rgbStr(hsl2rgb(a / 360, 0.82, 0.5));
    ctx.beginPath();
    ctx.arc(x, y, r, -a * DEG - 0.09, -a * DEG + 0.02);
    ctx.stroke();
  }
  const bx = x + r + 16, g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(bx, y - r, 9, 2 * r);
  ctx.strokeStyle = 'rgba(23,20,15,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, y - r, 9, 2 * r);
  ctx.fillStyle = PAL.ink2;
  ctx.font = fnt(11, 700);
  ctx.textAlign = 'left';
  ctx.fillText('↑ z', bx + 14, y - r + 9);
  ctx.fillText('↓ z', bx + 14, y + r);
  ctx.textAlign = 'center';
  ctx.font = fnt(10.5, 400);
  ctx.fillText('direction dans le plan', x + 26, y + r + 22);
  ctx.restore();
}

function drawScaleBar(ctx, x, y, px, label) {
  ctx.save();
  ctx.strokeStyle = PAL.ink;
  ctx.fillStyle = PAL.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + px, y);
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
  ctx.moveTo(x + px, y - 4); ctx.lineTo(x + px, y + 4);
  ctx.stroke();
  ctx.font = fnt(12, 700);
  ctx.textAlign = 'center';
  ctx.fillText(label, x + px / 2, y - 8);
  ctx.restore();
}

function drawLabel(ctx, txt, x, y, o) {
  o = o || {};
  ctx.save();
  ctx.font = o.font || fnt(12, 700);
  const w = ctx.measureText(txt).width + 12, h = 20;
  let x0 = x;
  if (o.align === 'center') x0 = x - w / 2;
  else if (o.align === 'right') x0 = x - w;
  ctx.fillStyle = o.bg || 'rgba(251,248,242,0.92)';
  roundRect(ctx, x0, y - 14, w, h, 4);
  ctx.fill();
  if (o.border !== false) {
    ctx.strokeStyle = o.bd || 'rgba(23,20,15,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = o.col || PAL.ink;
  ctx.textAlign = 'left';
  ctx.fillText(txt, x0 + 6, y);
  ctx.restore();
}

function drawNeedle(ctx, x, y, ang, L, W) {
  const dx = Math.cos(ang), dy = -Math.sin(ang), px = -dy, py = dx;
  ctx.fillStyle = PAL.red;
  ctx.beginPath();
  ctx.moveTo(x + dx * L, y + dy * L);
  ctx.lineTo(x + px * W, y + py * W);
  ctx.lineTo(x - px * W, y - py * W);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL.blue;
  ctx.beginPath();
  ctx.moveTo(x - dx * L, y - dy * L);
  ctx.lineTo(x + px * W, y + py * W);
  ctx.lineTo(x - px * W, y - py * W);
  ctx.closePath();
  ctx.fill();
}

// ===== modes/base.js =====
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

class SimBase {
  constructor(host, d) {
    this.host = host;
    this.p = Object.assign({}, d);
    this.t = 0;
    this.obs = {};
  }
  setParam(id, v) { this.p[id] = v; this.onParam(id, v); }
  onParam() {}
  action() {}
  hud() { return []; }
  drag() {}
  plotClick() {}
  drawPlots() {}
}

class MacroBase extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.ph = newPhys();
    this.m = [0, 0, 1];
    this.integ = new MacroIntegrator();
    this.trail = [];
    this.view = { yaw: -0.55, pitch: 0.42 };
    this.timeScale = 1.2e-10;
    this.bScale = 0.1;
    this.histMax = 520;
    this.fieldFn = (t, o) => this.fieldAt(t, o);
  }
  dtMax() { return Math.min(3e-12, 0.08 / (GAMMA * Math.max(this.bScale, 1e-3))); }
  tsNow() { return this.timeScale; }
  drag(dx, dy) {
    this.view.yaw -= dx * 0.008;
    this.view.pitch = clamp(this.view.pitch + dy * 0.008, -1.4, 1.4);
  }
  update(dtReal, speed) {
    const tf = this.tsNow() * speed * dtReal;
    const dm = this.dtMax();
    let n = Math.ceil(tf / dm);
    if (n < 1) n = 1;
    if (n > 5000) n = 5000;
    const dt = tf / n;
    for (let i = 0; i < n; i++) this.stepOnce(dt);
    this.afterFrame(tf);
  }
  stepOnce(dt) {
    this.preStep(dt);
    this.integ.step(this.m, this.t, dt, this.ph, this.fieldFn);
    this.t += dt;
    this.postStep(dt);
  }
  preStep() {}
  postStep() {}
  afterFrame() {}
  fieldAt(t, o) { o[0] = 0; o[1] = 0; o[2] = 0; }
  vectors() { return []; }
  pushTrail() {
    this.trail.push([this.m[0], this.m[1], this.m[2]]);
    if (this.trail.length > 260) this.trail.shift();
  }
  draw(ctx, W, H) {
    drawSphere(ctx, W, H, this.view, { m: this.m, trail: this.trail, vecs: this.vectors() });
  }
}

// ===== modes/macro.js =====
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
    o[0] = b * this.dir[0]; o[1] = b * this.dir[1]; o[2] = b * this.dir[2];
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
    return [{ v: [s * d[0] * L, s * d[1] * L, s * d[2] * L], col: PAL.gold, label: 'B' }];
  }
  sonify() {
    return { f: 120 + 45 * this.obs.f, a: Math.sin(clamp(this.angle, 0, 180) * DEG) };
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
      { i: 0, col: PAL.x, label: 'mx' },
      { i: 1, col: PAL.y, label: 'my' },
      { i: 2, col: PAL.z, label: 'mz' }
    ], 'Composantes de l’aimantation', -1.1, 1.1, 'm');
    drawSeries(p2, this.hist, [{ i: 3, col: PAL.gold, label: 'angle m–B' }], 'Angle entre m et B (°)', 0, 180, '°');
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
      if (v !== this.Bm) this.mdir = v < this.Bm ? -1 : 1;
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
    this.mdir = -1;
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
    lp.B.push(this.Bm); lp.M.push(M); lp.br.push(this.p.auto ? this.dir : this.mdir);
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
      { v: [s * this.h[0] * L, 0, s * this.h[2] * L], col: PAL.gold, label: 'B' },
      { v: [0, 0, 1.2], col: PAL.blue, label: 'axe facile', axis: true }
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
    p1.vline(this.th, 'rgba(201,138,0,0.55)', true);
    p1.vline(-this.th, 'rgba(201,138,0,0.55)', true);
    const ctx = p1.ctx;
    ctx.lineWidth = 2.2;
    for (let pass = 0; pass < 3; pass++) {
      const col = pass === 0 ? PAL.red : (pass === 1 ? PAL.blue : PAL.ink3);
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
    ctx.fillStyle = PAL.ink;
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
    c2.fillStyle = 'rgba(31,78,156,0.12)';
    c2.fill();
    c2.strokeStyle = PAL.blue;
    c2.lineWidth = 2;
    c2.stroke();
    p2.clip();
    c2.strokeStyle = 'rgba(201,138,0,0.55)';
    c2.setLineDash([5, 4]);
    c2.lineWidth = 1.5;
    c2.beginPath();
    c2.moveTo(p2.X(-p.Bmax * Math.sin(ps) / bk), p2.Y(-p.Bmax * Math.cos(ps) / bk));
    c2.lineTo(p2.X(p.Bmax * Math.sin(ps) / bk), p2.Y(p.Bmax * Math.cos(ps) / bk));
    c2.stroke();
    c2.setLineDash([]);
    c2.fillStyle = PAL.gold;
    c2.beginPath(); c2.arc(p2.X(this.Bm * Math.sin(ps) / bk), p2.Y(this.Bm * Math.cos(ps) / bk), 6, 0, TAU); c2.fill();
    p2.unclip();
  }
  action(id) {
    if (id === 'reset') this.reset();
    else if (id === 'up' || id === 'down') {
      const v = clamp(Math.round(this.Bm) + (id === 'up' ? 5 : -5), -400, 400);
      this.setParam('B', v);
      this.host.setParamUI('B', v);
    }
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
  sonify() {
    return { f: 120 + 45 * this.p.f, a: clamp(this.ampHold * 2.5, 0, 1) };
  }
  vectors() {
    return [
      { v: [0.9, 0, 0], col: PAL.gold, label: 'B' },
      { v: [0, 0.55 * Math.sin(this.phase), 0], col: PAL.teal, label: 'b(t)' }
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
      { i: 0, col: PAL.y, label: 'my' },
      { i: 1, col: PAL.z, label: 'mz' }
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
      p2.line(xs, ys, PAL.blue, 2);
      p2.vline(this.fres, PAL.gold, true, 'Kittel');
      p2.vline(this.p.f, PAL.red, false, 'pilotage');
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
          if (this.result === 'flip') this.host.sfx('flip');
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
    } else if (id === 'long') {
      const tau = this.findTau();
      if (tau === null) { this.host.toast('Aucune durée ne marche : augmente B_p'); return; }
      this.p.tau = Math.min(400, 2 * tau);
      this.host.setParamUI('tau', this.p.tau);
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
    const out = [{ v: [0, 0, 1.2], col: PAL.blue, label: 'axe facile', axis: true }];
    if (this.phase === 'pulse') out.push({ v: [0.4 + 0.8 * this.p.Bp / 500, 0, 0], col: PAL.gold, label: 'B_p' });
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
    p1.ctx.fillStyle = 'rgba(201,138,0,0.16)';
    p1.ctx.fillRect(p1.X(0), p1.box.t, p1.X(this.dur * 1e9) - p1.X(0), p1.ph);
    p1.clip();
    p1.line(tn, this.hist.v[0], PAL.blue, 2.2);
    p1.line(tn, this.hist.v[1], PAL.red, 1.6);
    p1.unclip();
    p1.legend([{ col: PAL.blue, label: 'mz' }, { col: PAL.red, label: 'mx' }, { col: PAL.gold, label: 'impulsion' }]);

    p2.begin('Carte de retournement (clique dessus !)', 0, this.BPMAX, 0, this.TAUMAX, 'amplitude B_p (mT)', 'durée (ps)');
    const job = this.map || this.mapJob;
    if (job) {
      const ctx = p2.ctx, cw = p2.pw / this.NX, ch = p2.ph / this.NY, total = this.NX * this.NY;
      const upto = this.map ? total : job.i;
      for (let i = 0; i < upto; i++) {
        const jx = i % this.NX, jy = Math.floor(i / this.NX);
        ctx.fillStyle = job.data[i] ? 'rgba(215,48,31,0.85)' : 'rgba(23,20,15,0.06)';
        ctx.fillRect(p2.box.l + jx * cw, p2.box.t + p2.ph - (jy + 1) * ch, cw + 0.6, ch + 0.6);
      }
    } else {
      p2.text('calcul de la carte…', p2.box.l + 10, p2.box.t + 20, PAL.ink3);
    }
    const ctx2 = p2.ctx;
    ctx2.strokeStyle = PAL.ink;
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.arc(p2.X(this.p.Bp), p2.Y(this.p.tau), 6, 0, TAU);
    ctx2.stroke();
    p2.vline(this.p.BK / 2, 'rgba(201,138,0,0.8)', true, 'B_K/2');
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
    if (s !== this.prevS) { this.swAmp = this.aEff(); this.prevS = s; this.host.sfx('flip'); }
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
      { v: [0, 0, 1.2], col: PAL.blue, label: '', axis: true },
      { v: [0, 0, 0.62], col: PAL.plum, label: 'p' }
    ];
    if (Math.abs(this.p.Bz) > 0.1) out.push({ v: [0, 0, Math.sign(this.p.Bz) * (0.35 + Math.abs(this.p.Bz) / 80)], col: PAL.gold, label: 'B' });
    return out;
  }
  draw(ctx, W, H) {
    super.draw(ctx, W, H);
    const up = this.m[2] > 0, x = W - 86, y = 16;
    ctx.fillStyle = up ? 'rgba(215,48,31,0.12)' : 'rgba(31,78,156,0.12)';
    ctx.strokeStyle = up ? PAL.red : PAL.blue;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, 70, 78, 14) : ctx.rect(x, y, 70, 78);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = up ? PAL.red : PAL.blue;
    ctx.font = '700 40px Atkinson Hyperlegible, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(up ? '↑' : '↓', x + 35, y + 42);
    ctx.font = '600 12px Atkinson Hyperlegible, system-ui, sans-serif';
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
      { i: 0, col: PAL.blue, label: 'mz' },
      { i: 1, col: PAL.gold, label: 'courant' }
    ], 'Aimantation et courant au cours du temps', -1.2, 1.2, '');
    const lim = 40;
    p2.begin('Trace  mz  en fonction du courant', -lim, lim, -1.15, 1.15, 'torque de spin a_J (mT)', 'mz');
    p2.clip();
    p2.vline(this.acUp, 'rgba(201,138,0,0.6)', true);
    if (this.acDn > 0) p2.vline(-this.acDn, 'rgba(201,138,0,0.6)', true);
    const ctx = p2.ctx, sa = this.scatter.a, sm = this.scatter.m;
    for (let i = 0; i < sa.length; i++) {
      ctx.fillStyle = 'rgba(215,48,31,' + (0.25 + 0.6 * i / sa.length).toFixed(2) + ')';
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
  sonify() {
    return { f: 120 + 45 * (this.fMeas || this.f0), a: clamp(this.ampHold * 1.8, 0, 1) };
  }
  vectors() {
    return [
      { v: [1.25, 0, 0], col: PAL.gold, label: 'B' },
      { v: [0.62, 0, 0], col: PAL.plum, label: 'p' }
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
      { i: 0, col: PAL.y, label: 'my' },
      { i: 1, col: PAL.z, label: 'mz' }
    ], 'Signal micro-onde produit', null, null, 'm');
    let lim = 0.2;
    for (let i = 0; i < this.orbit.length; i++) lim = Math.max(lim, Math.abs(this.orbit[i][0]), Math.abs(this.orbit[i][1]));
    lim *= 1.2;
    p2.begin('Portrait de phase (my, mz) : cycle limite', -lim, lim, -lim, lim, 'my', 'mz');
    p2.clip();
    const ctx = p2.ctx, o = this.orbit;
    ctx.lineWidth = 2;
    for (let i = 1; i < o.length; i++) {
      ctx.strokeStyle = 'hsla(' + (10 + 210 * i / o.length).toFixed(0) + ',70%,42%,' + (0.15 + 0.85 * i / o.length).toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(p2.X(o[i - 1][0]), p2.Y(o[i - 1][1]));
      ctx.lineTo(p2.X(o[i][0]), p2.Y(o[i][1]));
      ctx.stroke();
    }
    if (o.length) {
      ctx.fillStyle = PAL.ink;
      ctx.beginPath(); ctx.arc(p2.X(o[o.length - 1][0]), p2.Y(o[o.length - 1][1]), 5, 0, TAU); ctx.fill();
    }
    p2.unclip();
  }
}

// ===== modes/film.js =====
class FilmSimBase extends SimBase {
  update(dtReal, speed) {
    const c = this.core, dt = c.dt, target = this.timeScale * speed * dtReal;
    const t0 = performance.now();
    let adv = 0, k = 0;
    this.beforeFrame();
    while (adv < target) {
      c.step(dt, this.t);
      this.t += dt;
      adv += dt;
      k++;
      if ((k & 3) === 0 && performance.now() - t0 > 11) break;
    }
    this.afterFrame();
  }
  beforeFrame() {}
  afterFrame() {}
}

class WallSim extends FilmSimBase {
  constructor(host, d) {
    super(host, d);
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
    c.Bx = 0; c.By = 0; c.Bz = p.Bz * 1e-3;
    c.alpha.fill(p.alpha);
    c.prepare();
    this.wallW = Math.sqrt(c.A / c.Kc);
    this.Dc = 4 / Math.PI * Math.sqrt(c.A * c.Kc);
  }
  onParam() { this.applyParams(); }
  action(id) { if (id === 'reset') this.reset(); }
  reset() {
    const c = this.core, w = this.wallW, x0 = 0.3 * this.nx * this.dx;
    for (let i = 0; i < this.nx; i++) {
      const u = ((i + 0.5) * this.dx - x0) / w;
      c.mz[i] = -Math.tanh(u);
      c.my[i] = 1 / Math.cosh(u);
      c.mx[i] = 0;
    }
    c.normalizeAll();
    this.t = 0;
    this.hist = { t: [], x: [] };
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
    this.v = v;
    let type = '—';
    if (this.phi !== null) {
      const cc = Math.abs(Math.cos(this.phi)), ss = Math.abs(Math.sin(this.phi));
      type = cc > 0.85 ? 'Néel' : (ss > 0.85 ? 'Bloch' : 'intermédiaire');
    }
    this.type = type;
    this.obs = { v: v, type: type, wallW: this.wallW, D: this.p.D };
  }
  hud() {
    const out = [
      ['Position de la paroi', this.xw === null ? 'sortie' : (this.xw * 1e9).toFixed(0) + ' nm'],
      ['Vitesse', this.v === null ? '—' : this.v.toFixed(0) + ' m/s', 'hot'],
      ['Type de paroi', this.type + (this.phi === null ? '' : ' (' + (this.phi / DEG).toFixed(0) + '°)'), this.type === 'Néel' ? 'good' : ''],
      ['Largeur Δ = √(A/K)', (this.wallW * 1e9).toFixed(1) + ' nm'],
      ['D / D_c', (this.p.D * 1e-3 / this.Dc).toFixed(2), this.p.D * 1e-3 > this.Dc ? 'bad' : '']
    ];
    if (this.p.D * 1e-3 > this.Dc) out.push(['Alerte', 'D > D_c : la paroi devient instable', 'bad']);
    if (this.wallW < 1.2 * this.dx) out.push(['Alerte', 'paroi trop fine pour la grille', 'bad']);
    return out;
  }
  draw(ctx, W, H) {
    const c = this.core, nx = this.nx, pad = 22, w = W - 2 * pad, cw = w / nx;
    const yR = H * 0.13, hR = H * 0.17;
    for (let i = 0; i < nx; i++) {
      ctx.fillStyle = rgbStr(divRGB(c.mz[i]));
      ctx.fillRect(pad + i * cw, yR, cw + 0.8, hR);
    }
    ctx.strokeStyle = 'rgba(23,20,15,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, yR, w, hR);
    ctx.fillStyle = PAL.ink2;
    ctx.font = '12px Atkinson Hyperlegible, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(W < 560 ? 'vue de dessus : rouge ↑, bleu ↓, blanc = paroi' : 'vue de dessus : rouge = aimantation vers le haut ↑, bleu = vers le bas ↓, blanc = la paroi', pad, yR - 8);
    const cy = H * 0.66, st = 4, L = cw * st * 0.46;
    ctx.fillStyle = PAL.ink2;
    ctx.fillText(W < 560 ? 'vue de côté : une flèche par groupe de spins' : 'vue de côté : chaque flèche montre l’aimantation locale (rouge ↑, bleu ↓, sombre = couchée)', pad, cy - H * 0.2);
    ctx.lineWidth = 2.2;
    for (let i = 2; i < nx; i += st) {
      const cx = pad + (i + 0.5) * cw, ax = c.mx[i] * L, ay = -c.mz[i] * L;
      const col = rgbStr(arrowRGB(c.mz[i]));
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
      ctx.strokeStyle = 'rgba(201,138,0,0.9)';
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
      ctx.fillStyle = PAL.gold;
      ctx.textAlign = 'center';
      ctx.fillText('Δ = ' + (this.wallW * 1e9).toFixed(1) + ' nm', X, by + 18);
    }
    ctx.fillStyle = PAL.red;
    ctx.textAlign = 'left';
    ctx.font = '600 13px Atkinson Hyperlegible, system-ui, sans-serif';
    ctx.fillText('domaine ↑', pad + 6, H - 14);
    ctx.fillStyle = PAL.blue;
    ctx.textAlign = 'right';
    ctx.fillText('domaine ↓', W - pad - 6, H - 14);
    drawScaleBar(ctx, W / 2 - cw * 16.7, H - 18, cw * 33.3, '100 nm');
  }
  drawPlots(p1, p2) {
    const c = this.core, xs = [], a = [], b = [], d = [];
    for (let i = 0; i < this.nx; i++) {
      xs.push((i + 0.5) * this.dx * 1e9);
      a.push(c.mx[i]); b.push(c.my[i]); d.push(c.mz[i]);
    }
    p1.begin('Profil de la paroi', 0, this.nx * this.dx * 1e9, -1.1, 1.1, 'x (nm)', 'm');
    p1.clip();
    p1.line(xs, a, PAL.x, 2);
    p1.line(xs, b, PAL.y, 2);
    p1.line(xs, d, PAL.z, 2);
    p1.unclip();
    p1.legend([{ col: PAL.x, label: 'mx' }, { col: PAL.y, label: 'my' }, { col: PAL.z, label: 'mz' }]);
    const h = this.hist, tn = h.t.map(function (v) { return v * 1e9; }), xn = h.x.map(function (v) { return v * 1e9; });
    const x0 = tn.length ? tn[0] : 0, x1 = tn.length > 1 ? tn[tn.length - 1] : x0 + 1;
    p2.begin('Position de la paroi au cours du temps', x0, x1, 0, this.nx * this.dx * 1e9, 't (ns)', 'x (nm)');
    p2.clip();
    p2.line(tn, xn, PAL.gold, 2.4);
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
    this.coreX = (cx - nx / 2) * dx * 1e9;
    this.coreY = (cy - nx / 2) * dx * 1e9;
    this.coreR = Math.sqrt(this.coreX * this.coreX + this.coreY * this.coreY);
    this.pol = pol;
    this.mzmax = bv;
    this.circ = norm > 1e-9 ? circ / norm : 0;
    this.has = bv > 0.5 && Math.abs(this.circ) > 0.3;
    if (!this.has) { this.trail = []; this.prevAng = null; this.fG = null; return; }
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
      ['Polarité du cœur', this.pol > 0 ? '↑ (blanc)' : '↓ (noir)'],
      ['Cœur à', this.has ? this.coreR.toFixed(0) + ' nm du centre' : 'pas de cœur', this.has ? 'hot' : 'bad'],
      ['Fréquence gyrotropique', this.fG === null ? '—' : this.fG.toFixed(2) + ' GHz'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  draw(ctx, W, H) {
    this.fv.paint(this.core, this.p.disp === 'mz' ? 'mz' : 'wheel');
    const L = this.fv.draw(ctx, W, H, 22);
    const nx = this.nx, s = L.s;
    ctx.strokeStyle = 'rgba(23,20,15,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(L.x0 + nx / 2 * s, L.y0 + nx / 2 * s, this.Rc * s, 0, TAU);
    ctx.stroke();
    if (this.p.arrows) drawArrowsOver(ctx, this.core, this.fv, 2);
    const tr = this.trail;
    ctx.lineWidth = 2.4;
    for (let i = 1; i < tr.length; i++) {
      const a = this.fv.px(tr[i - 1][0], tr[i - 1][1]), b = this.fv.px(tr[i][0], tr[i][1]);
      ctx.strokeStyle = 'rgba(23,20,15,' + (0.9 * i / tr.length).toFixed(2) + ')';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    if (this.has && tr.length) {
      const q = this.fv.px(tr[tr.length - 1][0], tr[tr.length - 1][1]);
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, TAU); ctx.stroke();
    } else if (!this.has) {
      drawLabel(ctx, 'Plus de cœur de vortex', W / 2, L.y0 + 18, { align: 'center' });
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
    p2.line(xs, ys, PAL.gold, 2);
    p2.unclip();
    const c = p2.ctx;
    c.strokeStyle = 'rgba(23,20,15,0.3)';
    c.beginPath();
    c.arc(p2.X(0), p2.Y(0), Math.min(p2.pw / 2, p2.ph / 2), 0, TAU);
    c.stroke();
    const a = this.ah, tn = [], rv = [];
    for (let i = 0; i < a.length; i++) { tn.push(a[i].t * 1e9); rv.push(a[i].r); }
    const x0 = tn.length ? tn[0] : 0, x1 = tn.length > 1 ? tn[tn.length - 1] : x0 + 1;
    p1.begin('Distance du cœur au centre', x0, x1, 0, Math.max(10, R), 't (ns)', 'r (nm)');
    p1.clip();
    p1.line(tn, rv, PAL.blue, 2.2);
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
    else if (id === 'clear') { this.sp = { t: [], x: [], y: [] }; this.trail = []; this.pos = null; }
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
    let best = 0, bv = 2;
    for (let i = 0; i < c.n; i++) if (mz[i] < bv) { bv = mz[i]; best = i; }
    if (bv > -0.3 || Math.abs(this.Q) < 0.5) { this.pos = null; this.lost = true; return; }
    if (!this.pos) this.pos = { x: (best % nx) + 0.5, y: Math.floor(best / nx) + 0.5 };
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
      if (this.lost) this.trail = [];
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
      pushHist(this.vh, this.t, [this.v === null ? 0 : this.v], 700);
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
        ['État', this.lost ? 'skyrmion disparu' : 'suivi du skyrmion', this.lost ? 'bad' : '']
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
        ctx.strokeStyle = 'rgba(23,20,15,' + (0.85 * i / tr.length).toFixed(2) + ')';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      if (this.lost) drawLabel(ctx, 'Skyrmion disparu · ↺ pour en recréer un', W / 2, L.y0 + 18, { align: 'center' });
      if (this.pos && !this.lost) {
        const q = this.fv.px(((this.pos.x % nx) + nx) % nx, ((this.pos.y % ny) + ny) % ny);
        ctx.strokeStyle = PAL.gold;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, TAU); ctx.stroke();
      }
      const ang = this.p.dir * DEG, cx0 = L.x0 + 40, cy0 = L.y0 + 40;
      ctx.strokeStyle = PAL.teal; ctx.fillStyle = PAL.teal;
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
      ctx.font = '12px Atkinson Hyperlegible, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('électrons', cx0, cy0 + 40);
    }
    drawWheelLegend(ctx, W - 100, 54, 24);
    drawScaleBar(ctx, L.x0 + 12, H - 14, 100e-9 / this.dx * s, '100 nm');
  }
  drawPlots(p1, p2) {
    const c = this.core, nx = this.nx;
    if (this.mode === 'current') {
      drawSeries(p1, this.vh, [{ i: 0, col: PAL.gold, label: 'v' }], 'Vitesse du skyrmion (m/s)', null, null, 'm/s');
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
      p2.line(sp.x, sp.y, PAL.gold, 2.4);
      const ang = this.p.dir * DEG;
      p2.ctx.strokeStyle = 'rgba(23,20,15,0.45)';
      p2.ctx.setLineDash([5, 4]);
      p2.ctx.beginPath();
      if (sp.x.length) {
        p2.ctx.moveTo(p2.X(sp.x[0]), p2.Y(sp.y[0]));
        p2.ctx.lineTo(p2.X(sp.x[0] + Math.cos(ang) * half * 3), p2.Y(sp.y[0] + Math.sin(ang) * half * 3));
      }
      p2.ctx.stroke();
      p2.ctx.setLineDash([]);
      p2.unclip();
      p2.text('pointillé : direction du courant', p2.box.l + 8, p2.box.t + p2.ph - 8, 'rgba(23,20,15,0.6)');
    } else {
      drawSeries(p1, this.hist, [
        { i: 0, col: PAL.red, label: 'Q' },
        { i: 1, col: PAL.blue, label: '⟨mz⟩' }
      ], 'Charge topologique et aimantation moyenne', null, null, '');
      const xs = [], ys = [], j = Math.floor(this.ny / 2);
      for (let i = 0; i < nx; i++) { xs.push((i + 0.5) * this.dx * 1e9); ys.push(c.mz[j * nx + i]); }
      p2.begin('Coupe de mz le long de la ligne centrale', 0, nx * this.dx * 1e9, -1.1, 1.1, 'x (nm)', 'mz');
      p2.clip();
      p2.line(xs, ys, PAL.z, 2.4);
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
  sonify() {
    return { f: 120 + 45 * this.p.f, a: this.k !== null ? 0.45 : 0.06 };
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
    ctx.strokeStyle = 'rgba(23,20,15,0.28)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(L.x0 + 10 * s, L.y0 + 10 * s, (nx - 20) * s, (ny - 20) * s);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(23,20,15,0.6)';
    ctx.font = '11px Atkinson Hyperlegible, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('zone absorbante (pas de réflexion)', L.x0 + 6, L.y0 + ny * s - 6);
    ctx.strokeStyle = PAL.gold;
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
    ctx.fillStyle = 'rgba(201,138,0,0.95)';
    ctx.textAlign = 'left';
    ctx.fillText('antenne', L.x0 + 22 * s, L.y0 + (ny - cyc) * s - 3 * s);
  }
  drawPlots(p1, p2) {
    const xmax = 120, ymax = 24, cex = this.cex, B = this.Btot;
    p1.begin('Relation de dispersion  f(k)', 0, xmax, 0, ymax, 'nombre d’onde k (rad/µm)', 'f (GHz)');
    const kl = 2 * Math.PI / (6 * this.dx) / 1e6;
    p1.ctx.fillStyle = 'rgba(215,48,31,0.10)';
    p1.ctx.fillRect(p1.X(kl), p1.box.t, p1.X(xmax) - p1.X(kl), p1.ph);
    const ks = [], fs = [];
    for (let k = 0; k <= xmax; k += 2) { ks.push(k); fs.push(GHZ_PER_T * (B + cex * Math.pow(k * 1e6, 2))); }
    p1.clip();
    p1.line(ks, fs, PAL.blue, 2.4);
    p1.hline(this.p.f, PAL.red, true);
    p1.hline(this.f0, PAL.gold, true, 'f₀');
    if (this.k !== null) {
      const q = p1.ctx;
      q.fillStyle = PAL.ink;
      q.beginPath(); q.arc(p1.X(this.k * 1e-6), p1.Y(this.p.f), 6, 0, TAU); q.fill();
    }
    p1.unclip();
    p1.text('zone rouge : maille trop grossière', p1.X(kl) - 6, p1.box.t + p1.ph - 8, PAL.red, 'right');
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
    p2.line(xs, ys, PAL.x, 2.2);
    p2.unclip();
  }
}

// ===== modes/extra.js =====
class FilingsSim extends SimBase {
  constructor(host, d, opt) {
    super(host, d);
    this.hero = !!(opt && opt.hero);
    this.W = 0; this.H = 0; this.sc = 40;
    this.mags = [];
    this.fil = null;
    this.lines = null;
    this.linesDirty = true;
    this.hover = null;
    this.grab = null;
    this.idle = 0;
    this.prof = null;
    this.P = [];
    this.dirty = true;
    this.kT = 0.036;
    this.bRef = 1;
    this.rnd = uni(xorshift(99));
    this.obs = { neutral: false, repel: false, strong: false, Bh: null };
    this.setScene(this.p.scene || 'bar');
  }
  timeInfo() { return 'Champ statique : rien ne bouge tout seul'; }
  setScene(s) {
    this.p.scene = s;
    const M = function (x, y, a, L, w, q) { return { x: x, y: y, a: a, L: L || 4, w: w || 1.1, q: q || 1, kind: 'bar' }; };
    this.earth = false;
    if (s === 'attract') this.mags = [M(-3.1, 0, 0), M(3.1, 0, 0)];
    else if (s === 'repel') this.mags = [M(-3.1, 0, 0), M(3.1, 0, Math.PI)];
    else if (s === 'halbach') {
      this.mags = [];
      for (let k = 0; k < 5; k++) this.mags.push(M(-2.8 + 1.4 * k, 0.6, -k * Math.PI / 2, 1.3, 1.3, 0.45));
    } else if (s === 'horseshoe') {
      const u = M(0, -0.8, Math.PI / 2, 3.6, 1.0, 1.1);
      u.kind = 'u';
      this.mags = [u];
    } else if (s === 'earth') {
      const e = M(0, 0, -Math.PI / 2 + 11 * DEG, 2.2, 0.7, 2.2);
      e.kind = 'earth';
      this.mags = [e];
      this.earth = true;
    } else {
      this.mags = [M(0, 0, 0)];
    }
    if (this.hero) this.mags[0].a = 0.35;
    this.dirty = true;
    this.fil = null;
    this.poles();
  }
  poles() {
    const P = [];
    for (let k = 0; k < this.mags.length; k++) {
      const m = this.mags[k], c = Math.cos(m.a), s = Math.sin(m.a);
      if (m.kind === 'u') {
        const rx = s, ry = -c;
        P.push(m.x + c * 1.4 - rx * 0.95, m.y + s * 1.4 - ry * 0.95, m.q);
        P.push(m.x + c * 1.4 + rx * 0.95, m.y + s * 1.4 + ry * 0.95, -m.q);
      } else {
        const h = m.L * 0.42;
        P.push(m.x + c * h, m.y + s * h, m.q);
        P.push(m.x - c * h, m.y - s * h, -m.q);
      }
    }
    this.P = P;
    if (this.earth) {
      const tmp = [0, 0], b = this.field(0, 3.05, tmp);
      this.kT = b > 0 ? 47e-6 / b : 1e-6;
    } else {
      this.kT = 0.036;
    }
  }
  field(x, y, out) {
    const P = this.P;
    let bx = 0, by = 0;
    for (let i = 0; i < P.length; i += 3) {
      const dx = x - P[i], dy = y - P[i + 1], r2 = dx * dx + dy * dy + 0.03, inv = P[i + 2] / (r2 * Math.sqrt(r2));
      bx += dx * inv; by += dy * inv;
    }
    out[0] = bx; out[1] = by;
    return Math.sqrt(bx * bx + by * by);
  }
  local(m, x, y) {
    const c = Math.cos(m.a), s = Math.sin(m.a), dx = x - m.x, dy = y - m.y;
    return [dx * c + dy * s, dx * s - dy * c];
  }
  insideOne(m, x, y, mg) {
    if (m.kind === 'earth') {
      const dx = x - m.x, dy = y - m.y;
      return dx * dx + dy * dy < (3 + mg) * (3 + mg);
    }
    const l = this.local(m, x, y), f = l[0], r = l[1];
    if (m.kind === 'u') {
      const ar = Math.abs(r);
      const legs = ar >= 0.6 - mg && ar <= 1.3 + mg && f >= -1.0 - mg && f <= 1.75 + mg;
      const base = ar <= 1.3 + mg && f >= -1.35 - mg && f <= -0.3 + mg;
      return legs || base;
    }
    return Math.abs(f) <= m.L / 2 + mg && Math.abs(r) <= m.w / 2 + mg;
  }
  inside(x, y) {
    for (let k = 0; k < this.mags.length; k++) if (this.insideOne(this.mags[k], x, y, 0)) return true;
    return false;
  }
  hit(x, y) {
    for (let k = this.mags.length - 1; k >= 0; k--) if (this.insideOne(this.mags[k], x, y, 0.3)) return k;
    return -1;
  }
  toPx(x, y) { return [this.W / 2 + x * this.sc, this.H / 2 - y * this.sc]; }
  toW(px, py) { return [(px - this.W / 2) / this.sc, (this.H / 2 - py) / this.sc]; }
  genFilings() {
    const W = this.W, H = this.H, n = this.hero ? 1500 : 2400, out = [], tmp = [0, 0], rnd = this.rnd;
    const m0 = this.mags[0], rp = this.P.length ? [this.P[0] + Math.cos(m0.a) * 2, this.P[1] + Math.sin(m0.a) * 2] : [2, 0];
    this.bRef = Math.max(1e-6, this.field(rp[0], rp[1], tmp));
    let tries = 0;
    while (out.length < n * 3 && tries < n * 8) {
      tries++;
      const px = rnd() * W, py = rnd() * H, wx = (px - W / 2) / this.sc, wy = (H / 2 - py) / this.sc;
      if (this.inside(wx, wy)) continue;
      const b = this.field(wx, wy, tmp);
      const acc = clamp(0.2 + 0.55 * Math.pow(b / this.bRef, 0.35), 0, 1);
      if (rnd() > acc) continue;
      out.push(px, py, 0.6 + 0.8 * rnd());
    }
    this.fil = new Float32Array(out);
  }
  traceLines() {
    const P = this.P, out = [], tmp = [0, 0], hw = this.W / (2 * this.sc) + 1, hh = this.H / (2 * this.sc) + 1;
    const seeds = this.hero ? 12 : 16;
    for (let i = 0; i < P.length; i += 3) {
      if (P[i + 2] <= 0) continue;
      const ns = Math.max(5, Math.round(seeds * Math.min(1.4, P[i + 2])));
      for (let k = 0; k < ns; k++) {
        const a = TAU * (k + 0.5) / ns;
        let x = P[i] + 0.22 * Math.cos(a), y = P[i + 1] + 0.22 * Math.sin(a);
        const pts = [x, y];
        for (let st = 0; st < 700; st++) {
          let b = this.field(x, y, tmp);
          if (b < 1e-9) break;
          const h = clamp(0.04 + 0.02 * Math.sqrt(x * x + y * y), 0.04, 0.14);
          const mx = x + tmp[0] / b * h * 0.5, my = y + tmp[1] / b * h * 0.5;
          b = this.field(mx, my, tmp);
          if (b < 1e-9) break;
          x += tmp[0] / b * h;
          y += tmp[1] / b * h;
          pts.push(x, y);
          if (Math.abs(x) > hw || Math.abs(y) > hh) break;
          let hitS = false;
          for (let j = 0; j < P.length; j += 3) {
            if (P[j + 2] >= 0) continue;
            const ddx = x - P[j], ddy = y - P[j + 1];
            if (ddx * ddx + ddy * ddy < 0.04) { hitS = true; break; }
          }
          if (hitS) break;
        }
        out.push(pts);
      }
    }
    this.lines = out;
  }
  update(dtReal) {
    this.t += dtReal;
    this.idle += dtReal;
    if (this.hero && !this.grab) {
      const m = this.mags[0];
      if (Sensors.real && Sensors.heading !== null) {
        const target = Math.PI / 2 + Sensors.heading * DEG;
        m.a += wrapPi(target - m.a) * Math.min(1, dtReal * 3);
        this.dirty = true;
      } else if (this.idle > 3) {
        m.a += dtReal * 0.22;
        this.dirty = true;
      }
    }
    if (this.dirty) {
      this.poles();
      this.linesDirty = true;
      if (!this.hero) this.profile();
      this.dirty = false;
    }
    this.measure();
  }
  measure() {
    const o = this.obs, tmp = [0, 0];
    o.Bh = null; o.neutral = false; o.strong = false;
    if (this.hover && !this.inside(this.hover[0], this.hover[1])) {
      const b = this.field(this.hover[0], this.hover[1], tmp) * this.kT;
      o.Bh = b;
      const r = Math.sqrt(this.hover[0] * this.hover[0] + this.hover[1] * this.hover[1]);
      o.neutral = this.mags.length >= 2 && !this.earth && b < 5e-4 && r < 4.5;
      o.strong = !this.earth && b > 0.047;
    }
    o.repel = false;
    const P = this.P;
    for (let i = 0; i < P.length; i += 3) {
      if (P[i + 2] <= 0) continue;
      for (let j = i + 3; j < P.length; j += 3) {
        if (P[j + 2] <= 0) continue;
        const dx = P[i] - P[j], dy = P[i + 1] - P[j + 1];
        if (dx * dx + dy * dy < 2.9 && Math.abs(P[i + 2]) >= 1 && Math.abs(P[j + 2]) >= 1) o.repel = true;
      }
    }
  }
  profile() {
    const m = this.mags[0], tmp = [0, 0], ox = this.P[0], oy = this.P[1], dx = Math.cos(m.a), dy = Math.sin(m.a);
    const r = [], b = [], f = this.earth ? 1e6 : 1e3;
    for (let d = 0.3; d <= 12; d *= 1.06) {
      r.push(d);
      b.push(this.field(ox + dx * d, oy + dy * d, tmp) * this.kT * f);
    }
    this.prof = { r: r, b: b };
  }
  fmtB(T) {
    if (T >= 1e-3) return frNum(T * 1e3, T >= 0.01 ? 0 : 1) + ' mT';
    return frNum(T * 1e6, T >= 1e-5 ? 0 : 1) + ' µT';
  }
  draw(ctx, W, H) {
    if (W !== this.W || H !== this.H) {
      this.W = W; this.H = H;
      this.sc = Math.min(W, H) / (this.hero ? 9 : 12);
      if (this.hero) {
        const wide = W > 760;
        this.mags[0].x = wide ? Math.min(4.5, (W / this.sc) * 0.17) : 0;
        this.mags[0].y = wide ? 0.5 : 0.6;
        this.poles();
      }
      this.fil = null;
      this.linesDirty = true;
    }
    if (!this.P.length) this.poles();
    if (!this.fil) this.genFilings();
    const disp = this.p.disp || 'filings';
    if (this.earth) this.drawEarth(ctx);
    if (disp === 'lines' || disp === 'all') {
      if (this.linesDirty || !this.lines) { this.traceLines(); this.linesDirty = false; }
      this.drawLines(ctx, disp === 'all' ? (this.hero ? 0.22 : 0.3) : 0.75);
    }
    if (disp === 'filings' || disp === 'all') this.drawFilings(ctx);
    if (disp === 'compass') this.drawCompasses(ctx);
    this.drawMagnets(ctx);
    if (this.hover && !this.hero) this.drawProbe(ctx);
    if (!this.hero && Sensors.real && Sensors.heading !== null) this.drawRealCompass(ctx, W, H);
    if (!this.hero) drawScaleBar(ctx, W - 22 - 2 * this.sc, H - 16, 2 * this.sc, this.earth ? '≈ 4 000 km' : '2 cm');
  }
  drawFilings(ctx) {
    const f = this.fil, tmp = [0, 0], base = this.hero ? 6.5 : 7.5, n = f.length / 3, W = this.W, H = this.H, sc = this.sc;
    const bucket = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < n; i++) {
      const px = f[3 * i], py = f[3 * i + 1], wx = (px - W / 2) / sc, wy = (H / 2 - py) / sc;
      if (this.inside(wx, wy)) continue;
      const b = this.field(wx, wy, tmp);
      if (b < 1e-12) continue;
      const L = base * f[3 * i + 2] * 0.5, ux = tmp[0] / b, uy = -tmp[1] / b;
      const lv = Math.log10(b / this.bRef);
      const k = lv < -1.3 ? 0 : (lv < -0.7 ? 1 : (lv < 0 ? 2 : 3));
      bucket[k].moveTo(px - ux * L, py - uy * L);
      bucket[k].lineTo(px + ux * L, py + uy * L);
    }
    const al = [0.2, 0.4, 0.62, 0.86];
    ctx.lineCap = 'round';
    ctx.lineWidth = this.hero ? 1.5 : 1.6;
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = 'rgba(23,20,15,' + al[k] + ')';
      ctx.stroke(bucket[k]);
    }
    ctx.lineCap = 'butt';
  }
  drawCompasses(ctx) {
    const tmp = [0, 0], st = 38, W = this.W, H = this.H;
    for (let py = st / 2; py < H; py += st) {
      for (let px = st / 2; px < W; px += st) {
        const w = this.toW(px, py);
        if (this.inside(w[0], w[1])) continue;
        this.field(w[0], w[1], tmp);
        ctx.fillStyle = 'rgba(23,20,15,0.08)';
        ctx.beginPath(); ctx.arc(px, py, 13, 0, TAU); ctx.fill();
        drawNeedle(ctx, px, py, Math.atan2(tmp[1], tmp[0]), 12, 3.2);
      }
    }
  }
  drawLines(ctx, a) {
    const L = this.lines || [];
    ctx.strokeStyle = 'rgba(23,20,15,' + a + ')';
    ctx.fillStyle = 'rgba(23,20,15,' + Math.min(1, a + 0.15) + ')';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (p.length < 6) continue;
      ctx.beginPath();
      let q = this.toPx(p[0], p[1]);
      ctx.moveTo(q[0], q[1]);
      for (let k = 2; k < p.length; k += 2) {
        q = this.toPx(p[k], p[k + 1]);
        ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
      const mi = 2 * Math.floor(p.length / 6);
      if (mi + 3 < p.length) {
        const a0 = this.toPx(p[mi], p[mi + 1]), a1 = this.toPx(p[mi + 2], p[mi + 3]);
        const dx = a1[0] - a0[0], dy = a1[1] - a0[1], l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l;
        ctx.beginPath();
        ctx.moveTo(a1[0] + ux * 4, a1[1] + uy * 4);
        ctx.lineTo(a1[0] - ux * 4 + uy * 3.5, a1[1] - uy * 4 - ux * 3.5);
        ctx.lineTo(a1[0] - ux * 4 - uy * 3.5, a1[1] - uy * 4 + ux * 3.5);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  drawEarth(ctx) {
    const c = this.toPx(0, 0), R = 3 * this.sc;
    ctx.fillStyle = 'rgba(31,78,156,0.08)';
    ctx.beginPath(); ctx.arc(c[0], c[1], R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(23,20,15,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(23,20,15,0.3)';
    ctx.beginPath(); ctx.moveTo(c[0] - R, c[1]); ctx.lineTo(c[0] + R, c[1]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c[0], c[1] - R - 16); ctx.lineTo(c[0], c[1] + R + 16); ctx.stroke();
    ctx.setLineDash([]);
    drawLabel(ctx, 'Nord géographique', c[0], c[1] - R - 22, { align: 'center' });
    drawLabel(ctx, 'Sud géographique', c[0], c[1] + R + 34, { align: 'center' });
  }
  drawMagnets(ctx) {
    for (let k = 0; k < this.mags.length; k++) {
      const m = this.mags[k], c = this.toPx(m.x, m.y), s = this.sc;
      ctx.save();
      ctx.translate(c[0], c[1]);
      ctx.rotate(-m.a);
      if (m.kind === 'u') {
        ctx.strokeStyle = '#6B655B';
        ctx.lineWidth = 0.72 * s;
        ctx.beginPath();
        ctx.moveTo(1.0 * s, -0.95 * s);
        ctx.lineTo(-0.25 * s, -0.95 * s);
        ctx.arc(-0.25 * s, 0, 0.95 * s, -Math.PI / 2, Math.PI / 2, true);
        ctx.lineTo(1.0 * s, 0.95 * s);
        ctx.stroke();
        ctx.fillStyle = PAL.red;
        ctx.fillRect(1.0 * s, -1.31 * s, 0.75 * s, 0.72 * s);
        ctx.fillStyle = PAL.blue;
        ctx.fillRect(1.0 * s, 0.59 * s, 0.75 * s, 0.72 * s);
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(1.0 * s, -1.31 * s, 0.75 * s, 0.72 * s);
        ctx.strokeRect(1.0 * s, 0.59 * s, 0.75 * s, 0.72 * s);
        ctx.fillStyle = '#fff';
        ctx.font = fnt(Math.max(10, 0.45 * s), 800, FONTD);
        ctx.textAlign = 'center';
        ctx.fillText('N', 1.37 * s, -0.8 * s);
        ctx.fillText('S', 1.37 * s, 1.1 * s);
      } else {
        const L = m.L * s, w = m.w * s;
        ctx.fillStyle = PAL.red;
        ctx.fillRect(0, -w / 2, L / 2, w);
        ctx.fillStyle = PAL.blue;
        ctx.fillRect(-L / 2, -w / 2, L / 2, w);
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 2;
        ctx.strokeRect(-L / 2, -w / 2, L, w);
        ctx.fillStyle = '#fff';
        if (L > 60) {
          ctx.font = fnt(Math.max(11, Math.min(22, w * 0.55)), 800, FONTD);
          ctx.textAlign = 'center';
          ctx.fillText('N', L / 4, w * 0.2);
          ctx.fillText('S', -L / 4, w * 0.2);
        } else {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-L * 0.3, 0); ctx.lineTo(L * 0.3, 0);
          ctx.moveTo(L * 0.3, 0); ctx.lineTo(L * 0.12, -w * 0.18);
          ctx.moveTo(L * 0.3, 0); ctx.lineTo(L * 0.12, w * 0.18);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
  drawProbe(ctx) {
    const h = this.hover, tmp = [0, 0];
    if (this.inside(h[0], h[1])) return;
    const b = this.field(h[0], h[1], tmp), p = this.toPx(h[0], h[1]);
    ctx.fillStyle = 'rgba(251,248,242,0.92)';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p[0], p[1], 23, 0, TAU); ctx.fill(); ctx.stroke();
    drawNeedle(ctx, p[0], p[1], Math.atan2(tmp[1], tmp[0]), 18, 4.6);
    ctx.fillStyle = PAL.ink;
    ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, TAU); ctx.fill();
    drawLabel(ctx, this.fmtB(b * this.kT), p[0] + 28, p[1] - 12);
  }
  drawRealCompass(ctx, W, H) {
    const x = 48, y = H - 52, r = 30;
    ctx.fillStyle = PAL.card;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    drawNeedle(ctx, x, y, Math.PI / 2 + Sensors.heading * DEG, r - 6, 5);
    drawLabel(ctx, 'nord réel', x - 26, y - r - 10);
  }
  pointer(type, x, y) {
    const w = this.toW(x, y);
    if (type === 'down') {
      const k = this.hit(w[0], w[1]);
      this.hover = w;
      if (k >= 0) {
        const m = this.mags[k], l = this.local(m, w[0], w[1]);
        const rot = m.kind === 'earth' || (m.kind === 'bar' && Math.abs(l[0]) > m.L * 0.28 && m.L > 2);
        this.grab = { k: k, rot: rot, ox: w[0] - m.x, oy: w[1] - m.y, a0: m.a - Math.atan2(w[1] - m.y, w[0] - m.x) };
        this.idle = 0;
      }
    } else if (type === 'move' || type === 'hover') {
      this.hover = w;
      if (this.grab && type === 'move') {
        const m = this.mags[this.grab.k];
        if (this.grab.rot) m.a = Math.atan2(w[1] - m.y, w[0] - m.x) + this.grab.a0;
        else {
          const lim = this.W / (2 * this.sc) - 1, limy = this.H / (2 * this.sc) - 0.6;
          m.x = clamp(w[0] - this.grab.ox, -lim, lim);
          m.y = clamp(w[1] - this.grab.oy, -limy, limy);
        }
        this.dirty = true;
        this.idle = 0;
        this.haptic();
      }
    } else if (type === 'up') {
      this.grab = null;
    } else if (type === 'leave') {
      this.grab = null;
      this.hover = null;
    }
  }
  haptic() {
    if (this.hero || this.mags.length < 2) return;
    this.poles();
    const P = this.P, per = 3;
    let dOpp = Infinity, dSame = Infinity;
    for (let a = 0; a < P.length; a += per) {
      for (let b = a + per; b < P.length; b += per) {
        if (Math.floor(a / (2 * per)) === Math.floor(b / (2 * per))) continue;
        const d = Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1]);
        if (P[a + 2] * P[b + 2] < 0) dOpp = Math.min(dOpp, d); else dSame = Math.min(dSame, d);
      }
    }
    const lv = dOpp < 0.9 ? 3 : (dOpp < 1.5 ? 2 : (dOpp < 2.3 ? 1 : 0));
    const rp = dSame < 1.5 ? 1 : 0, now = performance.now();
    if (lv > (this.hapLv || 0) && now - (this.hapT || 0) > 220) {
      this.hapT = now;
      if (lv === 3) { this.host.buzz([70, 40, 110]); this.host.click(1); }
      else this.host.buzz(lv === 2 ? 40 : 18);
    } else if (rp && !this.hapRp && now - (this.hapT || 0) > 220) {
      this.hapT = now;
      this.host.buzz([12, 50, 12, 50, 12]);
    }
    this.hapLv = lv;
    this.hapRp = rp;
  }
  onParam(id, v) {
    if (id === 'scene') this.setScene(v);
    if (id === 'disp') this.linesDirty = true;
  }
  action(id) {
    if (id === 'tap') { this.fil = null; this.host.click(0.6); }
    else if (id === 'flip') { this.mags[0].a += Math.PI; this.dirty = true; }
    else if (id === 'add') {
      if (this.mags.length >= 4 || this.earth) { this.host.toast('Maximum atteint pour cette scène'); return; }
      this.mags.push({ x: (this.rnd() - 0.5) * 6, y: (this.rnd() - 0.5) * 4, a: this.rnd() * TAU, L: 3, w: 0.9, q: 0.8, kind: 'bar' });
      this.dirty = true;
    } else if (id === 'reset') this.setScene(this.p.scene);
  }
  hud() {
    const o = this.obs;
    return [
      ['Champ au curseur', o.Bh === null ? 'promène le doigt' : this.fmtB(o.Bh), 'hot'],
      ['Comparé à la Terre', o.Bh === null ? '—' : '× ' + sciStr(o.Bh / 47e-6, 0)],
      ['Aimants', String(this.mags.length)],
      ['Astuce', 'milieu : déplacer · bout : tourner']
    ];
  }
  drawPlots(p1, p2) {
    const pr = this.prof;
    if (!pr) return;
    const unit = this.earth ? 'µT' : 'mT';
    let ymax = 0;
    for (let i = 0; i < pr.b.length; i++) if (pr.b[i] > ymax) ymax = pr.b[i];
    p1.begin('Champ sur l’axe, depuis le pôle Nord (' + unit + ')', 0, 12, 0, ymax * 1.08 || 1, 'distance au pôle N (cm)', unit);
    p1.clip();
    p1.line(pr.r, pr.b, PAL.red, 2.4);
    p1.unclip();
    const lx = [], ly = [];
    for (let i = 0; i < pr.r.length; i++) {
      if (pr.b[i] <= 0) continue;
      lx.push(Math.log10(pr.r[i]));
      ly.push(Math.log10(pr.b[i]));
    }
    if (lx.length < 2) return;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < ly.length; i++) { lo = Math.min(lo, ly[i]); hi = Math.max(hi, ly[i]); }
    p2.begin('Même courbe, échelle log : la pente dit tout', -0.6, 1.1, lo - 0.3, hi + 0.3, 'log₁₀ distance (cm)', 'log₁₀ B');
    p2.clip();
    const x0 = lx[0], y0 = ly[0], xe = lx[lx.length - 1], ye = ly[ly.length - 1];
    p2.line([x0, x0 + 0.9], [y0, y0 - 1.8], PAL.ink3, 1.4, true);
    p2.line([xe - 1.0, xe], [ye + 3.0, ye], PAL.gold, 1.4, true);
    p2.line(lx, ly, PAL.red, 2.4);
    p2.unclip();
    p2.text('pente −2 (près du pôle)', p2.X(x0 + 0.1), p2.Y(y0 - 0.05) + 16, PAL.ink3);
    p2.text('pente −3 (dipôle, loin)', p2.X(xe) - 4, p2.Y(ye + 0.4), PAL.gold, 'right');
  }
}

class MagnetoSim extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.view = { yaw: -0.5, pitch: 0.5 };
    this.trail = [];
    this.h = { t: [], b: [], x: [], y: [], z: [] };
    this.vec = [0, 20.6, -42.2];
    this.Bm = 47;
    this.src = 'virtuel';
    this.acc = 0;
    this.stable = 0;
    this.maxB = 0;
    this.obs = {};
  }
  timeInfo() { return 'Temps réel'; }
  drag(dx, dy) {
    this.view.yaw -= dx * 0.008;
    this.view.pitch = clamp(this.view.pitch + dy * 0.008, -1.4, 1.4);
  }
  earthVec(hd) {
    const h = hd * DEG, Bh = 20.6, Bv = 42.2;
    return [-Bh * Math.sin(h), Bh * Math.cos(h), -Bv];
  }
  action(id) {
    const self = this;
    if (id === 'sensors') Sensors.start().then(function () { self.host.toast(Sensors.label()); });
    else if (id === 'zero') {
      this.h = { t: [], b: [], x: [], y: [], z: [] };
      this.maxB = 0;
      this.trail = [];
    }
  }
  update(dtReal) {
    this.t += dtReal;
    const S = Sensors, p = this.p;
    let v, src;
    if (p.src !== 'virt' && S.hasMag && S.B) {
      v = S.B.slice();
      src = 'magnétomètre';
    } else if (p.src !== 'virt' && S.real && S.heading !== null) {
      v = this.earthVec(S.heading);
      const k = 1 + 40 * S.magnet;
      v = [v[0] * k, v[1] * k, v[2] * k];
      src = 'boussole du téléphone';
    } else {
      v = this.earthVec(p.head);
      if (p.magOn) v[0] += 2e4 / Math.pow(p.dist, 3);
      src = 'virtuel';
    }
    this.vec = v;
    this.src = src;
    this.Bm = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    this.maxB = Math.max(this.maxB, this.Bm);
    this.acc += dtReal;
    if (this.acc > 0.05) {
      this.acc = 0;
      const h = this.h;
      h.t.push(this.t); h.b.push(this.Bm); h.x.push(v[0]); h.y.push(v[1]); h.z.push(v[2]);
      while (h.t.length && this.t - h.t[0] > 30) { h.t.shift(); h.b.shift(); h.x.shift(); h.y.shift(); h.z.shift(); }
      const n = 1 / (this.Bm || 1);
      this.trail.push([v[0] * n, v[1] * n, v[2] * n]);
      if (this.trail.length > 200) this.trail.shift();
    }
    const earthLike = this.Bm > 22 && this.Bm < 70;
    this.stable = (src === 'magnétomètre' && earthLike) ? this.stable + dtReal : 0;
    const hd = src === 'virtuel' ? p.head : S.heading;
    this.heading = hd;
    this.obs = { real: src === 'magnétomètre', compass: src !== 'virtuel', B: this.Bm, maxB: this.maxB, heading: hd, earthOK: this.stable > 2 };
  }
  draw(ctx, W, H) {
    const n = 1 / (this.Bm || 1), m = [this.vec[0] * n, this.vec[1] * n, this.vec[2] * n];
    const wide = W > H * 1.15;
    const sw = wide ? W * 0.56 : W, sh = wide ? H : H * 0.6;
    drawSphere(ctx, sw, sh, this.view, { m: m, trail: this.trail, mLabel: 'B' });
    ctx.fillStyle = PAL.ink3;
    ctx.font = fnt(11, 400);
    ctx.textAlign = 'center';
    ctx.fillText('repère du téléphone : x → droite · y → haut de l’écran · z → vers toi', sw / 2, sh - 8);
    if (wide) this.drawGauge(ctx, W * 0.58, 18, W * 0.4, H - 36);
    else this.drawGauge(ctx, 14, sh + 4, W - 28, H - sh - 14);
  }
  drawGauge(ctx, x, y, w, h) {
    drawCard(ctx, x, y, w, h);
    const pad = 14, S = Sensors;
    const rc = Math.max(18, Math.min(h * 0.26, w * 0.17));
    const cx = x + w - pad - rc, cy = y + pad + rc + 4;
    ctx.fillStyle = PAL.ink3;
    ctx.font = fnt(11, 700);
    ctx.textAlign = 'left';
    ctx.fillText('CHAMP · ' + this.src.toUpperCase(), x + pad, y + pad + 8);
    const fs = Math.max(20, Math.min(44, h * 0.2));
    const big = this.Bm >= 1000 ? frNum(this.Bm / 1000, 2) + ' mT' : frNum(this.Bm, 1) + ' µT';
    ctx.fillStyle = PAL.ink;
    ctx.font = fnt(fs, 800, FONTD);
    ctx.fillText(big, x + pad, y + pad + 14 + fs);
    ctx.fillStyle = PAL.ink2;
    ctx.font = fnt(12, 400);
    ctx.fillText('= ' + frNum(this.Bm / 47, 1) + ' × le champ terrestre', x + pad, y + pad + 34 + fs);
    ctx.fillStyle = PAL.card;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rc, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.ink3;
    ctx.font = fnt(10, 700);
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - rc + 11);
    if (this.heading !== null && this.heading !== undefined) {
      drawNeedle(ctx, cx, cy, Math.PI / 2 + this.heading * DEG, rc - 8, Math.max(3, rc * 0.14));
    } else {
      ctx.fillStyle = PAL.ink3;
      ctx.font = fnt(18, 800, FONTD);
      ctx.fillText('?', cx, cy + 6);
    }
    ctx.fillStyle = PAL.ink;
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, TAU); ctx.fill();
    const bx = x + pad, bw = w - 2 * pad, by = y + h - 50;
    if (by < cy + rc + 8) return;
    const pos = function (v) { return bx + bw * clamp(Math.log10(Math.max(v, 1)) / 6, 0, 1); };
    ctx.fillStyle = 'rgba(23,20,15,0.08)';
    ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = PAL.red;
    ctx.fillRect(bx, by, pos(this.Bm) - bx, 10);
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, 10);
    const marks = [[47, 'Terre'], [1000, '1 mT'], [10000, 'aimant de frigo'], [400000, 'néodyme']];
    ctx.font = fnt(10, 700);
    for (let i = 0; i < marks.length; i++) {
      const px = pos(marks[i][0]);
      ctx.beginPath(); ctx.moveTo(px, by - 3); ctx.lineTo(px, by + 13); ctx.stroke();
      ctx.fillStyle = PAL.ink2;
      ctx.textAlign = i === marks.length - 1 ? 'right' : 'center';
      ctx.fillText(marks[i][1], i === marks.length - 1 ? Math.min(px + 20, bx + bw) : px, by + 26);
    }
    ctx.fillStyle = PAL.ink3;
    ctx.textAlign = 'left';
    ctx.fillText('1 µT', bx, by - 6);
    ctx.textAlign = 'right';
    ctx.fillText('1 T', bx + bw, by - 6);
    if (S.state().magnet > 0.3 || this.Bm > 200) drawLabel(ctx, 'Aimant détecté !', x + pad, by - 14, { col: '#fff', bg: PAL.red, bd: PAL.red });
  }
  hud() {
    const o = this.obs, S = Sensors;
    const inc = Math.atan2(-this.vec[2], Math.sqrt(this.vec[0] * this.vec[0] + this.vec[1] * this.vec[1])) / DEG;
    const det = S.state().magnet > 0.3 || this.Bm > 200;
    const caps = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const hd = o.heading;
    return [
      ['|B|', (this.Bm >= 1000 ? frNum(this.Bm / 1000, 2) + ' mT' : frNum(this.Bm, 1) + ' µT') + (this.src === 'boussole du téléphone' ? ' (estimé)' : ''), 'hot'],
      ['Comparé à la Terre', '× ' + frNum(this.Bm / 47, 1)],
      ['Cap (nord = 0°)', hd === null || hd === undefined ? '—' : frNum(hd, 0) + '° ' + caps[Math.round(hd / 45) % 8]],
      ['Inclinaison du champ', frNum(inc, 0) + '°'],
      ['Source', this.src, this.src === 'magnétomètre' ? 'good' : ''],
      ['Aimant détecté ?', det ? 'OUI' : 'non', det ? 'bad' : '']
    ];
  }
  drawPlots(p1, p2) {
    const h = this.h, tl = h.t.length ? h.t[h.t.length - 1] : 30, t0 = tl - 30, ts = h.t.map(function (v) { return v - t0; });
    const lb = h.b.map(function (v) { return Math.log10(Math.max(v, 0.1)); });
    p1.begin('|B| sur 30 s (échelle log, en µT)', 0, 30, 0, 5, 'temps (s)', 'log₁₀ B');
    p1.hline(Math.log10(47), PAL.leaf, true, 'Terre');
    p1.clip();
    p1.line(ts, lb, PAL.red, 2.2);
    p1.unclip();
    let lim = 60;
    for (let i = 0; i < h.t.length; i++) lim = Math.max(lim, Math.abs(h.x[i]), Math.abs(h.y[i]), Math.abs(h.z[i]));
    lim *= 1.15;
    p2.begin('Composantes du champ (µT)', 0, 30, -lim, lim, 'temps (s)', 'µT');
    p2.clip();
    p2.line(ts, h.x, PAL.x, 2);
    p2.line(ts, h.y, PAL.y, 2);
    p2.line(ts, h.z, PAL.z, 2);
    p2.unclip();
    p2.legend([{ col: PAL.x, label: 'Bx' }, { col: PAL.y, label: 'By' }, { col: PAL.z, label: 'Bz' }]);
  }
}

const CURIE_TC = 2 / Math.log(1 + Math.SQRT2);

class CurieSim extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.N = 128;
    this.n = 16384;
    this.s = new Int8Array(this.n);
    this.cv = document.createElement('canvas');
    this.cv.width = this.N; this.cv.height = this.N;
    this.cx = this.cv.getContext('2d');
    this.img = this.cx.createImageData(this.N, this.N);
    this.u32 = new Uint32Array(this.img.data.buffer);
    this.r = xorshift(12345);
    this.acc = new Float64Array(10);
    this.cUp = packRGB(215, 48, 31);
    this.cDn = packRGB(31, 78, 156);
    this.extraT = 0;
    this.bins = new Float64Array(80);
    this.binN = new Float64Array(80);
    this.Tstamp = 0;
    this.lastT = null;
    this.anneal = null;
    this.annealDone = false;
    this.wasMag = false;
    this.crit = 0;
    this.shakeMax = 0;
    this.M = 1;
    this.init('up');
  }
  timeInfo() { return 'Temps Monte-Carlo (pas d’horloge réelle)'; }
  Teff() { return clamp(this.p.T + this.extraT, 0.05, 8); }
  init(kind) {
    const s = this.s, r = this.r;
    for (let i = 0; i < this.n; i++) s[i] = kind === 'up' ? 1 : ((r() & 1) ? 1 : -1);
    this.sweeps = 0;
    this.hist = { t: [], m: [], a: [] };
    this.M = this.mag();
    this.Tstamp = 0;
  }
  mag() {
    let m = 0;
    for (let i = 0; i < this.n; i++) m += this.s[i];
    return m / this.n;
  }
  celsius(T) {
    const tc = { fe: 1043, ni: 627, gd: 293, nd: 585 }[this.p.mat] || 1043;
    return T / CURIE_TC * tc - 273.15;
  }
  update(dtReal, speed) {
    const p = this.p;
    if (this.anneal) {
      this.anneal.k += dtReal / 22;
      const T = 3.6 - 3.0 * Math.min(1, this.anneal.k);
      p.T = T;
      this.host.setParamUI('T', T);
      if (this.anneal.k >= 1) { this.anneal = null; this.annealDone = true; }
    }
    this.extraT *= Math.exp(-dtReal / 1.5);
    if (this.extraT < 0.01) this.extraT = 0;
    const T = this.Teff(), h = p.h;
    if (this.lastT === null || Math.abs(T - this.lastT) > 0.04) { this.lastT = T; this.Tstamp = 0; } else this.Tstamp += dtReal;
    const acc = this.acc;
    for (let si = 0; si < 2; si++) {
      const sv = si === 0 ? -1 : 1;
      for (let k = 0; k < 5; k++) {
        const dE = 2 * sv * ((2 * k - 4) + h);
        acc[si * 5 + k] = dE <= 0 ? 1 : Math.exp(-dE / T);
      }
    }
    const s = this.s, r = this.r;
    const nsw = Math.max(1, Math.round(p.speed * speed));
    const tot = nsw * 16384;
    for (let k = 0; k < tot; k++) {
      const i = r() & 16383;
      const x = i & 127, y = i >> 7;
      const sum = s[(y << 7) | ((x + 1) & 127)] + s[(y << 7) | ((x + 127) & 127)] + s[(((y + 1) & 127) << 7) | x] + s[(((y + 127) & 127) << 7) | x];
      const si = s[i];
      const a = acc[(si > 0 ? 5 : 0) + ((sum + 4) >> 1)];
      if (a >= 1 || r() < a * 4294967296) s[i] = -si;
    }
    this.sweeps += nsw;
    const M = this.mag(), A = Math.abs(M);
    this.M = M;
    if (A > 0.8) this.wasMag = true;
    if (Math.abs(T - CURIE_TC) < 0.11) this.crit += dtReal;
    if (this.Tstamp > 0.8) {
      const b = Math.min(79, Math.floor(T * 10));
      this.bins[b] += A;
      this.binN[b] += 1;
    }
    const hs = this.hist;
    hs.t.push(this.sweeps); hs.m.push(M); hs.a.push(A);
    if (hs.t.length > 500) { hs.t.shift(); hs.m.shift(); hs.a.shift(); }
    this.obs = { T: T, A: A, wasMag: this.wasMag, annealDone: this.annealDone, crit: this.crit, shakeMax: this.shakeMax };
  }
  onParam(id) {
    if (id === 'T') this.anneal = null;
  }
  action(id) {
    if (id === 'up') this.init('up');
    else if (id === 'random') this.init('random');
    else if (id === 'anneal') { this.init('random'); this.anneal = { k: 0 }; this.annealDone = false; }
    else if (id === 'heat') { this.anneal = null; this.p.T = 4; this.host.setParamUI('T', 4); }
    else if (id === 'quench') { this.anneal = null; this.init('random'); this.p.T = 1.2; this.host.setParamUI('T', 1.2); }
    else if (id === 'reset') { this.bins.fill(0); this.binN.fill(0); this.init('up'); }
  }
  draw(ctx, W, H) {
    const s = this.s, u = this.u32, cu = this.cUp, cd = this.cDn;
    for (let i = 0; i < this.n; i++) u[i] = s[i] > 0 ? cu : cd;
    this.cx.putImageData(this.img, 0, 0);
    const side = Math.max(60, Math.min(W - 130, H - 28)), x0 = Math.max(10, (W - 100 - side) / 2), y0 = (H - side) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.cv, x0, y0, side, side);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, side + 1, side + 1);
    this.drawThermo(ctx, x0 + side + 46, y0 + 6, side - 40);
    if (this.extraT > 0.15) drawLabel(ctx, 'Secousse = chaleur ! +' + frNum(this.extraT, 1), x0 + 10, y0 + 26, { col: '#fff', bg: PAL.red, bd: PAL.red });
    if (this.anneal) drawLabel(ctx, 'Refroidissement lent…', x0 + 10, y0 + side - 12);
  }
  drawThermo(ctx, x, y, h) {
    const T = this.Teff(), f = clamp(T / 5, 0, 1), w = 18;
    ctx.fillStyle = PAL.card;
    roundRect(ctx, x - w / 2, y, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const g = ctx.createLinearGradient(0, y + h, 0, y);
    g.addColorStop(0, PAL.blue);
    g.addColorStop(0.5, '#8E4A8C');
    g.addColorStop(1, PAL.red);
    ctx.fillStyle = g;
    const fh = Math.max(4, f * (h - 6));
    roundRect(ctx, x - w / 2 + 3, y + h - 3 - fh, w - 6, fh, 5);
    ctx.fill();
    const yc = y + h - 3 - (CURIE_TC / 5) * (h - 6);
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, yc); ctx.lineTo(x + w / 2 + 8, yc); ctx.stroke();
    ctx.fillStyle = PAL.ink;
    ctx.font = fnt(11, 800);
    ctx.textAlign = 'right';
    ctx.fillText('T_C', x - w / 2 - 10, yc + 4);
    ctx.textAlign = 'center';
    ctx.font = fnt(12, 700);
    ctx.fillText(frNum(this.celsius(T), 0) + ' °C', x, y + h + 18);
    ctx.font = fnt(10, 400);
    ctx.fillStyle = PAL.ink3;
    ctx.fillText('chaud', x, y - 6);
  }
  hud() {
    const T = this.Teff(), r = T / CURIE_TC;
    const mat = { fe: 'fer', ni: 'nickel', gd: 'gadolinium', nd: 'néodyme-fer-bore' }[this.p.mat] || 'fer';
    const ph = r < 0.93 ? 'aimant (ferro)' : (r < 1.07 ? 'critique !' : 'désordonné (para)');
    return [
      ['Température', frNum(T, 2) + '  (T/T_C = ' + frNum(r, 2) + ')', 'hot'],
      ['Équivalent ' + mat, '≈ ' + frNum(this.celsius(T), 0) + ' °C'],
      ['Aimantation M', frNum(this.M, 2), Math.abs(this.M) > 0.8 ? 'good' : ''],
      ['Phase', ph, (r >= 0.93 && r < 1.07) ? 'bad' : ''],
      ['Balayages Monte-Carlo', frNum(this.sweeps, 0)]
    ];
  }
  drawPlots(p1, p2) {
    const h = this.hist, x0 = h.t.length ? h.t[0] : 0, x1 = h.t.length > 1 ? h.t[h.t.length - 1] : x0 + 1;
    p1.begin('Aimantation au fil des balayages', x0, x1, -1.05, 1.05, 'balayages Monte-Carlo', 'M');
    p1.clip();
    p1.line(h.t, h.a, PAL.ink3, 1.5);
    p1.line(h.t, h.m, PAL.red, 2.2);
    p1.unclip();
    p1.legend([{ col: PAL.red, label: 'M' }, { col: PAL.ink3, label: '|M|' }]);
    p2.begin('Courbe M(T) : la transition de phase', 0, 5, 0, 1.05, 'température (unités J/k_B)', '|M|');
    const ox = [], oy = [];
    for (let T = 0.1; T < CURIE_TC; T += 0.02) { ox.push(T); oy.push(Math.pow(Math.max(0, 1 - Math.pow(Math.sinh(2 / T), -4)), 0.125)); }
    ox.push(CURIE_TC); oy.push(0); ox.push(5); oy.push(0);
    p2.clip();
    p2.line(ox, oy, PAL.ink3, 1.6, true);
    const bx = [], by = [];
    for (let b = 0; b < 80; b++) if (this.binN[b] > 5) { bx.push((b + 0.5) / 10); by.push(this.bins[b] / this.binN[b]); }
    p2.dots(bx, by, PAL.red, 3.5);
    p2.dot(this.Teff(), Math.abs(this.M), PAL.ink, 5);
    p2.unclip();
    p2.vline(CURIE_TC, PAL.gold, true, 'T_C');
    p2.text('pointillé : solution exacte d’Onsager (1944)', p2.box.l + 8, p2.box.t + p2.ph - 8, PAL.ink3);
  }
}

class BarkhausenSim extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.N = 96;
    this.n = 9216;
    const N = this.N, n = this.n;
    this.s = new Int8Array(n);
    this.hr = new Float32Array(n);
    this.fl = new Float32Array(n);
    this.q = new Int32Array(n);
    this.nbr = new Int32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const x = i % N, y = (i - x) / N;
      this.nbr[4 * i] = y * N + (x + 1) % N;
      this.nbr[4 * i + 1] = y * N + (x + N - 1) % N;
      this.nbr[4 * i + 2] = ((y + 1) % N) * N + x;
      this.nbr[4 * i + 3] = ((y + N - 1) % N) * N + x;
    }
    this.cv = document.createElement('canvas');
    this.cv.width = N; this.cv.height = N;
    this.cx = this.cv.getContext('2d');
    this.img = this.cx.createImageData(N, N);
    this.u32 = new Uint32Array(this.img.data.buffer);
    this.u = uni(xorshift(777));
    this.build();
  }
  timeInfo() { return 'Champ balayé lentement (quasi-statique)'; }
  build() {
    const R = this.p.R;
    for (let i = 0; i < this.n; i++) this.hr[i] = R * gauss(this.u);
    this.reset();
  }
  reset() {
    this.s.fill(-1);
    this.Hmax = 3.5 + 1.2 * this.p.R;
    this.H = -this.Hmax;
    this.dir = 1;
    this.sum = -this.n;
    this.M = -1;
    this.loopH = [];
    this.loopM = [];
    this.bins = new Float64Array(16);
    this.nAv = 0;
    this.maxAv = 0;
    this.last = 0;
    this.half = { c: 0, m: 0 };
    this.lastHalf = null;
    this.snap = false;
    this.fl.fill(0);
    this.obs = {};
  }
  locf(i) {
    const nb = this.nbr, s = this.s, k = 4 * i;
    return s[nb[k]] + s[nb[k + 1]] + s[nb[k + 2]] + s[nb[k + 3]] + this.hr[i] + this.H;
  }
  aval(seed, d) {
    const s = this.s, q = this.q, fl = this.fl, nb = this.nbr;
    s[seed] = d;
    fl[seed] = 1;
    q[0] = seed;
    let head = 0, tail = 1;
    while (head < tail) {
      const k = 4 * q[head++];
      for (let e = 0; e < 4; e++) {
        const j = nb[k + e];
        if (s[j] === -d && d * this.locf(j) > 0) {
          s[j] = d;
          fl[j] = 1;
          q[tail++] = j;
        }
      }
    }
    return tail;
  }
  rampTo(Hn, out) {
    if (Hn === this.H) return;
    const d = Hn > this.H ? 1 : -1, s = this.s;
    this.H = Hn;
    this.dir = d;
    for (let i = 0; i < this.n; i++) {
      if (s[i] === -d && d * this.locf(i) > 0) {
        const sz = this.aval(i, d);
        this.sum += 2 * d * sz;
        out.push(sz);
      }
    }
    this.loopH.push(this.H);
    this.loopM.push(this.sum / this.n);
    if (this.loopH.length > 9000) { this.loopH.splice(0, 1500); this.loopM.splice(0, 1500); }
  }
  record(sz) {
    this.nAv++;
    this.last = sz;
    if (sz > this.maxAv) this.maxAv = sz;
    this.bins[Math.min(15, Math.floor(Math.log2(sz)))]++;
    this.half.c++;
    if (sz > this.half.m) this.half.m = sz;
    if (sz > this.n / 2) this.snap = true;
  }
  halfDone() {
    this.lastHalf = this.half;
    this.half = { c: 0, m: 0 };
  }
  update(dtReal, speed) {
    const p = this.p, out = [], step = 0.004;
    if (p.auto) {
      const dH = p.rate * 0.55 * dtReal * speed;
      const nsub = Math.min(80, Math.max(1, Math.ceil(dH / step)));
      const hs = dH / nsub;
      for (let k = 0; k < nsub; k++) {
        const Hn = this.H + this.dir * hs;
        if (Hn >= this.Hmax) { this.rampTo(this.Hmax, out); this.dir = -1; this.halfDone(); break; }
        if (Hn <= -this.Hmax) { this.rampTo(-this.Hmax, out); this.dir = 1; this.halfDone(); break; }
        this.rampTo(Hn, out);
      }
      p.H = this.H;
      this.host.setParamUI('H', this.H);
    } else {
      const tgt = clamp(p.H, -this.Hmax, this.Hmax);
      let k = 0;
      while (k < 80 && Math.abs(tgt - this.H) > 1e-9) {
        const st = clamp(tgt - this.H, -step, step);
        this.rampTo(this.H + st, out);
        k++;
      }
    }
    if (out.length) {
      for (let i = 0; i < out.length; i++) this.record(out[i]);
      const top = out.slice().sort(function (a, b) { return b - a; }).slice(0, 6);
      for (let i = 0; i < top.length; i++) this.host.click(clamp(0.1 + 0.25 * Math.log10(top[i] + 1), 0, 1));
      if (top[0] > 300) this.host.buzz(Math.min(120, 20 + top[0] / 40));
    }
    const fl = this.fl;
    for (let i = 0; i < this.n; i++) fl[i] *= 0.9;
    this.M = this.sum / this.n;
    const lh = this.lastHalf;
    this.obs = {
      snap: this.snap,
      crackle: !!(lh && lh.c >= 200),
      smooth: !!(lh && lh.c >= 60 && lh.m <= 20),
      maxAv: this.maxAv
    };
  }
  onParam(id) {
    if (id === 'R') this.build();
    if (id === 'H' && this.p.auto) {
      this.p.auto = false;
      this.host.setParamUI('auto', false);
    }
  }
  action(id) {
    if (id === 'newdis') this.build();
    else if (id === 'reset') this.reset();
  }
  draw(ctx, W, H) {
    const s = this.s, fl = this.fl, u = this.u32;
    for (let i = 0; i < this.n; i++) {
      let r, g, b;
      if (s[i] > 0) { r = 215; g = 48; b = 31; } else { r = 31; g = 78; b = 156; }
      const f = fl[i];
      if (f > 0.03) { r += (242 - r) * f; g += (188 - g) * f; b += (36 - b) * f; }
      u[i] = packRGB(r | 0, g | 0, b | 0);
    }
    this.cx.putImageData(this.img, 0, 0);
    const side = Math.max(60, Math.min(W - 24, H - 24)), x0 = (W - side) / 2, y0 = (H - side) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.cv, x0, y0, side, side);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, side + 1, side + 1);
    drawLabel(ctx, 'H = ' + frNum(this.H, 2) + (this.dir > 0 ? '  ↑' : '  ↓'), x0 + 10, y0 + 26);
    if (!Snd.on) drawLabel(ctx, 'Active le son (en haut) pour entendre craquer', x0 + 10, y0 + side - 12, { col: PAL.ink2 });
  }
  hud() {
    const lh = this.lastHalf, hm = lh ? lh.m : this.half.m;
    let reg = '—';
    if (this.nAv > 20) reg = hm > this.n / 2 ? 'claquement géant (snap)' : (hm > 40 ? 'craquements (crackle)' : 'petits « pops »');
    return [
      ['Champ H', frNum(this.H, 2), 'hot'],
      ['Aimantation M', frNum(this.M, 2)],
      ['Dernière avalanche', this.last + ' spins'],
      ['Record', this.maxAv + ' spins'],
      ['Régime', reg]
    ];
  }
  drawPlots(p1, p2) {
    p1.begin('Cycle d’hystérésis M(H) : un escalier', -this.Hmax, this.Hmax, -1.08, 1.08, 'champ H', 'M');
    p1.clip();
    p1.line(this.loopH, this.loopM, PAL.ink, 1.6);
    p1.dot(this.H, this.M, PAL.red, 5);
    p1.unclip();
    const xs = [], ys = [];
    for (let b = 0; b < 16; b++) {
      if (this.bins[b] <= 0) continue;
      const S = Math.pow(2, b) * 1.5, w = Math.pow(2, b);
      xs.push(Math.log10(S));
      ys.push(Math.log10(this.bins[b] / w / Math.max(1, this.nAv)));
    }
    let lo = -6;
    for (let i = 0; i < ys.length; i++) lo = Math.min(lo, ys[i]);
    p2.begin('Tailles des avalanches (log-log)', 0, 4.2, lo - 0.3, 0.3, 'log₁₀ taille (spins)', 'log₁₀ fréquence');
    p2.clip();
    if (xs.length) p2.line([xs[0], xs[0] + 3], [ys[0], ys[0] - 4.5], PAL.gold, 1.4, true);
    p2.dots(xs, ys, PAL.red, 4);
    p2.unclip();
    p2.text('pointillé : loi de puissance, pente −3/2', p2.box.l + 8, p2.box.t + p2.ph - 8, PAL.gold);
  }
}

const DISK_MAT = {
  hdd: { K: 3.5e5, Ms: 4e5, Tc: 700, h: 12e-9, d: 9, name: 'CoCrPt (disque dur)' },
  card: { K: 1.6e4, Ms: 3e5, Tc: 850, h: 40e-9, d: 30, name: 'oxyde de fer (carte)' },
  hamr: { K: 4.5e6, Ms: 1e6, Tc: 750, h: 10e-9, d: 4, name: 'FePt (HAMR)' }
};
const DISK_CLOCK = { rt: [1, '1 s ici = 1 s'], min: [60, '1 s ici = 1 min'], day: [86400, '1 s ici = 1 jour'], year: [3.156e7, '1 s ici = 1 an'], kyear: [3.156e10, '1 s ici = 1 000 ans'] };
const HEAD_T = 2.0;

class DiskSim extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.G = 5;
    this.ng = 480;
    this.s = new Int8Array(this.ng);
    this.df = new Float64Array(this.ng);
    this.u = uni(xorshift(4242));
    for (let i = 0; i < this.ng; i++) {
      this.df[i] = Math.exp(0.08 * gauss(this.u));
      this.s[i] = this.u() < 0.5 ? 1 : -1;
    }
    this.gx = new Float64Array(this.ng);
    this.gy = new Float64Array(this.ng);
    this.ref = null;
    this.simT = 0;
    this.writing = null;
    this.heatT = 0;
    this.mag = null;
    this.extraHeat = 0;
    this.phoneB = 0;
    this.magUsed = false;
    this.wrote = false;
    this.writeOk = false;
    this.laserAtWrite = false;
    this.rec = { t: [], c: [] };
    this.recAcc = 0;
    this.correct = 0;
    this.bits = [];
    this.chars = [];
    this.text = '';
    this.writeWord(this.p.word, true);
    this.read();
    this.obs = {};
  }
  M() { return DISK_MAT[this.p.mat] || DISK_MAT.hdd; }
  red(Tk) {
    const tc = this.M().Tc;
    if (Tk >= tc) return 0;
    return Math.pow(1 - Tk / tc, 0.4) / Math.pow(1 - 300 / tc, 0.4);
  }
  Kof(Tk) { return this.M().K * Math.pow(this.red(Tk), 3); }
  HKof(Tk) { const m = this.M(), r = this.red(Tk); return 2 * m.K / m.Ms * r * r; }
  vol(i) { const m = this.M(), d = this.p.d * 1e-9 * this.df[i]; return Math.PI / 4 * d * d * m.h; }
  Tk() { return this.p.T + 273.15 + this.extraHeat + (this.heatT > 0 ? 300 : 0); }
  timeInfo() { return this.writing ? 'Écriture en cours (temps réel)' : (DISK_CLOCK[this.p.clock] || DISK_CLOCK.year)[1]; }
  bitsOf(word) {
    let w = String(word || '');
    if (w.normalize) w = w.normalize('NFD').replace(/[̀-ͯ]/g, '');
    w = (w + '            ').slice(0, 12);
    const bits = [];
    for (let c = 0; c < 12; c++) {
      let code = w.charCodeAt(c);
      if (code > 126 || code < 32) code = 63;
      for (let b = 7; b >= 0; b--) bits.push((code >> b) & 1);
    }
    return bits;
  }
  canWrite() {
    const Tw = this.p.laser ? 0.97 * this.M().Tc : this.Tk();
    return this.HKof(Tw) < HEAD_T;
  }
  applyWrite(bits, a, b) {
    const ok = this.canWrite();
    if (!ok) return false;
    for (let k = a; k < b; k++) for (let g = 0; g < this.G; g++) this.s[k * this.G + g] = bits[k] ? 1 : -1;
    return true;
  }
  finishWrite(bits, fail) {
    this.ref = bits;
    this.wrote = true;
    this.writeOk = !fail;
    this.simT = 0;
    this.rec = { t: [], c: [] };
  }
  writeWord(word, instant) {
    const bits = this.bitsOf(word);
    this.magUsed = false;
    if (instant) {
      const ok = this.applyWrite(bits, 0, 96);
      this.finishWrite(bits, !ok);
    } else {
      this.writing = { pos: 0, bits: bits, fail: false };
      this.laserAtWrite = !!this.p.laser;
    }
  }
  read() {
    const G = this.G, bits = new Array(96);
    let correct = 0;
    for (let k = 0; k < 96; k++) {
      let sum = 0;
      for (let g = 0; g < G; g++) sum += this.s[k * G + g];
      bits[k] = sum > 0 ? 1 : 0;
      if (this.ref && bits[k] === this.ref[k]) correct++;
    }
    const chars = [];
    for (let c = 0; c < 12; c++) {
      let code = 0;
      for (let b = 0; b < 8; b++) code = (code << 1) | bits[c * 8 + b];
      chars.push(code);
    }
    this.bits = bits;
    this.chars = chars;
    this.correct = this.ref ? correct : 0;
    this.text = chars.map(function (c) { return (c >= 32 && c <= 126) ? String.fromCharCode(c) : '·'; }).join('');
  }
  update(dtReal, speed) {
    const p = this.p, clk = (DISK_CLOCK[p.clock] || DISK_CLOCK.year)[0];
    this.heatT -= dtReal;
    this.extraHeat *= Math.exp(-dtReal / 1.2);
    if (this.extraHeat < 0.5) this.extraHeat = 0;
    if (this.writing) {
      const w = this.writing, np = Math.min(96, w.pos + dtReal * 48);
      const a = Math.floor(w.pos), b = Math.floor(np);
      if (b > a && !this.applyWrite(w.bits, a, b)) w.fail = true;
      w.pos = np;
      this.laserAtWrite = !!p.laser;
      if (w.pos >= 96) {
        this.finishWrite(w.bits, w.fail);
        this.writing = null;
        if (w.fail) this.host.toast('Écriture impossible : μ₀H_K = ' + frNum(this.HKof(this.Tk()), 1) + ' T, plus que les 2 T de la tête. Allume le laser !');
        else { this.host.toast('Mot écrit ! Laisse maintenant passer le temps…'); this.host.sfx('flip'); }
      }
    }
    const dts = this.writing ? dtReal : dtReal * clk * speed;
    if (!this.writing) this.simT += dts;
    const Tk = this.Tk(), K = this.Kof(Tk), HK = this.HKof(Tk), kT = KB * Tk, Ms = this.M().Ms * this.red(Tk);
    const mg = this.mag, r0 = 46;
    let flips = 0;
    for (let i = 0; i < this.ng; i++) {
      let Bz = this.phoneB;
      if (mg && p.Bm > 0) {
        const dx = this.gx[i] - mg[0], dy = this.gy[i] - mg[1], q = 1 + (dx * dx + dy * dy) / (r0 * r0);
        Bz += p.Bm / (q * Math.sqrt(q));
      }
      const si = this.s[i];
      if (HK <= 1e-6) {
        const ns = this.u() < 0.5 ? 1 : -1;
        if (ns !== si) { this.s[i] = ns; flips++; }
        continue;
      }
      const al = si * Bz / HK;
      if (al <= -1) { this.s[i] = -si; flips++; continue; }
      const V = this.vol(i), x = K * V * (1 + al) * (1 + al) / kT;
      const pr = 1e9 * Math.exp(-Math.min(x, 700)) * dts;
      if (pr > 4) {
        const dE = 2 * Ms * V * Bz / kT, pu = 1 / (1 + Math.exp(-clamp(dE, -50, 50)));
        const ns = this.u() < pu ? 1 : -1;
        if (ns !== si) { this.s[i] = ns; flips++; }
      } else if (pr > 1e-12 && this.u() < 1 - Math.exp(-pr)) {
        this.s[i] = -si;
        flips++;
      }
    }
    if ((mg && p.Bm > 0.05) || this.phoneB > 0.05) this.magUsed = true;
    for (let k = 0; k < Math.min(4, flips); k++) this.host.click(0.12 + 0.1 * Math.random());
    this.read();
    this.recAcc += dtReal;
    if (this.recAcc > 0.2 && this.wrote && !this.writing) {
      this.recAcc = 0;
      this.rec.t.push(Math.log10(Math.max(1, this.simT)));
      this.rec.c.push(this.correct / 96);
      if (this.rec.t.length > 800) { this.rec.t.shift(); this.rec.c.shift(); }
    }
    this.obs = { wrote: this.wrote, ok: this.writeOk, correct: this.correct, simT: this.simT, mat: p.mat, laser: this.laserAtWrite, magUsed: this.magUsed, hot: p.T > 60 };
  }
  onParam(id, v) {
    if (id === 'mat') {
      const m = DISK_MAT[v] || DISK_MAT.hdd;
      this.p.d = m.d;
      this.host.setParamUI('d', m.d);
    }
  }
  action(id) {
    if (id === 'write') {
      if (this.writing) return;
      this.writeWord(this.p.word, false);
    } else if (id === 'heat') {
      this.heatT = 2;
    } else if (id === 'wipe') {
      for (let i = 0; i < this.ng; i++) this.s[i] = this.u() < 0.5 ? 1 : -1;
      this.ref = null;
      this.wrote = false;
      this.writeOk = false;
      this.writing = null;
    }
  }
  pointer(type, x, y) {
    if (type === 'down' || type === 'move') this.mag = [x, y];
    else if (type === 'up' || type === 'leave') this.mag = null;
  }
  medianDelta(Tk) {
    const K = this.Kof(Tk), kT = KB * Tk, arr = [];
    for (let i = 0; i < this.ng; i += 4) arr.push(K * this.vol(i) / kT);
    arr.sort(function (a, b) { return a - b; });
    return arr[arr.length >> 1];
  }
  draw(ctx, W, H) {
    const padX = 16, top = 46, rows = 4, perRow = 120, sw = (W - 2 * padX) / perRow;
    const rowH = (H - top - 10) / rows, gh = clamp(rowH * 0.34, 9, 40), fs = clamp(rowH * 0.3, 12, 30);
    drawLabel(ctx, 'Grains de ' + frNum(this.p.d, 1) + ' nm · ' + this.M().name + ' · ' + frNum(this.Tk() - 273.15, 0) + ' °C', padX, 28);
    if (!this.mag) drawLabel(ctx, 'glisse le doigt = aimant', W - padX, 28, { align: 'right', col: PAL.ink3 });
    for (let r = 0; r < rows; r++) {
      const y0 = top + r * rowH, yc = y0 + gh / 2 + 4;
      ctx.fillStyle = 'rgba(23,20,15,0.06)';
      ctx.fillRect(padX, y0, W - 2 * padX, gh + 8);
      for (let k = 0; k < perRow; k++) {
        const i = r * perRow + k, cx = padX + (k + 0.5) * sw;
        this.gx[i] = cx;
        this.gy[i] = yc;
        const w = Math.min(sw * 0.94, sw * 0.8 * this.df[i]), hh = gh * clamp(0.75 * this.df[i], 0.4, 1);
        ctx.fillStyle = this.s[i] > 0 ? PAL.red : PAL.blue;
        ctx.fillRect(cx - w / 2, yc - hh / 2, w, hh);
      }
      ctx.strokeStyle = 'rgba(23,20,15,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let b = 0; b <= 24; b++) {
        const x = padX + b * 5 * sw, big = b % 8 === 0;
        ctx.moveTo(x, y0 + (big ? -3 : 2));
        ctx.lineTo(x, y0 + gh + (big ? 12 : 6));
      }
      ctx.stroke();
      for (let c = 0; c < 3; c++) {
        const ci = r * 3 + c, cx = padX + (c * 40 + 20) * sw, ch = this.chars[ci];
        let ok = true;
        if (this.ref) for (let j = 0; j < 8; j++) if (this.bits[ci * 8 + j] !== this.ref[ci * 8 + j]) ok = false;
        const txt = (ch >= 32 && ch <= 126) ? String.fromCharCode(ch) : '·';
        ctx.font = fnt(fs, 800, FONTD);
        ctx.textAlign = 'center';
        ctx.fillStyle = ok ? PAL.ink : PAL.red;
        ctx.fillText(txt === ' ' ? '␣' : txt, cx, y0 + gh + 12 + fs);
        if (rowH > 92) {
          ctx.font = fnt(9.5, 400, MONO);
          ctx.fillStyle = PAL.ink3;
          ctx.fillText(this.bits.slice(ci * 8, ci * 8 + 8).join(''), cx, y0 + gh + 28 + fs);
        }
      }
    }
    if (this.writing) {
      const k = Math.min(95, Math.floor(this.writing.pos)), r = Math.floor(k / 24), x = padX + ((k % 24) * 5 + 2.5) * sw, y = top + r * rowH;
      if (this.p.laser) {
        ctx.fillStyle = 'rgba(242,188,36,0.45)';
        ctx.beginPath(); ctx.arc(x, y + gh / 2 + 4, 16, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = PAL.ink;
      roundRect(ctx, x - 12, y - 20, 24, 15, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = fnt(9, 800);
      ctx.textAlign = 'center';
      ctx.fillText('tête', x, y - 9);
    }
    if (this.mag) {
      ctx.strokeStyle = PAL.red;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(this.mag[0], this.mag[1], 46, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = PAL.red;
      ctx.beginPath(); ctx.arc(this.mag[0], this.mag[1], 15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = fnt(14, 800, FONTD);
      ctx.textAlign = 'center';
      ctx.fillText('N', this.mag[0], this.mag[1] + 5);
    }
  }
  hud() {
    const Tk = this.Tk(), HK = this.HKof(this.p.laser ? 0.97 * this.M().Tc : Tk), med = this.medianDelta(Tk), cw = this.canWrite();
    return [
      ['Mot lu', '« ' + this.text.replace(/\s+$/, '') + ' »', 'hot'],
      ['Bits corrects', this.ref ? this.correct + ' / 96' : '—', this.correct === 96 ? 'good' : (this.ref && this.correct < 70 ? 'bad' : '')],
      ['Temps écoulé', fmtSpan(this.simT)],
      ['Barrière médiane KV/k_BT', frNum(med, 0), med >= 60 ? 'good' : (med < 40 ? 'bad' : '')],
      ['Écriture (tête 2 T)', cw ? 'possible' + (this.p.laser ? ' (laser)' : '') : 'impossible : μ₀H_K = ' + frNum(HK, 1) + ' T', cw ? 'good' : 'bad'],
      ['Température', frNum(Tk - 273.15, 0) + ' °C']
    ];
  }
  drawPlots(p1, p2) {
    p1.begin('Bits corrects au fil du temps', 0, 12, 0, 1.05, 'log₁₀ du temps écoulé (s)', 'fraction');
    p1.vline(Math.log10(86400), PAL.ink3, true, '1 j');
    p1.vline(Math.log10(3.156e7), PAL.ink3, true, '1 an');
    p1.vline(Math.log10(3.156e10), PAL.ink3, true, '1000 ans');
    p1.hline(0.5, PAL.ink3, true, 'hasard');
    p1.clip();
    p1.line(this.rec.t, this.rec.c, PAL.red, 2.4);
    p1.unclip();
    const Tk = this.Tk(), K = this.Kof(Tk), kT = KB * Tk, ds = [];
    let dmax = 0;
    for (let i = 0; i < this.ng; i++) { const d = K * this.vol(i) / kT; ds.push(d); if (d > dmax) dmax = d; }
    const xmax = clamp(Math.ceil(dmax / 50) * 50, 200, 3000), bw = xmax / 40, bins = new Float64Array(40);
    for (let i = 0; i < ds.length; i++) bins[Math.min(39, Math.floor(ds[i] / bw))]++;
    let mx = 1;
    for (let b = 0; b < 40; b++) mx = Math.max(mx, bins[b]);
    p2.begin('Barrières d’énergie des grains', 0, xmax, 0, mx * 1.15, 'KV / k_BT', 'grains');
    const ctx = p2.ctx;
    for (let b = 0; b < 40; b++) {
      if (!bins[b]) continue;
      const x0 = b * bw, c = x0 < 37 ? PAL.red : (x0 < 60 ? PAL.gold : PAL.leaf);
      ctx.fillStyle = c;
      ctx.fillRect(p2.X(x0) + 1, p2.Y(bins[b]), Math.max(1, p2.X(x0 + bw) - p2.X(x0) - 2), p2.Y(0) - p2.Y(bins[b]));
    }
    p2.vline(37.4, PAL.red, true, '1 an');
    p2.vline(60, PAL.leaf, true, 'règle : 60');
  }
}

// ===== modes/engine_base.js =====
class EngineSim extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.eng = null;
    this.fv = null;
    this.timeScale = 1e-9;
    this.budget = 11;
    this.relaxMode = false;
    this.relaxSteps = 0;
    this.torque = 0;
    this.flashes = [];
    this.heat = null;
    this.Tc = 0;
    this.stepRate = 0;
  }

  build(g, terms, dyn, T) {
    const e = new Engine(g);
    e.Tc = this.Tc || 0;
    e.setup(terms, dyn, T);
    this.eng = e;
    this.fv = new FilmView(g.nx, g.ny);
    this.heat = null;
    return e;
  }

  preStep() {}
  beforeFrame() {}
  afterFrame() {}

  update(dtReal, speed) {
    const e = this.eng;
    if (!e) return;
    this.beforeFrame(dtReal);
    const t0 = performance.now();
    let k = 0;
    if (this.relaxMode) {
      while (k < 2000 && performance.now() - t0 < this.budget) { this.preStep(0); e.relax(2); k += 2; }
      this.relaxSteps += k;
    } else {
      const target = this.timeScale * speed * dtReal;
      let done = 0;
      while (done < target && performance.now() - t0 < this.budget) {
        this.preStep(e.dt);
        e.step(e.dt);
        done += e.dt;
        k++;
      }
    }
    this.stepRate = k / Math.max(dtReal, 1e-3);
    this.t = e.t;
    this.torque = e.maxTorque();
    this.afterFrame(dtReal);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].a -= dtReal * 1.8;
      if (this.flashes[i].a <= 0) this.flashes.splice(i, 1);
    }
  }

  converged() { return this.torque < 2e-4; }

  fire(x, y, w, dT, tau) {
    const e = this.eng;
    if (!e) return;
    e.laser(x, y, w, dT, tau);
    this.flashes.push({ x: x, y: y, w: w, a: 1 });
    this.host.sfx('laser');
  }

  cellAt(px, py) {
    const L = this.fv.lay, e = this.eng;
    const i = (px - L.x0) / L.s, j = e.ny - (py - L.y0) / L.s;
    if (i < 0 || j < 0 || i >= e.nx || j >= e.ny) return null;
    return [i, j];
  }

  drawHeat(ctx) {
    const e = this.eng;
    if (!e || !e.hot) return;
    const nx = e.nx, ny = e.ny;
    if (!this.heat) {
      const c = document.createElement('canvas');
      c.width = nx; c.height = ny;
      this.heat = { c: c, x: c.getContext('2d') };
      this.heat.img = this.heat.x.createImageData(nx, ny);
    }
    const d = this.heat.img.data, Tl = e.Tl, T0 = e.T, Tc = e.Tc > T0 ? e.Tc : T0 + 500;
    for (let j = 0; j < ny; j++) {
      const row = ny - 1 - j;
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i, o = (row * nx + i) * 4, r = (Tl[id] - T0) / (Tc - T0);
        if (r < 0.03 || (e.mask && !e.mask[id])) { d[o + 3] = 0; continue; }
        const hot = r >= 1;
        d[o] = 255; d[o + 1] = hot ? 236 : Math.round(150 + 60 * r); d[o + 2] = hot ? 170 : 40;
        d[o + 3] = Math.round(255 * clamp(hot ? 0.62 : 0.5 * r, 0, 0.7));
      }
    }
    this.heat.x.putImageData(this.heat.img, 0, 0);
    const L = this.fv.lay;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.heat.c, L.x0, L.y0, nx * L.s, ny * L.s);
    ctx.restore();
  }

  drawFlashes(ctx) {
    const e = this.eng, L = this.fv.lay;
    for (let k = 0; k < this.flashes.length; k++) {
      const f = this.flashes[k], a = f.a;
      const x = L.x0 + f.x / e.c * L.s, y = L.y0 + (e.ny - f.y / e.c) * L.s, r = Math.max(14, 2.2 * f.w / e.c * L.s) * (1.6 - 0.6 * a);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,240,' + (0.95 * a).toFixed(3) + ')');
      g.addColorStop(0.35, 'rgba(255,214,90,' + (0.7 * a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(215,48,31,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(23,20,15,' + (0.5 * a).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, f.w / e.c * L.s, 0, TAU); ctx.stroke();
    }
  }

  baseLimits(extra) {
    const e = this.eng;
    if (!e) return [];
    const g = Object.assign({ c: e.c, dz: e.dz, Ms: e.Ms, nx: e.nx, ny: e.ny, px: e.px, py: e.py, T: e.T, Tc: e.Tc, dt: this.relaxMode ? 0 : e.dt }, extra);
    return physLimits(g);
  }
}

function grains(nx, ny, c, size, sigma, seed, px, py) {
  const rnd = uni(xorshift(seed)), n = nx * ny, out = new Float64Array(n);
  const gx = Math.max(1, Math.round(nx * c / size)), gy = Math.max(1, Math.round(ny * c / size));
  const cx = [], cy = [], val = [];
  for (let k = 0; k < gx * gy; k++) {
    const a = k % gx, b = (k - a) / gx;
    cx.push((a + rnd()) * nx / gx); cy.push((b + rnd()) * ny / gy);
    val.push(Math.max(0.05, 1 + sigma * gauss(rnd)));
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < cx.length; k++) {
        let dx = i + 0.5 - cx[k], dy = j + 0.5 - cy[k];
        if (px) dx -= nx * Math.round(dx / nx);
        if (py) dy -= ny * Math.round(dy / ny);
        const d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = k; }
      }
      out[j * nx + i] = val[best];
    }
  }
  return out;
}

function minorityStats(e, sign) {
  const nx = e.nx, ny = e.ny, n = e.n, mz = e.mz, mask = e.mask, px = e.px, py = e.py;
  const lab = new Int32Array(n).fill(-1), qx = new Int32Array(n), qy = new Int32Array(n), qi = new Int32Array(n);
  const comps = [];
  let area = 0, wall = 0;
  const minor = function (id) { return (!mask || mask[id]) && sign * mz[id] < 0; };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const id = j * nx + i;
      if (mask && !mask[id]) continue;
      const a = minor(id);
      if (a) area++;
      if (i + 1 < nx || px) { const r = j * nx + ((i + 1) % nx); if ((!mask || mask[r]) && minor(r) !== a) wall++; }
      if (j + 1 < ny || py) { const u = ((j + 1) % ny) * nx + i; if ((!mask || mask[u]) && minor(u) !== a) wall++; }
    }
  }
  for (let s = 0; s < n; s++) {
    if (lab[s] >= 0 || !minor(s)) continue;
    const k = comps.length;
    let h = 0, tl = 0, cnt = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    lab[s] = k; qi[tl] = s; qx[tl] = s % nx; qy[tl] = (s - (s % nx)) / nx; tl++;
    while (h < tl) {
      const id = qi[h], ux = qx[h], uy = qy[h];
      h++;
      cnt++; sx += ux; sy += uy; sxx += ux * ux; syy += uy * uy; sxy += ux * uy;
      if (ux < x0) x0 = ux; if (ux > x1) x1 = ux; if (uy < y0) y0 = uy; if (uy > y1) y1 = uy;
      const i = id % nx, j = (id - i) / nx;
      const nb = [[i - 1, j, -1, 0], [i + 1, j, 1, 0], [i, j - 1, 0, -1], [i, j + 1, 0, 1]];
      for (let q = 0; q < 4; q++) {
        let a = nb[q][0], b = nb[q][1];
        if (a < 0) { if (!px) continue; a += nx; } else if (a >= nx) { if (!px) continue; a -= nx; }
        if (b < 0) { if (!py) continue; b += ny; } else if (b >= ny) { if (!py) continue; b -= ny; }
        const m = b * nx + a;
        if (lab[m] >= 0 || !minor(m)) continue;
        lab[m] = k; qi[tl] = m; qx[tl] = ux + nb[q][2]; qy[tl] = uy + nb[q][3]; tl++;
      }
    }
    const mx = sx / cnt, my = sy / cnt, vxx = sxx / cnt - mx * mx, vyy = syy / cnt - my * my, vxy = sxy / cnt - mx * my;
    const tr = vxx + vyy, det = vxx * vyy - vxy * vxy, dd = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + dd, l2 = Math.max(tr / 2 - dd, 1e-6);
    const span = (x1 - x0 + 1) >= nx || (y1 - y0 + 1) >= ny;
    const bubble = !span && cnt >= 3 && Math.sqrt(l1 / l2) < 1.9;
    comps.push({ n: cnt, bubble: bubble, cx: ((mx % nx) + nx) % nx, cy: ((my % ny) + ny) % ny });
  }
  let nb = 0, ns = 0, dsum = 0;
  for (let k = 0; k < comps.length; k++) {
    if (comps[k].bubble) { nb++; dsum += 2 * Math.sqrt(comps[k].n / Math.PI); } else if (comps[k].n >= 3) ns++;
  }
  return {
    area: area, wall: wall, comps: comps, nBub: nb, nStr: ns,
    w: wall > 0 ? 2 * area / wall * e.c : 0,
    dBub: nb ? dsum / nb * e.c : 0
  };
}

// ===== modes/pinning.js =====
const PIN_MAT = { Ms: 5.8e5, A: 1.5e-11, Ku: 4.5e5, dz: 1e-9, c: 4e-9, nx: 128, ny: 24 };
const PIN_X = [160e-9, 288e-9, 416e-9];

class PinningSim extends EngineSim {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 2e-9;
    this.seed = 7;
    this.rebuild();
  }

  keff() { return PIN_MAT.Ku - 0.5 * MU0 * PIN_MAT.Ms * PIN_MAT.Ms; }

  makeMask() {
    const g = PIN_MAT, W = g.ny * g.c, d = this.p.notch * 1e-9, m = new Uint8Array(g.nx * g.ny);
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const x = (i + 0.5) * g.c, y = (j + 0.5) * g.c;
        let keep = 1;
        for (let k = 0; k < PIN_X.length && d > 0; k++) {
          const depth = d - Math.abs(x - PIN_X[k]);
          if (depth > 0 && (y < depth || y > W - depth)) keep = 0;
        }
        m[j * g.nx + i] = keep;
      }
    }
    return m;
  }

  rebuild() {
    const g = PIN_MAT, p = this.p;
    this.zee = { kind: 'zeeman', H: [0, 0, p.Bz * 1e-3 / MU0], func: 'none' };
    const terms = [
      { kind: 'exchange', A: g.A },
      { kind: 'dmi', D: p.D * 1e-3, cls: 'Cnv_z' },
      { kind: 'uniaxial', K: this.keff(), u: [0, 0, 1] },
      this.zee
    ];
    const e = this.build({ nx: g.nx, ny: g.ny, c: g.c, dz: g.dz, Ms: g.Ms, mask: this.makeMask() }, terms, this.dyn(), p.T);
    if (p.dis > 0) e.setKmul(grains(g.nx, g.ny, g.c, 15e-9, p.dis / 100, this.seed, false, false));
    this.fv.noFrame = true;
    this.resetWall();
  }

  dyn() {
    const p = this.p;
    return { prec: true, gamma0: GAMMA0, alpha: p.alpha, edge: 0, zl: p.u ? { ux: p.u, uy: 0, beta: p.alpha } : null, sl: null };
  }

  resetWall() {
    const e = this.eng, g = PIN_MAT, x0 = 64e-9, dl = Math.sqrt(g.A / this.keff()), s = this.p.D >= 0 ? -1 : 1;
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const id = j * g.nx + i, x = (i + 0.5) * g.c, th = 2 * Math.atan(Math.exp((x - x0) / dl));
        e.mx[id] = s * Math.sin(th); e.my[id] = 0; e.mz[id] = Math.cos(th);
      }
    }
    e.t = 0;
    e.pulses = [];
    e.coolDown();
    this.t = 0;
    this.hist = newHist(1);
    this.path = { B: [], x: [] };
    this.dep = PIN_X.map(function () { return null; });
    this.dwell = PIN_X.map(function () { return 0; });
    this.xw = x0; this.v = 0; this.state = '';
    this.exited = false;
    this._lt = 0;
    this.depCurrent = false;
    this.pinnedAt = -1;
    this.measure();
  }

  onParam(id, v) {
    const p = this.p, e = this.eng;
    if (id === 'Bz') { this.zee.H[2] = v * 1e-3 / MU0; if (p.auto && !this._auto) { p.auto = false; this.host.setParamUI('auto', false); } return; }
    if (id === 'notch' || id === 'dis') { this.rebuild(); return; }
    if (id === 'D') { e.terms[1].D = v * 1e-3; e.prepare(); return; }
    if (id === 'alpha' || id === 'u') { e.dyn = this.dyn(); e.prepare(); return; }
    if (id === 'T') { e.T = v; return; }
  }

  action(id) {
    if (id === 'reset') this.resetWall();
    else if (id === 'zero') this.setB(0);
    else if (id === 'up' || id === 'down') this.setB(Math.round(this.p.Bz) + (id === 'up' ? 2 : -2));
    else if (id === 'newdis') { this.seed += 11; this.rebuild(); }
  }

  setB(v) {
    v = clamp(v, -150, 150);
    this.p.Bz = v;
    this.zee.H[2] = v * 1e-3 / MU0;
    this.host.setParamUI('Bz', v);
  }

  preStep(dt) {
    const p = this.p;
    if (p.auto && !this.exited) {
      this._auto = true;
      const v = Math.min(150, p.Bz + p.rate * dt * 1e9);
      p.Bz = v;
      this.zee.H[2] = v * 1e-3 / MU0;
      this._auto = false;
    }
  }

  wallX() {
    const e = this.eng, nx = e.nx, ny = e.ny, mz = e.mz, mask = e.mask, c = e.c;
    let s = 0, n = 0;
    for (let j = 0; j < ny; j++) {
      let prev = -1;
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i;
        if (mask && !mask[id]) continue;
        if (prev >= 0 && mz[prev] >= 0 && mz[id] < 0) {
          const a = mz[prev], b = mz[id], pi = prev % nx;
          const f = a / (a - b);
          s += (pi + 0.5 + f * (i - pi)) * c;
          n++;
          break;
        }
        prev = id;
      }
    }
    if (n) return s / n;
    return e.mean()[2] > 0 ? nx * c : 0;
  }

  measure() {
    const e = this.eng, x = this.wallX(), t = e.t;
    pushHist(this.hist, t, [x * 1e9], 900);
    const h = this.hist, n = h.t.length;
    let k = n - 1;
    while (k > 0 && h.t[n - 1] - h.t[k] < 0.2e-9) k--;
    const dts = h.t[n - 1] - h.t[k];
    this.v = dts > 0.05e-9 ? (h.v[0][n - 1] - h.v[0][k]) * 1e-9 / dts : 0;
    this.xw = x;
    const L = e.nx * e.c;
    this.exited = x >= L - 2e-9;
    this.pinnedAt = -1;
    for (let q = 0; q < PIN_X.length; q++) {
      const near = Math.abs(x - PIN_X[q]) < 28e-9;
      if (near && Math.abs(this.v) < 5) this.pinnedAt = q;
      if (this.dep[q] === null && x > PIN_X[q] + 30e-9) {
        this.dep[q] = this.dwell[q] > 0.25e-9 ? this.p.Bz : 'libre';
        if (this.dwell[q] > 0.25e-9 && Math.abs(this.p.Bz) < 1 && this.p.u > 0) this.depCurrent = true;
        if (this.dwell[q] > 0.25e-9) this.host.sfx('flip');
      }
    }
    if (this.exited) this.state = 'sortie à droite';
    else if (x <= 1e-9) this.state = 'sortie à gauche';
    else if (this.pinnedAt >= 0) this.state = 'accrochée à l’entaille ' + (this.pinnedAt + 1);
    else if (Math.abs(this.v) < 3) this.state = this.p.dis > 0 ? 'bloquée par le désordre' : 'immobile';
    else this.state = 'en mouvement';
    const pa = this.path;
    if (!pa.B.length || Math.abs(pa.B[pa.B.length - 1] - this.p.Bz) > 0.05 || Math.abs(pa.x[pa.x.length - 1] - x * 1e9) > 1) {
      pa.B.push(this.p.Bz); pa.x.push(x * 1e9);
      if (pa.B.length > 3000) { pa.B.shift(); pa.x.shift(); }
    }
  }

  afterFrame() {
    this.measure();
    if (this.pinnedAt >= 0) this.dwell[this.pinnedAt] += Math.max(0, this.eng.t - this._lt);
    this._lt = this.eng.t;
    if (this.p.auto) this.host.setParamUI('Bz', this.p.Bz);
    const dc = this.dep.filter(function (v) { return typeof v === 'number'; }).length;
    this.obs = { pinnedAt: this.pinnedAt, B: this.p.Bz, depCount: dc, exited: this.exited, depCurrent: this.depCurrent, v: this.v };
  }

  hud() {
    const dp = this.dep.map(function (v) { return v === null ? '—' : (v === 'libre' ? 'passée' : frNum(v, 0)); }).join(' · ');
    return [
      ['Champ B_z', frNum(this.p.Bz, 1) + ' mT', 'hot'],
      ['Position de la paroi', frNum(this.xw * 1e9, 0) + ' nm'],
      ['Vitesse', frNum(this.v, 0) + ' m/s'],
      ['État', this.state, this.pinnedAt >= 0 ? 'good' : ''],
      ['Décrochage (mT) 1 · 2 · 3', dp],
      ['Temps simulé', fmtTime(this.t)]
    ];
  }

  limits() {
    return this.baseLimits({ A: PIN_MAT.A, K: PIN_MAT.Ku, Ktype: 'uni', Kaxis: 'z', D: this.p.D * 1e-3, demag: true });
  }

  drawGrains(ctx, L) {
    const e = this.eng, km = e.kmul;
    if (!km || !(this.p.dis > 0)) { this.grainImg = null; return; }
    if (!this.grainImg || this.grainImg.km !== km) {
      const nx = e.nx, ny = e.ny, c = document.createElement('canvas');
      c.width = nx; c.height = ny;
      const x = c.getContext('2d'), img = x.createImageData(nx, ny), d = img.data;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const id = j * nx + i, o = ((ny - 1 - j) * nx + i) * 4;
          if (e.mask && !e.mask[id]) continue;
          const edge = (i + 1 < nx && km[id + 1] !== km[id]) || (j + 1 < ny && km[id + nx] !== km[id]);
          if (edge) { d[o] = 23; d[o + 1] = 20; d[o + 2] = 15; d[o + 3] = 120; }
          else if (km[id] < 0.92) { d[o] = 255; d[o + 1] = 214; d[o + 2] = 90; d[o + 3] = Math.round(clamp((1 - km[id]) * 260, 0, 150)); }
        }
      }
      x.putImageData(img, 0, 0);
      this.grainImg = { km: km, c: c };
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.grainImg.c, L.x0, L.y0, e.nx * L.s, e.ny * L.s);
    ctx.restore();
    drawLabel(ctx, 'traits fins : les grains · jaune : grains plus « mous » (K plus faible)', L.x0, L.y0 + e.ny * L.s + 44, {});
  }

  draw(ctx, W, H) {
    const e = this.eng;
    this.fv.paint(e, this.p.disp === 'wheel' ? 'wheel' : 'mz');
    const L = this.fv.draw(ctx, W, H, 26), s = L.s, Hh = e.ny * s;
    ctx.strokeStyle = 'rgba(23,20,15,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(L.x0 - 0.5, L.y0 - 0.5, e.nx * s + 1, Hh + 1);
    ctx.font = fnt(12, 700);
    ctx.textAlign = 'center';
    for (let k = 0; k < PIN_X.length; k++) {
      const x = L.x0 + PIN_X[k] / e.c * s;
      ctx.fillStyle = this.dep[k] !== null ? PAL.ink3 : PAL.ink;
      ctx.fillText(String(k + 1), x, L.y0 - 8);
    }
    this.drawGrains(ctx, L);
    this.drawHeat(ctx);
    const xw = L.x0 + this.xw / e.c * s;
    ctx.strokeStyle = PAL.gold;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xw, L.y0 - 2); ctx.lineTo(xw, L.y0 + Hh + 2); ctx.stroke();
    ctx.setLineDash([]);
    const b = this.p.Bz;
    drawLabel(ctx, 'B = ' + frNum(b, 1) + ' mT ' + (b > 0.5 ? '⊙ (vers toi)' : (b < -0.5 ? '⊗ (s’éloigne)' : '')), L.x0, L.y0 + Hh + 24, {});
    if (this.p.u) drawLabel(ctx, 'électrons u = ' + frNum(this.p.u, 0) + ' m/s →', L.x0 + e.nx * s, L.y0 + Hh + 24, { align: 'right', col: PAL.teal });
    drawScaleBar(ctx, L.x0 + e.nx * s - 110, L.y0 - 10, 100e-9 / e.c * s, '100 nm');
  }

  drawPlots(p1, p2) {
    const e = this.eng, Lnm = e.nx * e.c * 1e9;
    drawSeries(p1, this.hist, [{ i: 0, col: PAL.gold, label: 'x paroi' }], 'Position de la paroi (nm)', 0, Lnm, 'x (nm)');
    for (let k = 0; k < PIN_X.length; k++) p1.hline(PIN_X[k] * 1e9, 'rgba(23,20,15,0.35)', true);
    const pa = this.path;
    let b0 = -10, b1 = 40;
    for (let i = 0; i < pa.B.length; i++) { b0 = Math.min(b0, pa.B[i]); b1 = Math.max(b1, pa.B[i]); }
    p2.begin('Position en fonction du champ', b0 - 2, b1 + 2, 0, Lnm, 'B (mT)', 'x (nm)');
    for (let k = 0; k < PIN_X.length; k++) p2.hline(PIN_X[k] * 1e9, 'rgba(23,20,15,0.35)', true, 'entaille ' + (k + 1));
    p2.clip();
    p2.line(pa.B, pa.x, PAL.blue, 2);
    for (let k = 0; k < PIN_X.length; k++) if (typeof this.dep[k] === 'number') p2.vline(this.dep[k], 'rgba(215,48,31,0.6)', true);
    if (pa.B.length) p2.dot(pa.B[pa.B.length - 1], pa.x[pa.x.length - 1], PAL.ink, 4);
    p2.unclip();
  }
}

// ===== modes/labyrinth.js =====
const LAB_MAT = { Ms: 1e6, A: 1e-11, dz: 1e-9, c: 4e-9, Tc: 600, alpha: 0.3 };

class LabySim extends EngineSim {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 1e-9;
    this.Tc = LAB_MAT.Tc;
    this.seed = 3;
    this.rebuild();
  }

  rebuild() {
    const g = LAB_MAT, p = this.p, n = parseInt(p.res, 10) || 64;
    this.zee = { kind: 'zeeman', H: [0, 0, p.Bz * 1e-3 / MU0], func: 'none' };
    const terms = [
      { kind: 'exchange', A: g.A },
      { kind: 'dmi', D: p.D * 1e-3, cls: 'Cnv_z' },
      { kind: 'uniaxial', K: p.K * 1e3, u: [0, 0, 1] },
      { kind: 'demag' },
      this.zee
    ];
    this.build({ nx: n, ny: n, c: g.c, dz: g.dz, Ms: g.Ms, px: true, py: true }, terms, this.dyn(), p.drv === 'llg' ? p.T : 0);
    this.relaxMode = p.drv !== 'llg';
    this.fv.noFrame = false;
    this.pathReset();
    this.demag();
  }

  dyn() { return { prec: true, gamma0: GAMMA0, alpha: LAB_MAT.alpha, edge: 0, zl: null, sl: null }; }

  pathReset() {
    this.path = { B: [], mz: [], w: [], d: [], ph: [] };
    this.pending = true;
    this.since = 0;
    this.stat = null;
    this.phase = '';
    this.maxBub = 0;
    this.sawMaze = false;
  }

  demag() {
    const e = this.eng, r = uni(xorshift(this.seed++));
    for (let i = 0; i < e.n; i++) {
      const z = 2 * r() - 1, ph = TAU * r(), s = Math.sqrt(1 - z * z);
      e.mx[i] = s * Math.cos(ph); e.my[i] = s * Math.sin(ph); e.mz[i] = z;
    }
    e.t = 0;
    this.pending = true;
    this.since = 0;
  }

  saturate() {
    const e = this.eng;
    for (let i = 0; i < e.n; i++) { e.mx[i] = 0; e.my[i] = 0; e.mz[i] = 1; }
    this.pending = true;
    this.since = 0;
  }

  setB(v) {
    v = clamp(Math.round(v * 10) / 10, -400, 400);
    this.p.Bz = v;
    this.zee.H[2] = v * 1e-3 / MU0;
    this.host.setParamUI('Bz', v);
    this.pending = true;
    this.since = 0;
  }

  onParam(id, v) {
    const e = this.eng, p = this.p;
    if (id === 'Bz') { this.zee.H[2] = v * 1e-3 / MU0; this.pending = true; this.since = 0; return; }
    if (id === 'res') { this.rebuild(); return; }
    if (id === 'D') { e.terms[1].D = v * 1e-3; e.prepare(); this.pending = true; this.since = 0; return; }
    if (id === 'K') { e.terms[2].K = v * 1e3; e.prepare(); this.pending = true; this.since = 0; return; }
    if (id === 'drv') { this.relaxMode = v !== 'llg'; e.T = v === 'llg' ? p.T : 0; return; }
    if (id === 'T') { if (p.drv === 'llg') e.T = v; return; }
  }

  action(id) {
    const p = this.p;
    if (id === 'demag') this.demag();
    else if (id === 'sat') this.saturate();
    else if (id === 'up') this.setB(p.Bz + p.step);
    else if (id === 'down') this.setB(p.Bz - p.step);
    else if (id === 'zero') this.setB(0);
    else if (id === 'clear') this.pathReset();
    else if (id === 'flash') this.flashAt(this.eng.nx * this.eng.c / 2, this.eng.ny * this.eng.c / 2);
  }

  flashAt(x, y) {
    if (this.p.drv !== 'llg') {
      this.p.drv = 'llg';
      this.host.setParamUI('drv', 'llg');
      this.onParam('drv', 'llg');
      this.host.toast('Impulsion laser : passage en dynamique LLG (le temps doit avancer pour que ça refroidisse).');
    }
    this.fire(x, y, 40e-9, 900, 0.25e-9);
    this.pending = true;
  }

  pointer(kind, px, py) {
    if (kind !== 'down' || !this.fv) return;
    const q = this.cellAt(px, py);
    if (q) this.flashAt(q[0] * this.eng.c, q[1] * this.eng.c);
  }

  beforeFrame() {
    const p = this.p;
    if (!p.auto) return;
    const ready = this.relaxMode ? (this.torque < 1e-3 || this.since > 5000) : this.since > 180;
    if (ready && !this.pending && p.Bz + p.step <= p.Bmax + 1e-9) this.setB(p.Bz + p.step);
    else if (ready && !this.pending && p.Bz + p.step > p.Bmax) { p.auto = false; this.host.setParamUI('auto', false); this.host.toast('Balayage terminé.'); }
  }

  afterFrame() {
    const e = this.eng;
    this.since += this.relaxMode ? this.relaxSteps - (this._rs || 0) : 1;
    this._rs = this.relaxSteps;
    const m = e.mean(), sign = m[2] >= 0 ? 1 : -1, st = minorityStats(e, sign);
    this.mz = m[2];
    this.Q = e.topoCharge();
    this.stat = st;
    if (st.area === 0) this.phase = 'saturé';
    else if (st.nStr === 0 && st.nBub > 0) this.phase = 'bulles';
    else if (st.nBub === 0) this.phase = 'labyrinthe';
    else this.phase = 'bandes + bulles';
    if (this.phase === 'labyrinthe' && st.area > 0.15 * e.n) this.sawMaze = true;
    const ok = this.relaxMode ? (this.torque < 1e-3 || this.since > 5000) : this.since > 90;
    if (this.pending && ok) {
      const pa = this.path;
      pa.B.push(this.p.Bz); pa.mz.push(this.mz); pa.w.push(st.w * 1e9); pa.d.push(st.dBub * 1e9); pa.ph.push(this.phase);
      if (pa.B.length > 400) { for (const k in pa) pa[k].shift(); }
      this.pending = false;
      if (st.nBub > this.maxBub) this.maxBub = st.nBub;
    }
    if (this.p.auto) this.host.setParamUI('Bz', this.p.Bz);
    this.obs = { phase: this.phase, nBub: st.nBub, sawMaze: this.sawMaze, maxBub: this.maxBub, B: this.p.Bz, Q: this.Q, mz: this.mz, conv: !this.pending };
  }

  hud() {
    const st = this.stat || { w: 0, nBub: 0, nStr: 0, dBub: 0 };
    return [
      ['Champ B_z', frNum(this.p.Bz, 1) + ' mT', 'hot'],
      ['Structure', this.phase, this.phase === 'bulles' ? 'good' : ''],
      ['⟨m_z⟩', frNum(this.mz || 0, 2)],
      ['Largeur des bandes', st.w ? frNum(st.w * 1e9, 0) + ' nm' : '—'],
      ['Bulles', st.nBub + (st.nBub ? ' (Ø ' + frNum(st.dBub * 1e9, 0) + ' nm)' : '')],
      ['Charge topologique Q', frNum(this.Q || 0, 1)],
      [this.relaxMode ? 'Convergence |m×B|' : 'Temps simulé', this.relaxMode ? (this.pending ? frNum(this.torque * 1e3, 2) + ' mT…' : 'équilibre ✓') : fmtTime(this.t), this.relaxMode && !this.pending ? 'good' : '']
    ];
  }

  limits() {
    return this.baseLimits({ A: LAB_MAT.A, K: this.p.K * 1e3, Ktype: 'uni', Kaxis: 'z', D: this.p.D * 1e-3, demag: true });
  }

  draw(ctx, W, H) {
    const e = this.eng;
    this.fv.paint(e, this.p.disp === 'wheel' ? 'wheel' : 'mz');
    const L = this.fv.draw(ctx, W, H, 18);
    this.drawHeat(ctx);
    const st = this.stat;
    if (st && this.p.marks) {
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 2;
      for (let k = 0; k < st.comps.length; k++) {
        const c = st.comps[k];
        if (!c.bubble) continue;
        const r = Math.max(5, Math.sqrt(c.n / Math.PI) * L.s + 4), q = this.fv.px(c.cx + 0.5, c.cy + 0.5);
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, TAU); ctx.stroke();
      }
    }
    this.drawFlashes(ctx);
    drawScaleBar(ctx, L.x0 + 12, L.y0 + e.ny * L.s - 12, 100e-9 / e.c * L.s, '100 nm');
    drawLabel(ctx, 'B = ' + frNum(this.p.Bz, 0) + ' mT ⊙', L.x0 + 8, L.y0 + 22, {});
  }

  drawPlots(p1, p2) {
    const pa = this.path, cols = { 'labyrinthe': PAL.blue, 'bandes + bulles': PAL.plum, 'bulles': PAL.red, 'saturé': PAL.ink3 };
    let b0 = 0, b1 = 100;
    for (let i = 0; i < pa.B.length; i++) { b0 = Math.min(b0, pa.B[i]); b1 = Math.max(b1, pa.B[i]); }
    p1.begin('Aimantation à l’équilibre ⟨m_z⟩(B)', b0 - 5, b1 + 5, -1.05, 1.05, 'B (mT)', '⟨m_z⟩');
    p1.clip();
    p1.line(pa.B, pa.mz, 'rgba(23,20,15,0.35)', 1.2);
    for (let i = 0; i < pa.B.length; i++) p1.dot(pa.B[i], pa.mz[i], cols[pa.ph[i]] || PAL.ink, 4);
    p1.dot(this.p.Bz, this.mz || 0, PAL.gold, 3);
    p1.unclip();
    p1.legend([{ col: PAL.blue, label: 'labyrinthe' }, { col: PAL.plum, label: 'mélange' }, { col: PAL.red, label: 'bulles' }]);
    let hi = 40;
    for (let i = 0; i < pa.B.length; i++) hi = Math.max(hi, pa.w[i], pa.d[i]);
    p2.begin('Taille des domaines minoritaires', b0 - 5, b1 + 5, 0, hi * 1.15, 'B (mT)', 'nm');
    p2.clip();
    const bw = [], ww = [], bd = [], dd = [];
    for (let i = 0; i < pa.B.length; i++) {
      if (pa.w[i] > 0) { bw.push(pa.B[i]); ww.push(pa.w[i]); }
      if (pa.d[i] > 0) { bd.push(pa.B[i]); dd.push(pa.d[i]); }
    }
    p2.line(bw, ww, PAL.blue, 2);
    p2.dots(bd, dd, PAL.red, 4);
    p2.unclip();
    p2.legend([{ col: PAL.blue, label: 'largeur moyenne (2·aire/paroi)' }, { col: PAL.red, label: 'diamètre des bulles' }]);
  }
}

// ===== catalogue/models.js =====
function flickOnce(sim, s) {
  if (sim._fl === undefined) { sim._fl = s.flickN; return false; }
  if (s.flickN !== sim._fl) { sim._fl = s.flickN; return true; }
  return false;
}

function phoneSet(sim, id, v, tol) {
  if (Math.abs(v - sim.p[id]) <= (tol || 0)) return false;
  sim.setParam(id, v);
  sim.host.setParamUI(id, v);
  return true;
}

const MODELS = [
  {
    id: 'limaille', name: 'La limaille de fer',
    params: [
      { id: 'scene', type: 'select', label: 'Scène', value: 'bar', options: [['bar', 'Un aimant droit'], ['attract', 'Deux aimants qui s’attirent'], ['repel', 'Deux aimants qui se repoussent'], ['horseshoe', 'Aimant en U'], ['halbach', 'Aimant de frigo (Halbach)'], ['earth', 'La Terre']], help: 'Chaque scène place de nouveaux aimants.' },
      { id: 'disp', type: 'select', label: 'Affichage', value: 'filings', options: [['filings', 'Limaille'], ['compass', 'Boussoles'], ['lines', 'Lignes de champ'], ['all', 'Limaille + lignes']], help: 'Les boussoles montrent le sens du champ, la limaille seulement sa direction.' }
    ],
    buttons: [{ id: 'tap', label: 'Tapoter la plaque' }, { id: 'flip', label: 'Retourner l’aimant' }, { id: 'add', label: 'Ajouter un aimant' }, { id: 'reset', label: 'Remettre en place' }],
    whatIf: [
      { label: 'Et deux aimants qui s’attirent ?', set: { scene: 'attract' } },
      { label: 'Et un aimant de frigo ?', set: { scene: 'halbach' } },
      { label: 'Et la Terre entière ?', set: { scene: 'earth' } },
      { label: 'Et un aimant en U ?', set: { scene: 'horseshoe' } }
    ],
    challenges: [
      { id: 'lim1', text: 'Trouve le point neutre entre deux aimants (|B| ≈ 0)', test: function (o) { return o.neutral; } },
      { id: 'lim2', text: 'Mets deux pôles Nord face à face', test: function (o) { return o.repel; } },
      { id: 'lim3', text: 'Mesure un champ 1 000 fois plus fort que celui de la Terre', test: function (o) { return o.strong; } }
    ],
    phone: { uses: ['compass'], hint: 'Active les capteurs : la vraie boussole de ton téléphone s’affiche dans le coin de la plaque.', apply: function () {} },
    create: function (h, d) { return new FilingsSim(h, d); }
  },
  {
    id: 'magneto', name: 'Le magnétomètre de ta poche',
    params: [
      { id: 'src', type: 'select', label: 'Source', value: 'auto', options: [['auto', 'Capteur du téléphone (si dispo)'], ['virt', 'Simulation virtuelle']], help: 'Sans capteur, la simulation imite la Terre et un aimant.' },
      { id: 'head', label: 'Cap du téléphone virtuel', unit: '°', min: 0, max: 359, step: 1, value: 0, digits: 0, help: '0° : le haut du téléphone pointe vers le nord.' },
      { id: 'magOn', type: 'check', label: 'Aimant virtuel à côté', value: false, help: 'Un aimant posé à droite du téléphone.' },
      { id: 'dist', label: 'Distance de l’aimant virtuel', unit: 'cm', min: 1, max: 30, step: 0.5, value: 5, digits: 1, help: 'Le champ décroît en 1/r³.' }
    ],
    buttons: [{ id: 'sensors', label: 'Activer les capteurs' }, { id: 'zero', label: 'Effacer les courbes' }],
    whatIf: [
      { label: 'Et un aimant à 3 cm ?', set: { src: 'virt', magOn: true, dist: 3 } },
      { label: 'Et à 6 cm ?', set: { src: 'virt', magOn: true, dist: 6 } },
      { label: 'Et tourné vers l’est ?', set: { src: 'virt', head: 90 } }
    ],
    challenges: [
      { id: 'mag1', text: 'Mesure le champ terrestre avec un vrai capteur (25 à 70 µT)', test: function (o) { return o.earthOK; } },
      { id: 'mag2', text: 'Détecte un aimant : plus de 500 µT', test: function (o) { return o.B > 500; } },
      { id: 'mag3', text: 'Pointe le haut du téléphone vers le nord (±10°)', test: function (o) { return o.compass && o.heading !== null && (o.heading < 10 || o.heading > 350); } }
    ],
    phone: { uses: ['compass', 'magnet'], native: true, hint: 'Ici, tout vient des capteurs de ton téléphone. Active-les, puis approche un aimant.', apply: function () {} },
    create: function (h, d) { return new MagnetoSim(h, d); }
  },
  {
    id: 'compass', name: 'Boussole et précession',
    params: [
      { id: 'B', label: 'Champ magnétique B', unit: 'mT', min: 0, max: 400, step: 1, value: 100, digits: 0, help: 'Plus B est fort, plus m tourne vite autour de lui.' },
      { id: 'thB', label: 'Inclinaison du champ', unit: '°', min: 0, max: 90, step: 1, value: 0, digits: 0, help: '0° : champ vertical. 90° : champ horizontal.' },
      { id: 'alpha', label: 'Frottement α (amortissement)', unit: '', min: 0, max: 1, step: 0.01, value: 0.1, digits: 2, help: 'α = 0 : aucune perte. α grand : m se range presque directement.' },
      { id: 'th0', label: 'Angle de départ de m', unit: '°', min: 5, max: 175, step: 1, value: 60, digits: 0, help: 'Angle initial entre m et B (relance la simulation).' }
    ],
    buttons: [{ id: 'kick', label: 'Pichenette' }, { id: 'flip', label: 'Inverser le champ' }, { id: 'reset', label: 'Recommencer' }],
    whatIf: [
      { label: 'Et sans frottement ?', set: { alpha: 0 } },
      { label: 'Et un champ ×4 ?', set: { B: 400 } },
      { label: 'Et un frottement énorme ?', set: { alpha: 1 } }
    ],
    challenges: [
      { id: 'cmp1', text: 'Fais précesser l’aimantation à plus de 10 GHz', test: function (o) { return o.f > 10; } },
      { id: 'cmp2', text: 'Aligne m sur B en moins de 0,5 ns (départ à plus de 60°)', test: function (o) { return o.alignedDur !== null && o.alignedDur < 0.5e-9; } },
      { id: 'cmp3', text: 'Précession éternelle : α = 0 et rien ne s’aligne pendant 3 ns', test: function (o, p) { return p.alpha === 0 && o.sinceEvent > 3e-9 && o.angle > 30; } }
    ],
    phone: {
      uses: ['tilt', 'magnet'], hint: 'Penche le téléphone : le champ B suit la pente et m part en toupie. Approche un aimant : B se renforce.',
      apply: function (sim, s) {
        const tx = s.tilt.x, ty = s.tilt.y, z = Math.sqrt(Math.max(0.04, 1 - Math.min(1, tx * tx + ty * ty)));
        const n = Math.sqrt(tx * tx + ty * ty + z * z);
        sim.dir = [tx / n, ty / n, z / n];
        const B = Math.round(100 + 300 * s.magnet);
        if (B !== sim.p.B) {
          sim.p.B = B;
          sim.bScale = Math.max(2e-3, B * 1e-3);
          sim.host.setParamUI('B', B);
        }
      }
    },
    create: function (h, d) { return new CompassSim(h, d); }
  },
  {
    id: 'hysteresis', name: 'Hystérésis',
    params: [
      { id: 'BK', label: 'Anisotropie B_K (dureté)', unit: 'mT', min: 20, max: 300, step: 5, value: 100, digits: 0, help: 'Champ qu’il faut pour retourner l’aimant quand le champ est le long de l’axe facile.' },
      { id: 'psi', label: 'Angle ψ entre champ et axe facile', unit: '°', min: 0, max: 90, step: 1, value: 20, digits: 0, help: '0° : champ le long de l’axe. 90° : champ perpendiculaire.' },
      { id: 'Bmax', label: 'Champ maximal du balayage', unit: 'mT', min: 50, max: 400, step: 5, value: 200, digits: 0, help: 'Trop petit : l’aimant ne se retourne jamais.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.05, max: 1, step: 0.05, value: 0.5, digits: 2, help: 'Un frottement élevé rend le balayage quasi statique.' },
      { id: 'rate', label: 'Vitesse de balayage', unit: 'mT/ns', min: 10, max: 200, step: 5, value: 40, digits: 0, help: 'Plus lent = plus proche de la théorie statique.' },
      { id: 'B', label: 'Champ appliqué B', unit: 'mT', min: -400, max: 400, step: 1, value: 200, digits: 0, help: 'C’est toi qui balaies le champ. Descends lentement, regarde quand m bascule.' },
      { id: 'auto', type: 'check', label: 'Balayage automatique', value: false, help: 'Optionnel : la machine balaie à ta place.' }
    ],
    buttons: [{ id: 'down', label: 'B − 5 mT' }, { id: 'up', label: 'B + 5 mT' }, { id: 'reset', label: 'Nouveau cycle' }],
    whatIf: [
      { label: 'Cycle carré (ψ = 0°)', set: { psi: 0 } },
      { label: 'ψ = 45° : le plus facile', set: { psi: 45 } },
      { label: 'Champ perpendiculaire (ψ = 90°)', set: { psi: 90 } }
    ],
    challenges: [
      { id: 'hys1', text: 'Retourne l’aimant avec un champ ≤ 60 % de B_K', test: function (o, p) { return o.swAbs !== null && o.swAbs <= 0.6 * p.BK; } },
      { id: 'hys2', text: 'Supprime l’hystérésis : champ perpendiculaire à l’axe', test: function (o, p) { return p.psi >= 89; } },
      { id: 'hys3', text: 'Mesure un retournement à ±10 % de la formule théorique', test: function (o, p) { return o.swAbs !== null && p.psi < 89 && Math.abs(o.swAbs - o.th) < 0.1 * o.th; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche le téléphone à gauche ou à droite : tu pilotes le champ toi-même et tu dessines le cycle.',
      apply: function (sim, s) { phoneSet(sim, 'B', Math.round(s.tilt.x * sim.p.Bmax), 0.5); }
    },
    create: function (h, d) { return new HysteresisSim(h, d); }
  },
  {
    id: 'curie', name: 'Température de Curie',
    params: [
      { id: 'T', label: 'Température (en unités J/k_B)', unit: '', min: 0.3, max: 5, step: 0.01, value: 1.6, digits: 2, help: 'La température critique vaut T_C ≈ 2,27.' },
      { id: 'h', label: 'Champ appliqué h', unit: '', min: -1, max: 1, step: 0.01, value: 0, digits: 2, help: 'Un petit champ choisit le camp gagnant.' },
      { id: 'speed', label: 'Vitesse de calcul', unit: 'balayages/image', min: 1, max: 12, step: 1, value: 3, digits: 0, help: 'Plus de balayages = évolution plus rapide.' },
      { id: 'mat', type: 'select', label: 'Matériau (pour les °C)', value: 'fe', options: [['fe', 'Fer (T_C = 770 °C)'], ['ni', 'Nickel (354 °C)'], ['gd', 'Gadolinium (20 °C)'], ['nd', 'Néodyme-fer-bore (312 °C)']], help: 'Change seulement la conversion en degrés.' }
    ],
    buttons: [{ id: 'up', label: 'Tout aligner ↑' }, { id: 'random', label: 'Désordre total' }, { id: 'anneal', label: 'Refroidir lentement' }, { id: 'quench', label: 'Trempe brutale' }, { id: 'heat', label: 'Chauffer fort' }, { id: 'reset', label: 'Effacer M(T)' }],
    whatIf: [
      { label: 'Et juste à T_C ?', set: { T: 2.27 } },
      { label: 'Et du gadolinium ?', set: { mat: 'gd' } },
      { label: 'Et un petit champ ?', set: { h: 0.1 } }
    ],
    challenges: [
      { id: 'cur1', text: 'Désaimante l’aimant en le chauffant au-dessus de T_C', test: function (o) { return o.wasMag && o.T > 2.4 && o.A < 0.1; } },
      { id: 'cur2', text: 'Recuit réussi : refroidis lentement jusqu’à |M| > 0,9', test: function (o) { return o.annealDone && o.A > 0.9; } },
      { id: 'cur3', text: 'Reste 3 secondes près du point critique (±5 %)', test: function (o) { return o.crit > 3; } },
      { id: 'cur4', text: 'Secoue le téléphone (ou le bouton) jusqu’à désaimanter', test: function (o) { return o.shakeMax > 0.5 && o.wasMag && o.A < 0.2; } }
    ],
    phone: {
      uses: ['shake', 'tilt'], hint: 'Secoue le téléphone : tu chauffes l’aimant ! Penche-le : tu ajoutes un champ h.',
      apply: function (sim, s) {
        sim.extraT = Math.max(sim.extraT, s.shake * 3.5);
        sim.shakeMax = Math.max(sim.shakeMax, s.shake);
        phoneSet(sim, 'h', Math.round(s.tilt.x * 12) / 20, 0.01);
      }
    },
    create: function (h, d) { return new CurieSim(h, d); }
  },
  {
    id: 'barkhausen', name: 'Bruit de Barkhausen',
    params: [
      { id: 'R', label: 'Désordre R (impuretés)', unit: '', min: 0.2, max: 3, step: 0.05, value: 0.9, digits: 2, help: 'Change l’échantillon : un nouveau tirage de défauts.' },
      { id: 'rate', label: 'Vitesse du balayage', unit: '', min: 0.1, max: 3, step: 0.01, value: 1, digits: 2, log: true, help: 'Lent : on distingue chaque avalanche.' },
      { id: 'auto', type: 'check', label: 'Balayage automatique', value: false, help: 'Optionnel : la machine balaie à ta place.' },
      { id: 'H', label: 'Champ H (manuel)', unit: '', min: -8, max: 8, step: 0.01, value: -4.6, digits: 2, help: 'Toucher ce curseur passe en mode manuel.' }
    ],
    buttons: [{ id: 'newdis', label: 'Nouvel échantillon' }, { id: 'reset', label: 'Recommencer le cycle' }],
    whatIf: [
      { label: 'Et presque sans défaut ?', set: { R: 0.35 } },
      { label: 'Et très désordonné ?', set: { R: 2.6 } },
      { label: 'Et au point critique ?', set: { R: 0.9 } }
    ],
    challenges: [
      { id: 'brk1', text: 'Un « clac » géant : une avalanche de plus de la moitié des spins', test: function (o) { return o.snap; } },
      { id: 'brk2', text: 'Fais craquer : au moins 200 avalanches en un demi-cycle', test: function (o) { return o.crackle; } },
      { id: 'brk3', text: 'Cycle lisse : demi-cycle sans avalanche de plus de 20 spins', test: function (o) { return o.smooth; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche lentement le téléphone : tu balaies le champ H. Active le son, sens les vibrations.',
      apply: function (sim, s) { phoneSet(sim, 'H', Math.round(s.tilt.x * sim.Hmax * 100) / 100, 0.005); }
    },
    create: function (h, d) { return new BarkhausenSim(h, d); }
  },
  {
    id: 'disk', name: 'Le disque dur qui oublie',
    params: [
      { id: 'word', type: 'text', label: 'Ton mot (12 caractères max)', value: 'BONJOUR', max: 12, help: 'Puis clique sur « Écrire le mot ».' },
      { id: 'mat', type: 'select', label: 'Support', value: 'hdd', options: [['hdd', 'Disque dur (CoCrPt)'], ['card', 'Piste de carte bancaire'], ['hamr', 'Futur : FePt + laser (HAMR)']], help: 'Chaque support a sa barrière et son champ d’anisotropie.' },
      { id: 'd', label: 'Taille des grains', unit: 'nm', min: 2, max: 40, step: 0.1, value: 9, digits: 1, log: true, help: 'Volume ∝ d² : la barrière d’énergie aussi.' },
      { id: 'T', label: 'Température', unit: '°C', min: 20, max: 700, step: 5, value: 25, digits: 0, help: 'La chaleur fournit l’énergie k_BT.' },
      { id: 'clock', type: 'select', label: 'Le temps défile…', value: 'year', options: [['rt', '1 s = 1 s'], ['min', '1 s = 1 minute'], ['day', '1 s = 1 jour'], ['year', '1 s = 1 an'], ['kyear', '1 s = 1 000 ans']], help: 'Accélère pour tester la durée de vie des données.' },
      { id: 'Bm', label: 'Force de l’aimant (ton doigt)', unit: 'T', min: 0, max: 1.5, step: 0.05, value: 0.3, digits: 2, help: 'Glisse le doigt sur le disque pour l’approcher.' },
      { id: 'laser', type: 'check', label: 'Laser de chauffage (HAMR)', value: false, help: 'Chauffe chaque grain pendant l’écriture.' }
    ],
    buttons: [{ id: 'write', label: 'Écrire le mot' }, { id: 'heat', label: 'Coup de chaleur' }, { id: 'wipe', label: 'Disque vierge' }],
    whatIf: [
      { label: 'Et des grains de 6 nm ?', set: { d: 6 } },
      { label: 'Et à 300 °C ?', set: { T: 300 } },
      { label: 'Et une carte bancaire ?', set: { mat: 'card' } },
      { label: 'Et le disque du futur ?', set: { mat: 'hamr', laser: true } }
    ],
    challenges: [
      { id: 'dsk1', text: 'Garde ton mot intact pendant 10 ans', test: function (o) { return o.wrote && o.ok && o.simT >= 3.156e8 && o.correct === 96; } },
      { id: 'dsk2', text: 'Atteins la limite superparamagnétique : moins de 60 bits justes, sans chauffer', test: function (o) { return o.wrote && o.ok && o.correct < 60 && !o.magUsed && !o.hot; } },
      { id: 'dsk3', text: 'Efface une piste de carte bancaire avec un aimant', test: function (o) { return o.mat === 'card' && o.wrote && o.magUsed && o.correct < 60; } },
      { id: 'dsk4', text: 'Écris sur du FePt grâce au laser (HAMR)', test: function (o) { return o.mat === 'hamr' && o.wrote && o.ok && o.laser; } }
    ],
    phone: {
      uses: ['shake', 'magnet'], hint: 'Secoue : tu chauffes le disque. Approche un vrai aimant : il efface les bits fragiles.',
      apply: function (sim, s) {
        sim.extraHeat = Math.max(sim.extraHeat, s.shake * 350);
        sim.phoneB = s.magnet * 0.45;
      }
    },
    create: function (h, d) { return new DiskSim(h, d); }
  },
  {
    id: 'wall', name: 'Paroi de domaine',
    params: [
      { id: 'A', label: 'Échange A', unit: 'pJ/m', min: 8, max: 30, step: 1, value: 15, digits: 0, help: 'Veut élargir la paroi : les voisins veulent rester parallèles.' },
      { id: 'K', label: 'Anisotropie K', unit: 'kJ/m³', min: 150, max: 800, step: 10, value: 500, digits: 0, help: 'Veut rétrécir la paroi : les spins préfèrent ↑ ou ↓.' },
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 5, step: 0.1, value: 2, digits: 1, help: 'Impose un sens de rotation (chiralité).' },
      { id: 'Bz', label: 'Champ B_z', unit: 'mT', min: -100, max: 100, step: 1, value: 40, digits: 0, help: 'Pousse la paroi : le domaine aligné sur le champ grandit.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.02, max: 1, step: 0.01, value: 0.3, digits: 2, log: true, help: 'Freine la paroi.' }
    ],
    buttons: [{ id: 'reset', label: 'Recommencer' }],
    whatIf: [
      { label: 'Et sans DMI ?', set: { D: 0 } },
      { label: 'Et beaucoup de DMI ?', set: { D: 4.5 } },
      { label: 'Et un champ nul ?', set: { Bz: 0 } }
    ],
    challenges: [
      { id: 'wal1', text: 'Obtiens une paroi de Néel', test: function (o, p) { return p.D > 0.5 && o.type === 'Néel'; } },
      { id: 'wal2', text: 'Fais avancer la paroi à plus de 150 m/s', test: function (o) { return o.v !== null && o.v > 150; } },
      { id: 'wal3', text: 'Amincis la paroi sous 4 nm', test: function (o) { return o.wallW < 4e-9; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche le téléphone : la paroi roule du côté où tu penches.',
      apply: function (sim, s) {
        const v = Math.round(s.tilt.x * 100);
        if (v !== sim.p.Bz) { sim.p.Bz = v; sim.core.Bz = v * 1e-3; sim.host.setParamUI('Bz', v); }
      }
    },
    create: function (h, d) { return new WallSim(h, d); }
  },
  {
    id: 'vortex', name: 'Vortex dans un disque',
    params: [
      { id: 'diam', label: 'Diamètre du disque', unit: 'nm', min: 60, max: 150, step: 5, value: 120, digits: 0, help: 'Relance la simulation.' },
      { id: 'thick', label: 'Épaisseur', unit: 'nm', min: 5, max: 40, step: 1, value: 20, digits: 0, help: 'Relance la simulation.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.5, step: 0.005, value: 0.05, digits: 3, log: true, help: 'Petit α : le cœur fait beaucoup de tours.' },
      { id: 'Bx', label: 'Champ B_x (dans le plan)', unit: 'mT', min: -150, max: 150, step: 1, value: 0, digits: 0, help: 'Décale le cœur… perpendiculairement au champ.' },
      { id: 'By', label: 'Champ B_y (dans le plan)', unit: 'mT', min: -150, max: 150, step: 1, value: 0, digits: 0, help: 'Même effet, dans l’autre direction.' },
      { id: 'disp', type: 'select', label: 'Affichage', value: 'wheel', options: [['wheel', 'Roue des couleurs'], ['mz', 'Composante z']], help: 'La roue montre la direction dans le plan.' },
      { id: 'arrows', type: 'check', label: 'Afficher les flèches', value: false, help: '' }
    ],
    buttons: [{ id: 'pulse', label: 'Impulsion de champ' }, { id: 'vortex', label: 'Vortex décalé' }, { id: 'random', label: 'État aléatoire' }, { id: 'uniform', label: 'Uniforme' }],
    whatIf: [
      { label: 'Et un frottement minuscule ?', set: { alpha: 0.008 } },
      { label: 'Et un disque plus épais ?', set: { thick: 35 } },
      { label: 'Et un champ fort ?', set: { Bx: 120 } }
    ],
    challenges: [
      { id: 'vor1', text: 'Fais naître un vortex depuis l’état aléatoire', test: function (o) { return o.mode === 'random' && o.circAbs > 0.6 && o.t > 3e-10; } },
      { id: 'vor2', text: 'Déplace le cœur à plus de 25 nm du centre', test: function (o) { return o.coreR > 25 && o.circAbs > 0.4; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche le téléphone : tu appliques un champ dans le plan. Surprise, le cœur ne va pas où tu penches !',
      apply: function (sim, s) {
        const bx = Math.round(s.tilt.x * 120), by = Math.round(s.tilt.y * 120);
        if (bx !== sim.p.Bx || by !== sim.p.By) {
          sim.p.Bx = bx; sim.p.By = by;
          sim.baseBx = bx * 1e-3; sim.baseBy = by * 1e-3;
          sim.core.By = sim.baseBy;
          sim.host.setParamUI('Bx', bx);
          sim.host.setParamUI('By', by);
        }
      }
    },
    create: function (h, d) { return new VortexSim(h, d); }
  },
  {
    id: 'skyrmion', name: 'Skyrmions',
    params: [
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 6, step: 0.1, value: 3.5, digits: 1, help: 'Favorise l’enroulement. Au-dessus de D_c, l’état uniforme devient instable.' },
      { id: 'K', label: 'Anisotropie effective K', unit: 'kJ/m³', min: 300, max: 1000, step: 10, value: 600, digits: 0, help: 'Garde l’aimantation perpendiculaire au film.' },
      { id: 'Bz', label: 'Champ perpendiculaire B_z', unit: 'mT', min: -50, max: 250, step: 5, value: 0, digits: 0, help: 'Un champ ↑ fait rétrécir les zones ↓.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.1, max: 1, step: 0.01, value: 0.5, digits: 2, log: true, help: 'Fort α : relaxation rapide.' },
      { id: 'disp', type: 'select', label: 'Affichage', value: 'wheel', options: [['wheel', 'Roue des couleurs'], ['mz', 'Composante z (rouge ↑, bleu ↓)']], help: '' },
      { id: 'arrows', type: 'check', label: 'Afficher les flèches', value: false, help: '' }
    ],
    buttons: [{ id: 'seed', label: 'Un skyrmion' }, { id: 'random', label: 'Aléatoire' }, { id: 'uniform', label: 'Uniforme' }],
    whatIf: [
      { label: 'Et plus de DMI ? (labyrinthe)', set: { D: 4.6 }, act: 'random' },
      { label: 'Et un champ fort ?', set: { Bz: 220 } },
      { label: 'Et sans DMI ?', set: { D: 0 } }
    ],
    challenges: [
      { id: 'sky1', text: 'Crée un skyrmion stable : |Q| ≈ 1 après 0,4 ns', test: function (o) { return Math.abs(Math.abs(o.Q) - 1) < 0.2 && o.t > 4e-10; } },
      { id: 'sky2', text: 'Fais naître un labyrinthe de rubans', test: function (o) { return o.maze; } },
      { id: 'sky3', text: 'Fabrique au moins 4 skyrmions (|Q| ≥ 4)', test: function (o) { return Math.abs(o.Q) >= 3.6 && o.t > 4e-10; } }
    ],
    phone: {
      uses: ['magnet', 'shake'], hint: 'Approche un aimant : le champ B_z écrase les skyrmions. Secoue : tu ajoutes du désordre.',
      apply: function (sim, s) {
        if (sim._pb === undefined) sim._pb = sim.p.Bz;
        const v = clamp(Math.round((sim._pb + s.magnet * 220) / 5) * 5, -50, 250);
        if (v !== sim.p.Bz) { sim.p.Bz = v; sim.core.Bz = v * 1e-3; sim.host.setParamUI('Bz', v); }
        if (s.shake > 0.25) {
          const c = sim.core, k = Math.floor(c.n * 0.04 * s.shake), a = 1.2 * s.shake;
          for (let q = 0; q < k; q++) {
            const i = (Math.random() * c.n) | 0;
            c.mx[i] += a * (Math.random() - 0.5);
            c.my[i] += a * (Math.random() - 0.5);
            c.mz[i] += a * (Math.random() - 0.5);
          }
          c.normalizeAll();
        }
      }
    },
    create: function (h, d) { return new SkyrmionSim(h, d, 'static'); }
  },
  {
    id: 'fmr', name: 'Résonance ferromagnétique',
    params: [
      { id: 'B0', label: 'Champ statique B₀ (dans le plan)', unit: 'mT', min: 0, max: 300, step: 1, value: 100, digits: 0, help: 'Fixe la note de l’aimant.' },
      { id: 'mat', type: 'select', label: 'Matériau', value: 'py', options: [['py', 'Permalloy (μ₀Mₛ = 1,0 T)'], ['cofeb', 'CoFeB (1,6 T)'], ['yig', 'YIG (0,18 T)']], help: 'μ₀Mₛ change la fréquence de résonance.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.002, max: 0.2, step: 0.001, value: 0.02, digits: 3, log: true, help: 'Petit α : résonance fine et haute.' },
      { id: 'f', label: 'Fréquence de pilotage', unit: 'GHz', min: 1, max: 40, step: 0.1, value: 5, digits: 1, help: 'Fréquence du champ micro-onde.' },
      { id: 'bac', label: 'Amplitude du champ micro-onde', unit: 'mT', min: 0.1, max: 5, step: 0.1, value: 1, digits: 1, help: 'Le « coup de marteau » à chaque période.' }
    ],
    buttons: [{ id: 'tune', label: 'Accorder sur la résonance' }, { id: 'kick', label: 'Taper l’aimant' }, { id: 'reset', label: 'Recommencer' }],
    whatIf: [
      { label: 'Et un matériau très amorti ?', set: { alpha: 0.2 } },
      { label: 'Et un amortissement minimal ?', set: { alpha: 0.002 } },
      { label: 'Et du CoFeB ?', set: { mat: 'cofeb' } }
    ],
    challenges: [
      { id: 'fmr1', text: 'Fais osciller l’aimantation de plus de 15°', test: function (o) { return o.amp > 0.26; } },
      { id: 'fmr2', text: 'Fais résonner l’aimant à 20 GHz (±1)', test: function (o, p) { return Math.abs(o.fres - 20) < 1 && Math.abs(p.f - o.fres) < 1 && o.amp > 0.08; } },
      { id: 'fmr3', text: 'Résonance très fine : α ≤ 0,005 et amplitude > 30°', test: function (o, p) { return p.alpha <= 0.0051 && o.amp > 0.5; } }
    ],
    phone: {
      uses: ['flick', 'tilt'], hint: 'Donne une pichenette au téléphone : tu « tapes » l’aimant. Penche-le : tu changes B₀.',
      apply: function (sim, s) {
        if (flickOnce(sim, s)) sim.action('kick');
        phoneSet(sim, 'B0', Math.round(clamp(150 + s.tilt.x * 150, 0, 300) / 5) * 5, 0.5);
      }
    },
    create: function (h, d) { return new FmrSim(h, d); }
  },
  {
    id: 'pulse', name: 'Retournement éclair',
    params: [
      { id: 'BK', label: 'Anisotropie B_K', unit: 'mT', min: 20, max: 400, step: 5, value: 200, digits: 0, help: 'Hauteur de la barrière qui garde l’aimant ↑.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.3, step: 0.005, value: 0.02, digits: 3, log: true, help: 'Petit α : précession longue.' },
      { id: 'Bp', label: 'Amplitude de l’impulsion B_p', unit: 'mT', min: 0, max: 500, step: 1, value: 150, digits: 0, help: 'Doit dépasser B_K/2.' },
      { id: 'tau', label: 'Durée de l’impulsion', unit: 'ps', min: 10, max: 400, step: 1, value: 100, digits: 0, help: 'Environ un demi-tour de précession.' }
    ],
    buttons: [{ id: 'fire', label: 'Tirer l’impulsion' }, { id: 'cal', label: 'Trouver la durée idéale' }],
    whatIf: [
      { label: 'Et une impulsion trop courte ?', set: { tau: 20 }, act: 'fire' },
      { label: 'Et une impulsion trop faible ?', set: { Bp: 60 }, act: 'fire' },
      { label: 'Et un aimant plus mou ?', set: { BK: 60 } }
    ],
    challenges: [
      { id: 'pul1', text: 'Retourne l’aimant avec une impulsion', test: function (o) { return o.flipped; } },
      { id: 'pul2', text: 'Retourne avec une impulsion de moins de 60 ps', test: function (o) { return o.flipped && o.tau < 60; } },
      { id: 'pul3', text: 'Retourne avec une impulsion de moins de 50 mT', test: function (o) { return o.flipped && o.Bp < 50; } }
    ],
    phone: {
      uses: ['flick'], hint: 'Donne une pichenette au téléphone pour tirer l’impulsion.',
      apply: function (sim, s) { if (flickOnce(sim, s)) sim.action('fire'); }
    },
    create: function (h, d) { return new PulseSim(h, d); }
  },
  {
    id: 'swave', name: 'Ondes de spin',
    params: [
      { id: 'f', label: 'Fréquence de l’antenne', unit: 'GHz', min: 1, max: 12, step: 0.1, value: 7, digits: 1, help: 'Au-dessus de f₀, l’onde se propage. En dessous : rien.' },
      { id: 'B', label: 'Champ perpendiculaire B', unit: 'mT', min: 0, max: 300, step: 1, value: 100, digits: 0, help: 'Déplace la fréquence de coupure f₀ : un interrupteur magnétique.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.001, max: 0.05, step: 0.001, value: 0.005, digits: 3, log: true, help: 'L’amortissement fait mourir l’onde.' },
      { id: 'b0', label: 'Puissance de l’antenne', unit: 'mT', min: 0.5, max: 10, step: 0.5, value: 4, digits: 1, help: 'Amplitude du champ de l’antenne.' },
      { id: 'src', type: 'select', label: 'Source', value: 'point', options: [['point', 'Point (ondes circulaires)'], ['line', 'Ligne (onde plane)'], ['two', 'Deux points (interférences)']], help: '' }
    ],
    buttons: [{ id: 'reset', label: 'Relancer' }],
    whatIf: [
      { label: 'Et deux sources ?', set: { src: 'two' } },
      { label: 'Et une onde plane ?', set: { src: 'line' } },
      { label: 'Et sous la fréquence de coupure ?', set: { f: 2 } }
    ],
    challenges: [
      { id: 'sw1', text: 'Fais propager une onde de spin', test: function (o) { return o.prop && o.t > 3e-10; } },
      { id: 'sw2', text: 'Coupe la propagation : fréquence sous le gap f₀', test: function (o) { return !o.prop && o.f < o.f0 - 0.3; } },
      { id: 'sw3', text: 'Fabrique une onde de longueur d’onde < 90 nm', test: function (o) { return o.prop && o.lambda < 90e-9; } },
      { id: 'sw4', text: 'Fais des interférences avec deux sources', test: function (o, p) { return p.src === 'two' && o.prop && o.t > 3e-10; } }
    ],
    phone: {
      uses: ['tilt', 'magnet'], hint: 'Penche : tu règles la fréquence de l’antenne. Approche un aimant : le champ coupe les ondes.',
      apply: function (sim, s) {
        phoneSet(sim, 'f', Math.round((6.5 + s.tilt.x * 5.5) * 10) / 10, 0.05);
        phoneSet(sim, 'B', Math.round((100 + 200 * s.magnet) / 5) * 5, 0.5);
      }
    },
    create: function (h, d) { return new SpinWaveSim(h, d); }
  },
  {
    id: 'stt', name: 'Écrire avec un courant',
    params: [
      { id: 'BK', label: 'Anisotropie B_K', unit: 'mT', min: 20, max: 300, step: 5, value: 100, digits: 0, help: 'Dureté de l’aimant.' },
      { id: 'Bz', label: 'Champ de biais B_z', unit: 'mT', min: -50, max: 50, step: 1, value: 0, digits: 0, help: 'Favorise ↑ ou ↓.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.3, step: 0.005, value: 0.05, digits: 3, log: true, help: 'Le courant doit vaincre ce frottement.' },
      { id: 'aJ', label: 'Courant (couple de spin a_J)', unit: 'mT', min: -40, max: 40, step: 0.5, value: 0, digits: 1, help: 'Positif : éloigne m du polariseur p. Négatif : l’en rapproche.' }
    ],
    buttons: [{ id: 'writeDown', label: 'Écrire ↓ (0)' }, { id: 'writeUp', label: 'Écrire ↑ (1)' }, { id: 'reset', label: 'Recommencer' }],
    whatIf: [
      { label: 'Et un frottement minuscule ?', set: { alpha: 0.01 } },
      { label: 'Et un aimant plus mou ?', set: { BK: 40 } },
      { label: 'Et un champ de biais fort ?', set: { Bz: 40 } }
    ],
    challenges: [
      { id: 'stt1', text: 'Fais basculer l’aimant vers le bas (↓)', test: function (o) { return o.mz < -0.9; } },
      { id: 'stt2', text: 'Écris ↓ puis réécris ↑ : un cycle complet', test: function (o) { return o.cycle; } },
      { id: 'stt3', text: 'Fais basculer avec un courant inférieur à 3 mT', test: function (o) { return o.swAmp !== null && Math.abs(o.swAmp) < 3; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche à droite : courant positif (écrit ↓). À gauche : courant négatif (écrit ↑).',
      apply: function (sim, s) { phoneSet(sim, 'aJ', Math.round(s.tilt.x * 80) / 2, 0.25); }
    },
    create: function (h, d) { return new SttSim(h, d); }
  },
  {
    id: 'sto', name: 'Nano-oscillateur',
    params: [
      { id: 'B', label: 'Champ dans le plan B', unit: 'mT', min: 20, max: 300, step: 1, value: 100, digits: 0, help: 'Règle la fréquence.' },
      { id: 'mu0Ms', label: 'Aimantation μ₀Mₛ', unit: 'T', min: 0.2, max: 1.6, step: 0.05, value: 1.0, digits: 2, help: 'Matériau de la couche libre.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.1, step: 0.001, value: 0.02, digits: 3, log: true, help: 'Fixe le seuil.' },
      { id: 'aJ', label: 'Courant (couple de spin a_J)', unit: 'mT', min: 0, max: 40, step: 0.5, value: 16, digits: 1, help: 'Au-dessus du seuil a_c, l’oscillateur démarre.' }
    ],
    buttons: [{ id: 'kick', label: 'Pichenette' }, { id: 'reset', label: 'Recommencer' }],
    whatIf: [
      { label: 'Et sous le seuil ?', set: { aJ: 5 } },
      { label: 'Et un champ fort ?', set: { B: 250 } },
      { label: 'Et un faible amortissement ?', set: { alpha: 0.008, aJ: 8 } }
    ],
    challenges: [
      { id: 'sto1', text: 'Allume l’oscillateur : amplitude entretenue > 20°', test: function (o) { return o.amp > 0.34; } },
      { id: 'sto2', text: 'Fais osciller à plus de 15 GHz', test: function (o) { return o.f !== null && o.f > 15 && o.amp > 0.2; } },
      { id: 'sto3', text: 'Accorde 10 GHz (±0,5)', test: function (o) { return o.f !== null && Math.abs(o.f - 10) < 0.5 && o.amp > 0.2; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Plus tu penches, plus il y a de courant. Active le son pour écouter ton émetteur.',
      apply: function (sim, s) {
        const m = Math.min(1, Math.sqrt(s.tilt.x * s.tilt.x + s.tilt.y * s.tilt.y));
        phoneSet(sim, 'aJ', Math.round(m * 80) / 2, 0.25);
      }
    },
    create: function (h, d) { return new StoSim(h, d); }
  },
  {
    id: 'skcur', name: 'Skyrmion sous courant',
    params: [
      { id: 'u', label: 'Vitesse des électrons u', unit: 'm/s', min: 0, max: 400, step: 5, value: 150, digits: 0, help: 'Proportionnelle à la densité de courant.' },
      { id: 'dir', label: 'Direction du courant', unit: '°', min: 0, max: 360, step: 5, value: 0, digits: 0, help: '0° : vers la droite. 90° : vers le haut.' },
      { id: 'ratio', label: 'β / α (non-adiabaticité)', unit: '', min: 0, max: 2, step: 0.05, value: 0.2, digits: 2, help: 'β = α : plus d’effet Hall.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.05, max: 1, step: 0.05, value: 0.3, digits: 2, help: 'Un fort α réduit l’angle de Hall.' }
    ],
    buttons: [{ id: 'seed', label: 'Nouveau skyrmion' }, { id: 'clear', label: 'Effacer la trace' }],
    whatIf: [
      { label: 'Et β = α ?', set: { ratio: 1 } },
      { label: 'Et un courant vers le haut ?', set: { dir: 90 } },
      { label: 'Et un très fort frottement ?', set: { alpha: 1 } }
    ],
    challenges: [
      { id: 'skc1', text: 'Fais avancer le skyrmion à plus de 30 m/s', test: function (o) { return o.v !== null && o.v > 30; } },
      { id: 'skc2', text: 'Annule l’effet Hall : angle < 5°', test: function (o) { return o.hall !== null && o.v > 10 && Math.abs(o.hall) < 5; } },
      { id: 'skc3', text: 'Fais dévier le skyrmion de plus de 45°', test: function (o) { return o.hall !== null && o.v > 10 && Math.abs(o.hall) > 45; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche le téléphone : le courant coule vers le bas de la pente. Le skyrmion roule… de travers !',
      apply: function (sim, s) {
        const m = Math.min(1, Math.sqrt(s.tilt.x * s.tilt.x + s.tilt.y * s.tilt.y));
        const u = Math.round(m * 80) * 5;
        const dir = m > 0.05 ? Math.round((((Math.atan2(s.tilt.y, s.tilt.x) / DEG) + 360) % 360) / 5) * 5 : sim.p.dir;
        if (u !== sim.p.u || dir !== sim.p.dir) {
          sim.p.u = u; sim.p.dir = dir;
          sim.core.ux = u * Math.cos(dir * DEG);
          sim.core.uy = u * Math.sin(dir * DEG);
          sim.host.setParamUI('u', u);
          sim.host.setParamUI('dir', dir);
          sim._pp = (sim._pp || 0) + 1;
          if (sim._pp % 15 === 0) sim.core.prepare();
        }
      }
    },
    create: function (h, d) { return new SkyrmionSim(h, d, 'current'); }
  }
];


// ===== catalogue/modes_new.js =====
function pyVec(v) { return '(' + v.map(py).join(', ') + ')'; }

function ubAxis(a) { return a === 'x' ? '(1, 0, 0)' : (a === 'y' ? '(0, 1, 0)' : '(0, 0, 1)'); }

function ubInitPy(p) {
  const k = p.init;
  if (k === 'ux') return 'm_init = (1, 0, 0)';
  if (k === 'rand') return 'rng = np.random.default_rng(1)\n\ndef m_init(point):\n    return 2 * rng.random(3) - 1';
  if (k === 'vortex') return 'def m_init(point):\n    x, y, z = point\n    return (-(y - Ly / 2), x - Lx / 2, 10e-9)';
  if (k === 'sky') return 'def m_init(point):\n    x, y, z = point\n    if (x - Lx / 2) ** 2 + (y - Ly / 2) ** 2 < (min(Lx, Ly) / 6) ** 2:\n        return (0, 0, -1)\n    return (0, 0, 1)';
  if (k === 'stripes') return 'lam = ' + py(p.D ? 4 * Math.PI * p.A * 1e-12 / Math.abs(p.D * 1e-3) : 50e-9) + '\n\ndef m_init(point):\n    x, y, z = point\n    return (np.sin(2 * np.pi * x / lam), 0, np.cos(2 * np.pi * x / lam))';
  if (k === 'twodom') return 'def m_init(point):\n    x, y, z = point\n    return (0, 0, 1) if x < Lx / 2 else (0, 0, -1)';
  return 'm_init = (0, 0, 1)';
}

function ubNormPy(p) {
  const sh = p.bc === 'pbc' ? 'rect' : p.shape;
  if (sh === 'rect') return 'norm = Ms';
  if (sh === 'disk') return 'def norm(point):\n    x, y, z = point\n    if ((x - Lx / 2) / (Lx / 2)) ** 2 + ((y - Ly / 2) / (Ly / 2)) ** 2 <= 1:\n        return Ms\n    return 0';
  if (sh === 'ring') return 'def norm(point):\n    x, y, z = point\n    r2 = ((x - Lx / 2) / (Lx / 2)) ** 2 + ((y - Ly / 2) / (Ly / 2)) ** 2\n    return Ms if 0.2 <= r2 <= 1 else 0';
  return 'def norm(point):\n    x, y, z = point\n    depth = Ly / 4 - abs(x - Lx / 2) * 0.5\n    if depth > 0 and (y < depth or y > Ly - depth):\n        return 0\n    return Ms';
}

function ubZeePy(p) {
  const out = ['mm.Zeeman(H=' + pyVec([p.Bx, p.By, p.Bz].map(function (b) { return b * 1e-3 / MU0; })) + ', name="Hdc")'];
  let pre = '';
  if (p.fun !== 'none' && (p.bx || p.by || p.bz)) {
    const H = pyVec([p.bx, p.by, p.bz].map(function (b) { return b * 1e-3 / MU0; }));
    if (p.fun === 'sin' || p.fun === 'sinc') out.push('mm.Zeeman(H=' + H + ', func="' + p.fun + '", f=' + py(p.f * 1e9) + ', t0=' + py(p.t0 * 1e-9) + ', name="Hac")');
    else {
      const t0 = py(p.t0 * 1e-9), tw = py(p.tw * 1e-9);
      if (p.fun === 'window') pre = 'def f_t(t):\n    return 1 if ' + t0 + ' <= t < ' + t0 + ' + ' + tw + ' else 0\n\n';
      else if (p.fun === 'ramp') pre = 'def f_t(t):\n    return min(1, max(0, (t - ' + t0 + ') / ' + tw + '))\n\n';
      else pre = 'def f_t(t):\n    return np.exp(-0.5 * ((t - ' + t0 + ') / ' + tw + ') ** 2)\n\n';
      out.push('mm.Zeeman(H=' + H + ', func=f_t, dt=1e-13, name="Hac")');
    }
  }
  return { pre: pre, terms: out };
}

function ubSandboxPy(p) {
  const t = [], z = ubZeePy(p), T = p.drv === 'llg' ? p.T : 0;
  t.push('mm.Exchange(A=' + py(p.A * 1e-12) + ')');
  if (p.Dtype !== 'none' && p.D) t.push('mm.DMI(D=' + py(p.D * 1e-3) + ', crystalclass="' + (p.Dtype === 'T' ? 'T' : 'Cnv_z') + '")');
  if (p.Ktype === 'uni' && p.K) t.push('mm.UniaxialAnisotropy(K=' + py(p.K * 1e3) + ', u=' + ubAxis(p.Kaxis) + ')');
  if (p.Ktype === 'cubic' && p.K) t.push('mm.CubicAnisotropy(K=' + py(p.K * 1e3) + ', u1=(1, 0, 0), u2=(0, 1, 0))');
  if (p.demag) t.push('mm.Demag()');
  const all = t.concat(z.terms);
  let s = 'Lx, Ly, t = ' + py(p.Lx * 1e-9) + ', ' + py(p.Ly * 1e-9) + ', ' + py(p.tz * 1e-9) + '\ncell = ' + py(p.cell * 1e-9) + '\nMs = ' + py(p.Ms * 1e3) + '\n\n';
  s += 'region = df.Region(p1=(0, 0, 0), p2=(Lx, Ly, t))\nmesh = df.Mesh(region=region, cell=(cell, cell, t)' + (p.bc === 'pbc' ? ', bc="xy"' : '') + ')\n\n';
  s += ubNormPy(p) + '\n\n' + ubInitPy(p) + '\n\n' + z.pre;
  s += 'system = mm.System(name="bac_a_sable"' + (T > 0 ? ', T=' + py(T) : '') + ')\nsystem.energy = (\n    ' + all.join('\n    + ') + '\n)\n';
  s += 'system.dynamics = mm.Precession(gamma0=mm.consts.gamma0) + mm.Damping(alpha=' + py(p.alpha) + ')\n';
  s += 'system.m = df.Field(mesh, nvdim=3, value=m_init, norm=norm, valid="norm")';
  let d;
  if (p.drv === 'relax') d = 'md = oc.MinDriver()\nmd.drive(system)\nsystem.m.z.sel("z").mpl()';
  else d = (T > 0 ? 'td = oc.TimeDriver(evolver=oc.UHH_ThetaEvolver(fixed_timestep=2e-13))' : 'td = oc.TimeDriver()') + '\ntd.drive(system, t=2e-9, n=200)\nsystem.table.mpl(y=["mx", "my", "mz"])\nsystem.m.z.sel("z").mpl()';
  return [s, d];
}

const SANDBOX_PARAMS = [
  { type: 'head', label: 'Matériau', open: true },
  { id: 'mat', type: 'select', label: 'Préréglage tiré de la littérature', value: 'copt', options: [['py', 'Permalloy (µMAG n°4)'], ['yig', 'YIG, grenat'], ['cofeb', 'CoFeB, dans le plan'], ['copt', 'Co/Pt + DMI (Sampaio 2013)'], ['ircopt', 'Ir/Co/Pt, labyrinthes'], ['fege', 'FeGe, DMI de volume (Beg 2015)'], ['fept', 'FePt L1₀, très dur'], ['custom', 'Personnalisé']], help: 'Change Ms, A, K, D, α, T_C et propose une géométrie adaptée. Sources dans l’onglet Sources.' },
  { id: 'Ms', label: 'Aimantation à saturation Ms', unit: 'kA/m', min: 50, max: 1800, step: 5, value: 580, digits: 0 },
  { id: 'A', label: 'Échange A', unit: 'pJ/m', min: 1, max: 30, step: 0.01, value: 15, digits: 2 },
  { id: 'Ktype', type: 'select', label: 'Anisotropie', value: 'uni', options: [['none', 'aucune'], ['uni', 'uniaxiale'], ['cubic', 'cubique']] },
  { id: 'K', label: 'Constante K', unit: 'kJ/m³', min: -1000, max: 8000, step: 1, value: 800, digits: 0, help: 'K > 0 : axe facile. K < 0 : plan facile (uniaxiale).' },
  { id: 'Kaxis', type: 'select', label: 'Axe de l’anisotropie uniaxiale', value: 'z', options: [['z', 'z, hors du plan'], ['x', 'x'], ['y', 'y']] },
  { id: 'Dtype', type: 'select', label: 'Interaction DMI', value: 'Cnv_z', options: [['none', 'aucune'], ['Cnv_z', 'interfaciale (C_nv, parois de Néel)'], ['T', 'de volume (T, cristaux B20)']] },
  { id: 'D', label: 'Constante D', unit: 'mJ/m²', min: -5, max: 5, step: 0.01, value: 3, digits: 2, help: 'Le signe choisit la chiralité.' },
  { id: 'alpha', label: 'Amortissement α', unit: '', min: 0.0001, max: 1, step: 0.0001, value: 0.3, digits: 4, log: true },
  { id: 'demag', type: 'check', label: 'Champ démagnétisant', value: true },
  { id: 'Tc', label: 'Température de Curie T_C', unit: 'K', min: 100, max: 1500, step: 5, value: 500, digits: 0, help: 'Sert seulement à l’impulsion lumineuse.' },
  { id: 'T', label: 'Température du bain T', unit: 'K', min: 0, max: 600, step: 1, value: 0, digits: 0, help: 'Bruit thermique de Brown, en dynamique LLG seulement.' },
  { type: 'head', label: 'Géométrie' },
  { id: 'shape', type: 'select', label: 'Forme', value: 'disk', options: [['rect', 'rectangle'], ['disk', 'disque / ellipse'], ['ring', 'anneau'], ['notch', 'piste à entailles']] },
  { id: 'Lx', label: 'Longueur L_x', unit: 'nm', min: 5, max: 3000, step: 1, value: 128, digits: 0, log: true },
  { id: 'Ly', label: 'Largeur L_y', unit: 'nm', min: 5, max: 3000, step: 1, value: 128, digits: 0, log: true },
  { id: 'tz', label: 'Épaisseur t (une couche)', unit: 'nm', min: 0.3, max: 50, step: 0.1, value: 1, digits: 1, log: true },
  { id: 'cell', label: 'Taille de cellule', unit: 'nm', min: 0.25, max: 25, step: 0.05, value: 4, digits: 2, log: true, help: 'Regarde l’onglet Limites : la cellule doit rester sous l_ex, δ et 2A/D.' },
  { id: 'bc', type: 'select', label: 'Bords', value: 'open', options: [['open', 'libres'], ['pbc', 'périodiques (film infini)']] },
  { type: 'head', label: 'Champ H en 3D et f(t)' },
  { id: 'Bx', label: 'μ₀H_x statique', unit: 'mT', min: -1000, max: 1000, step: 1, value: 0, digits: 0 },
  { id: 'By', label: 'μ₀H_y statique', unit: 'mT', min: -1000, max: 1000, step: 1, value: 0, digits: 0 },
  { id: 'Bz', label: 'μ₀H_z statique', unit: 'mT', min: -1000, max: 1000, step: 1, value: 0, digits: 0 },
  { id: 'fun', type: 'select', label: 'Champ variable h(t) = h·f(t)', value: 'none', options: [['none', 'aucun'], ['sin', 'sinus sin 2πf(t − t₀)'], ['window', 'impulsion carrée'], ['gauss', 'impulsion gaussienne'], ['ramp', 'rampe'], ['sinc', 'sinc, large bande']] },
  { id: 'bx', label: 'μ₀h_x', unit: 'mT', min: -500, max: 500, step: 1, value: 0, digits: 0 },
  { id: 'by', label: 'μ₀h_y', unit: 'mT', min: -500, max: 500, step: 1, value: 10, digits: 0 },
  { id: 'bz', label: 'μ₀h_z', unit: 'mT', min: -500, max: 500, step: 1, value: 0, digits: 0 },
  { id: 'f', label: 'Fréquence f', unit: 'GHz', min: 0.1, max: 100, step: 0.01, value: 5, digits: 2, log: true },
  { id: 't0', label: 'Instant t₀', unit: 'ns', min: 0, max: 10, step: 0.01, value: 0.1, digits: 2 },
  { id: 'tw', label: 'Durée (impulsion, rampe)', unit: 'ns', min: 0.005, max: 10, step: 0.005, value: 0.1, digits: 3, log: true },
  { type: 'head', label: 'Impulsion lumineuse (touche l’échantillon)' },
  { id: 'lw', label: 'Rayon du spot w', unit: 'nm', min: 5, max: 500, step: 1, value: 30, digits: 0, log: true },
  { id: 'ldT', label: 'Échauffement maximal ΔT', unit: 'K', min: 10, max: 2000, step: 10, value: 600, digits: 0 },
  { id: 'ltau', label: 'Temps de refroidissement τ', unit: 'ns', min: 0.02, max: 5, step: 0.01, value: 0.3, digits: 2, log: true },
  { type: 'head', label: 'Pilote et affichage' },
  { id: 'init', type: 'select', label: 'État initial', value: 'sky', options: [['uz', 'uniforme +z'], ['ux', 'uniforme +x'], ['rand', 'aléatoire (désaimanté)'], ['vortex', 'vortex'], ['sky', 'skyrmion'], ['stripes', 'bandes'], ['twodom', 'deux domaines']] },
  { id: 'drv', type: 'select', label: 'Pilote', value: 'llg', options: [['llg', 'dynamique LLG (TimeDriver)'], ['relax', 'relaxation (MinDriver)']] },
  { id: 'disp', type: 'select', label: 'Couleurs', value: 'wheel', options: [['wheel', 'direction (roue) + m_z'], ['mz', 'm_z'], ['mx', 'm_x'], ['my', 'm_y']] },
  { id: 'arrows', type: 'check', label: 'Flèches', value: false }
];

MODELS.push(
  {
    id: 'sandbox', name: 'Bac à sable micromagnétique',
    params: SANDBOX_PARAMS,
    buttons: [{ id: 'init', label: 'Réappliquer l’état initial' }, { id: 'flash', label: 'Flash au centre' }, { id: 'zero', label: 'Remettre t à 0' }],
    whatIf: [
      { label: 'Labyrinthe, puis flash', set: { mat: 'ircopt' }, act: 'flash' },
      { label: 'FePt avec une maille trop grosse', set: { mat: 'fept', cell: 2 } },
      { label: 'Vortex de CoFeB', set: { mat: 'cofeb' } },
      { label: 'Skyrmion de FeGe', set: { mat: 'fege' } },
      { label: 'Excitation large bande', set: { fun: 'sinc', by: 10, f: 30, t0: 0.2 } }
    ],
    challenges: [
      { id: 'sb1', text: 'Dépasse localement T_C avec une impulsion lumineuse', test: function (o) { return o.hot && o.peakT > o.Tc; } },
      { id: 'sb2', text: 'Écris un skyrmion à la lumière (|Q| ≥ 1 une fois refroidi)', test: function (o) { return o.flashed && !o.hot && Math.abs(o.Q) >= 0.8; } },
      { id: 'sb3', text: 'Relaxe jusqu’à l’équilibre (|m × B| < 1 mT)', test: function (o) { return o.conv; } },
      { id: 'sb4', text: 'Tous les voyants des limites au vert', test: function (o) { return o.limOK; } }
    ],
    phone: {
      uses: ['tilt', 'flick', 'shake'], hint: 'Penche le téléphone : le champ dans le plan suit (±100 mT). Une pichenette tire un flash au centre.',
      apply: function (sim, s, dt, host) {
        const bx = Math.round(s.tilt.x * 100), by = Math.round(s.tilt.y * 100);
        if (bx !== sim.p.Bx || by !== sim.p.By) { sim.setPhoneB(bx, by); host.setParamUI('Bx', bx); host.setParamUI('By', by); }
        if (flickOnce(sim, s)) sim.action('flash');
      }
    },
    create: function (h, d) { return new SandboxSim(h, d); }
  },
  {
    id: 'paroi_pin', name: 'Paroi et ancrage (pinning)',
    params: [
      { id: 'Bz', label: 'Champ B_z', unit: 'mT', min: -150, max: 150, step: 0.5, value: 0, digits: 1, help: 'Positif : le domaine rouge ↑ grossit, la paroi va à droite.' },
      { id: 'notch', label: 'Profondeur des entailles', unit: 'nm', min: 0, max: 36, step: 4, value: 16, digits: 0, help: 'Trois paires d’entailles en triangle. Reconstruit la piste.' },
      { id: 'dis', label: 'Désordre : grains de 15 nm', unit: '%', min: 0, max: 40, step: 1, value: 0, digits: 0, help: 'Écart type de l’anisotropie d’un grain à l’autre.' },
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 2, step: 0.05, value: 1, digits: 2 },
      { id: 'alpha', label: 'Amortissement α', unit: '', min: 0.05, max: 1, step: 0.05, value: 0.3, digits: 2 },
      { id: 'u', label: 'Courant : vitesse u des électrons', unit: 'm/s', min: 0, max: 400, step: 5, value: 0, digits: 0, help: 'Couple de Zhang-Li, β = α.' },
      { id: 'T', label: 'Température', unit: 'K', min: 0, max: 300, step: 5, value: 0, digits: 0, help: 'Bruit thermique : la paroi peut décrocher sous le seuil (reptation).' },
      { id: 'auto', type: 'check', label: 'Rampe automatique de B', value: false, help: 'Optionnel. Par défaut, c’est toi qui montes le champ.' },
      { id: 'rate', label: 'Vitesse de la rampe', unit: 'mT/ns', min: 1, max: 50, step: 1, value: 10, digits: 0 },
      { id: 'disp', type: 'select', label: 'Couleurs', value: 'mz', options: [['mz', 'm_z, comme au microscope Kerr'], ['wheel', 'direction']] }
    ],
    buttons: [{ id: 'down', label: 'B − 2 mT' }, { id: 'up', label: 'B + 2 mT' }, { id: 'zero', label: 'B = 0' }, { id: 'reset', label: 'Paroi au départ' }, { id: 'newdis', label: 'Nouveau désordre' }],
    whatIf: [
      { label: 'Piste parfaite', set: { notch: 0, dis: 0 } },
      { label: 'Désordre seul, comme un vrai film', set: { notch: 0, dis: 25 } },
      { label: 'Entailles profondes', set: { notch: 32, dis: 0 } },
      { label: 'Pousser au courant', set: { Bz: 0, u: 250 } }
    ],
    challenges: [
      { id: 'pin1', text: 'Bloque la paroi sur l’entaille 1 avec B > 5 mT', test: function (o) { return o.pinnedAt === 0 && o.B > 5; } },
      { id: 'pin2', text: 'Mesure un champ de décrochage', test: function (o) { return o.depCount >= 1; } },
      { id: 'pin3', text: 'Fais sortir la paroi au bout de la piste', test: function (o) { return o.exited; } },
      { id: 'pin4', text: 'Décroche-la au courant seul, B = 0', test: function (o) { return o.depCurrent; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche le téléphone à droite ou à gauche : tu règles B_z (±100 mT).',
      apply: function (sim, s) { const v = Math.round(s.tilt.x * 200) / 2; if (Math.abs(v - sim.p.Bz) >= 0.5) sim.setB(v); }
    },
    create: function (h, d) { return new PinningSim(h, d); }
  },
  {
    id: 'labyrinthe', name: 'Labyrinthe et bulles',
    params: [
      { id: 'Bz', label: 'Champ B_z', unit: 'mT', min: -400, max: 400, step: 1, value: 0, digits: 0, help: 'Chaque changement relance la relaxation.' },
      { id: 'step', label: 'Pas de champ', unit: 'mT', min: 1, max: 50, step: 1, value: 10, digits: 0 },
      { id: 'auto', type: 'check', label: 'Balayage pas à pas automatique', value: false, help: 'Optionnel : monte d’un pas à chaque équilibre.' },
      { id: 'Bmax', label: 'Champ final du balayage', unit: 'mT', min: 50, max: 400, step: 10, value: 250, digits: 0 },
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 3, step: 0.05, value: 1.9, digits: 2 },
      { id: 'K', label: 'Anisotropie K_u', unit: 'kJ/m³', min: 640, max: 1000, step: 2, value: 778, digits: 0, help: 'Sous 628 kJ/m³ (μ₀Ms²/2), l’aimantation se couche dans le plan.' },
      { id: 'res', type: 'select', label: 'Maillage', value: '64', options: [['64', '64 × 64 : 256 nm, rapide'], ['128', '128 × 128 : 512 nm, lent']] },
      { id: 'drv', type: 'select', label: 'Pilote', value: 'relax', options: [['relax', 'relaxation à chaque champ (MinDriver)'], ['llg', 'dynamique LLG (TimeDriver)']] },
      { id: 'T', label: 'Température (LLG)', unit: 'K', min: 0, max: 300, step: 5, value: 0, digits: 0 },
      { id: 'marks', type: 'check', label: 'Entourer les bulles détectées', value: true },
      { id: 'disp', type: 'select', label: 'Couleurs', value: 'mz', options: [['mz', 'm_z'], ['wheel', 'direction']] }
    ],
    buttons: [{ id: 'demag', label: 'Désaimanter' }, { id: 'sat', label: 'Saturer ↑' }, { id: 'down', label: 'B − pas' }, { id: 'up', label: 'B + pas' }, { id: 'zero', label: 'B = 0' }, { id: 'flash', label: 'Flash laser' }, { id: 'clear', label: 'Effacer les courbes' }],
    whatIf: [
      { label: 'Sans DMI : dipolaire seul', set: { D: 0 }, act: 'demag' },
      { label: 'DMI plus forte', set: { D: 2.6 }, act: 'demag' },
      { label: 'Anisotropie plus forte', set: { K: 900 }, act: 'demag' }
    ],
    challenges: [
      { id: 'lab1', text: 'Fais pousser un labyrinthe', test: function (o) { return o.sawMaze; } },
      { id: 'lab2', text: 'Transforme les bandes en au moins 3 bulles', test: function (o) { return o.sawMaze && o.maxBub >= 3; } },
      { id: 'lab3', text: 'Sature le film : ⟨m_z⟩ > 0,98 après les bulles', test: function (o) { return o.maxBub >= 1 && o.mz > 0.98 && o.B > 0; } }
    ],
    phone: {
      uses: ['tilt', 'flick'], hint: 'Penche le téléphone à droite : le champ monte (0 à 300 mT). Pichenette : flash laser.',
      apply: function (sim, s) {
        const v = Math.round(clamp(s.tilt.x, 0, 1) * 60) * 5;
        if (Math.abs(v - sim.p.Bz) >= 5) sim.setB(v);
        if (flickOnce(sim, s)) sim.action('flash');
      }
    },
    create: function (h, d) { return new LabySim(h, d); }
  }
);

UB.links.sandbox = ['first', 'energy', 'dyn', 'units', 'dmi', 'uniax', 'tdf', 'pbc', 'finiteT', 'svp1', 'apiZeeman'];
UB.links.paroi_pin = ['dwpair', 'svp1', 'svp2', 'dmi', 'apiZL', 'sttdw'];
UB.links.labyrinthe = ['hyst', 'pbc', 'dmi', 'tools', 'apiHD', 'ltem'];

UB.map.sandbox = function (p) {
  const r = [['Ms = ' + p.Ms + ' kA/m', 'norm=' + py(p.Ms * 1e3)], ['A = ' + p.A + ' pJ/m', 'mm.Exchange(A=' + py(p.A * 1e-12) + ')']];
  if (p.Ktype !== 'none') r.push(['K = ' + p.K + ' kJ/m³', p.Ktype === 'uni' ? 'mm.UniaxialAnisotropy(K=' + py(p.K * 1e3) + ', u=' + ubAxis(p.Kaxis) + ')' : 'mm.CubicAnisotropy(K=' + py(p.K * 1e3) + ', …)']);
  if (p.Dtype !== 'none') r.push(['D = ' + p.D + ' mJ/m²', 'mm.DMI(D=' + py(p.D * 1e-3) + ', crystalclass="' + p.Dtype + '")']);
  r.push(['Cellule ' + p.cell + ' nm, épaisseur ' + p.tz + ' nm', 'df.Mesh(..., cell=(' + py(p.cell * 1e-9) + ', ' + py(p.cell * 1e-9) + ', ' + py(p.tz * 1e-9) + '))']);
  r.push(['B statique (mT)', 'mm.Zeeman(H=' + pyVec([p.Bx, p.By, p.Bz].map(function (b) { return b * 1e-3 / MU0; })) + ')']);
  if (p.fun !== 'none') r.push(['h(t) = h·f(t)', p.fun === 'sin' || p.fun === 'sinc' ? 'func="' + p.fun + '", f=' + py(p.f * 1e9) : 'func=f_t, dt=1e-13']);
  r.push(['Pilote', p.drv === 'relax' ? 'oc.MinDriver()' : 'oc.TimeDriver()']);
  r.push(['Impulsion lumineuse', 'pas d’équivalent direct']);
  return r;
};
UB.map.paroi_pin = function (p) {
  return [['Piste 512 × 96 × 1 nm', 'df.Mesh(..., cell=(4e-9, 4e-9, 1e-9))'], ['Entailles ' + p.notch + ' nm', 'norm = fonction de (x, y)'], ['Désordre ' + p.dis + ' %', 'K = df.Field(mesh, nvdim=1, value=...)'], ['Champ B_z', 'system.energy.zeeman.H = (0, 0, B / mu0)'], ['Courant u = ' + p.u + ' m/s', 'mm.ZhangLi(u=' + py(p.u) + ', beta=' + py(p.alpha) + ')']];
};
UB.map.labyrinthe = function (p) {
  return [['Film infini', 'df.Mesh(..., bc="xy")'], ['D = ' + p.D + ' mJ/m²', 'mm.DMI(D=' + py(p.D * 1e-3) + ', crystalclass="Cnv_z")'], ['K_u = ' + p.K + ' kJ/m³', 'mm.UniaxialAnisotropy(K=' + py(p.K * 1e3) + ', u=(0, 0, 1))'], ['Démagnétisant', 'mm.Demag()'], ['Balayage par pas de ' + p.step + ' mT', 'boucle + oc.MinDriver()'], ['Nombre de bulles', 'df.tools.topological_charge(...)']];
};

UB.cells.sandbox = function (p) {
  const c = ubSandboxPy(p);
  return [
    { md: '# Bac à sable\nMême système que dans Aimantarium : matériau, géométrie, champ H(t) en 3D.' },
    { py: UB_HEAD },
    { py: c[0] },
    { py: c[1] },
    { md: 'L’impulsion lumineuse n’existe pas dans Ubermag. Pour l’imiter : découpe le temps en tranches et diminue Ms, A et K dans une sous-région chauffée (paramètres variables dans l’espace).' }
  ];
};

UB.cells.paroi_pin = function (p) {
  const dis = p.dis > 0;
  let s = 'Lx, Ly, t = 512e-9, 96e-9, 1e-9\nMs, A, Ku = 5.8e5, 1.5e-11, 4.5e5\nnotch = ' + py(p.notch * 1e-9) + '\ncentres = [160e-9, 288e-9, 416e-9]\n\n';
  s += 'region = df.Region(p1=(0, 0, 0), p2=(Lx, Ly, t))\nmesh = df.Mesh(region=region, cell=(4e-9, 4e-9, 1e-9))\n\n';
  s += 'def norm(point):\n    x, y, z = point\n    for xc in centres:\n        depth = notch - abs(x - xc)\n        if depth > 0 and (y < depth or y > Ly - depth):\n            return 0\n    return Ms\n\n';
  s += 'def m_init(point):\n    x, y, z = point\n    return (0, 0, 1) if x < 64e-9 else (0, 0, -1)\n\n';
  if (dis) s += 'rng = np.random.default_rng(7)\nK = df.Field(mesh, nvdim=1, value=lambda point: Ku * max(0.05, 1 + ' + py(p.dis / 100) + ' * rng.standard_normal()))\n\n';
  s += 'system = mm.System(name="paroi_pinning"' + (p.T > 0 ? ', T=' + py(p.T) : '') + ')\nsystem.energy = (\n    mm.Exchange(A=A)\n    + mm.DMI(D=' + py(p.D * 1e-3) + ', crystalclass="Cnv_z")\n    + mm.UniaxialAnisotropy(K=' + (dis ? 'K' : 'Ku') + ', u=(0, 0, 1))\n    + mm.Demag()\n    + mm.Zeeman(H=(0, 0, 0))\n)\n';
  s += 'system.dynamics = mm.Precession(gamma0=mm.consts.gamma0) + mm.Damping(alpha=' + py(p.alpha) + ')' + (p.u ? ' + mm.ZhangLi(u=' + py(p.u) + ', beta=' + py(p.alpha) + ')' : '') + '\nsystem.m = df.Field(mesh, nvdim=3, value=m_init, norm=norm, valid="norm")\noc.MinDriver().drive(system)';
  const d = 'td = oc.TimeDriver()\nB_list, x_list = [], []\nfor B in np.arange(0, 0.1, 2e-3):\n    system.energy.zeeman.H = (0, 0, B / mm.consts.mu0)\n    td.drive(system, t=0.5e-9, n=5)\n    x_w = Lx * (1 + system.m.z.mean() / Ms) / 2\n    B_list.append(B * 1e3)\n    x_list.append(x_w * 1e9)\n\nplt.plot(B_list, x_list, "o-")\nplt.xlabel("B (mT)")\nplt.ylabel("position de la paroi (nm)")\nplt.show()';
  return [{ md: '# Paroi et ancrage\nPiste Co/Pt avec entailles. On monte B par pas et on suit la paroi.' }, { py: UB_HEAD }, { py: s }, { py: d }];
};

UB.cells.labyrinthe = function (p) {
  const n = parseInt(p.res, 10) || 64, L = n * 4;
  let s = 'L = ' + py(L * 1e-9) + '\nMs = 1e6\nregion = df.Region(p1=(0, 0, 0), p2=(L, L, 1e-9))\nmesh = df.Mesh(region=region, cell=(4e-9, 4e-9, 1e-9), bc="xy")\n\n';
  s += 'system = mm.System(name="labyrinthe")\nsystem.energy = (\n    mm.Exchange(A=1e-11)\n    + mm.DMI(D=' + py(p.D * 1e-3) + ', crystalclass="Cnv_z")\n    + mm.UniaxialAnisotropy(K=' + py(p.K * 1e3) + ', u=(0, 0, 1))\n    + mm.Demag()\n    + mm.Zeeman(H=(0, 0, 0))\n)\n';
  s += 'rng = np.random.default_rng(3)\nsystem.m = df.Field(mesh, nvdim=3, value=lambda point: 2 * rng.random(3) - 1, norm=Ms)\nmd = oc.MinDriver()\nmd.drive(system)\nsystem.m.z.sel("z").mpl()';
  const d = 'champs, mz, Q = [], [], []\nfor B in np.arange(0, ' + py(p.Bmax * 1e-3) + ' + 1e-9, ' + py(p.step * 1e-3) + '):\n    system.energy.zeeman.H = (0, 0, B / mm.consts.mu0)\n    md.drive(system)\n    champs.append(B * 1e3)\n    mz.append(system.m.z.mean() / Ms)\n    Q.append(df.tools.topological_charge(system.m.sel("z")))\n\nplt.plot(champs, mz, "o-")\nplt.xlabel("B (mT)")\nplt.ylabel("<m_z>")\nplt.show()\nsystem.m.z.sel("z").mpl()';
  return [{ md: '# Du labyrinthe aux bulles\nFilm infini, DMI interfaciale. On part d’un état désaimanté, puis on monte B_z en relaxant à chaque pas.' }, { py: UB_HEAD }, { py: s }, { py: d }];
};

// ===== catalogue/parcours.js =====
const GRANDEURS = {
  B: { sym: 'B', name: 'Champ magnétique', unit: 'mT', role: 'Il tire sur l’aimantation : il la fait tourner, basculer, et pousse les parois.' },
  m: { sym: 'm', name: 'Aimantation', unit: 'sans unité', role: 'La direction où pointent ensemble les minuscules aimants (les spins) d’une petite région.' },
  A: { sym: 'A', name: 'Échange', unit: 'pJ/m', role: 'Chaque spin veut pointer comme ses voisins : les changements de direction se font en douceur.' },
  K: { sym: 'K', name: 'Anisotropie', unit: 'kJ/m³', role: 'Le matériau préfère un axe (ici vertical) : les spins aiment pointer ↑ ou ↓, pas de travers.' },
  alpha: { sym: 'α', name: 'Frottement', unit: 'sans unité', role: 'Il freine la rotation de l’aimantation et finit par l’aligner sur le champ.' },
  def: { sym: 'ΔK', name: 'Défauts', unit: '', role: 'Entailles, grains irréguliers : des creux d’énergie qui retiennent les parois.' },
  D: { sym: 'D', name: 'Interaction DMI', unit: 'mJ/m²', role: 'Elle favorise une rotation dans un sens précis : bandes, bulles, tourbillons.' },
  T: { sym: 'T', name: 'Température', unit: 'K', role: 'L’agitation retourne des spins au hasard. Au-dessus de T_C, plus d’aimantation d’ensemble.' }
};

const PARCOURS = [
  {
    id: 'limaille', short: 'Voir l’invisible', title: 'Le champ autour d’un aimant', level: 'Chapitre 1 · aucune notion requise', icon: '🧲',
    summary: 'De la limaille et des boussoles pour dessiner le champ invisible d’un aimant.',
    steps: [
      {
        name: 'Ce que dessine la limaille',
        intro: 'Un aimant agit à distance, même à travers l’air. Les grains de fer de la limaille s’orientent sous son action. Le bout rouge de l’aimant est son pôle nord (N), le bout bleu son pôle sud (S).',
        do: [
          { txt: 'Attrape l’aimant par le milieu et déplace-le dans l’image.', canvas: true },
          { txt: 'Appuie sur « Retourner l’aimant ». Regarde bien la limaille avant et après.', actions: [{ label: 'Retourner l’aimant', act: 'flip' }] }
        ],
        canvas: true,
        notice: 'Quand tu as retourné l’aimant, qu’est-ce qui a changé dans le dessin de la limaille ?',
        choices: [
          { t: 'Rien : les traits forment le même dessin qu’avant.', ok: true, fb: 'Exact, et c’est surprenant ! La limaille montre la direction du champ (la ligne), pas son sens (la flèche).' },
          { t: 'Tous les traits ont fait un demi-tour.', ok: false, fb: 'Regarde encore : un trait de limaille n’a pas de pointe. Retourné, il est identique.' },
          { t: 'La limaille s’est rassemblée au milieu de l’aimant.', ok: false, fb: 'Regarde encore : la limaille se concentre près des deux bouts, pas au milieu.' }
        ],
        explain: 'En chaque point, le champ magnétique a une direction et un sens, comme une flèche. Retourner l’aimant inverse le sens partout, mais garde les mêmes directions : la limaille ne voit pas la différence. Pour voir le sens, il faut des boussoles.',
        qty: ['B'],
        limit: 'Les aimants sont représentés par deux pôles idéalisés dans un plan, pas par le calcul complet d’un aimant 3D.',
        sources: ['openfields', 'hubert']
      },
      {
        name: 'Le sens du champ : les boussoles',
        intro: 'Une boussole est une petite aiguille aimantée, libre de tourner. Sa pointe rouge (son nord) se tourne dans le sens du champ, là où elle se trouve.',
        do: [
          { txt: 'Appuie sur « Afficher des boussoles ».', actions: [{ label: 'Afficher des boussoles', set: { scene: 'bar', disp: 'compass' } }] },
          { txt: 'Regarde les boussoles près du bout rouge, puis près du bout bleu.', actions: [{ label: 'C’est regardé' }] },
          { txt: 'Retourne l’aimant et regarde de nouveau les boussoles.', actions: [{ label: 'Retourner l’aimant', act: 'flip' }] }
        ],
        notice: 'Près des deux bouts de l’aimant, dans quel sens pointent les pointes rouges des boussoles ?',
        choices: [
          { t: 'Elles s’éloignent du bout rouge (N) et se tournent vers le bout bleu (S).', ok: true, fb: 'Oui. Et après le retournement, toutes les aiguilles ont fait demi-tour.' },
          { t: 'Elles pointent toutes vers le haut de l’écran.', ok: false, fb: 'Regarde encore : chaque aiguille a sa propre direction, elle dépend de l’endroit.' },
          { t: 'Elles pointent toutes vers le centre de l’aimant.', ok: false, fb: 'Regarde encore près du bout rouge : les aiguilles s’en écartent.' }
        ],
        explain: 'Hors de l’aimant, le champ sort du pôle nord et rentre par le pôle sud. On dessine des lignes de champ qui suivent ces aiguilles de proche en proche. Leur sens est une convention : celui où pointe le nord d’une boussole.',
        qty: ['B'],
        limit: 'Les lignes et les boussoles sont dessinées dans une coupe 2D. La densité des lignes est un choix de dessin, pas une mesure en teslas.',
        sources: ['openfields', 'hubert']
      },
      {
        name: 'Deux aimants face à face',
        intro: 'Les champs de deux aimants s’ajoutent. Sur Android, le téléphone vibre quand deux faces opposées (N et S) se rapprochent. L’iPhone, lui, ne permet pas de vibrer depuis une page web.',
        do: [
          { txt: 'Appuie sur « Nord face au sud », puis rapproche les deux aimants avec le doigt.', actions: [{ label: 'Nord face au sud', set: { scene: 'attract', disp: 'filings' } }], canvas: true },
          { txt: 'Appuie sur « Nord face au nord ». Regarde la limaille au milieu.', actions: [{ label: 'Nord face au nord', set: { scene: 'repel', disp: 'filings' } }] }
        ],
        canvas: true,
        notice: 'Avec deux pôles nord face à face, que fait la limaille au milieu ?',
        choices: [
          { t: 'Elle part sur les côtés, et au centre les traits sont désordonnés.', ok: true, fb: 'Oui. Au centre, les deux champs s’opposent et s’annulent presque : c’est un point neutre.' },
          { t: 'Elle forme un pont tout droit d’un aimant à l’autre.', ok: false, fb: 'Ça, c’est le cas nord face au sud. Reviens à « Nord face au nord » et compare.' },
          { t: 'C’est exactement le même dessin que nord face au sud.', ok: false, fb: 'Compare les deux boutons : au milieu, le dessin change beaucoup.' }
        ],
        explain: 'Nord face au sud : les lignes passent d’un aimant à l’autre, les aimants s’attirent. Nord face au nord : les lignes se repoussent, un point neutre apparaît entre eux, les aimants se repoussent. Le champ total est la somme des deux champs.',
        qty: ['B'],
        limit: 'La force réelle entre deux aimants dépend de leur forme 3D et de leur matériau. Ici, on ne dessine que le champ.',
        sources: ['openfields', 'hubert']
      }
    ]
  },
  {
    id: 'wall', short: 'Domaines et parois', title: 'À l’intérieur d’un aimant : domaines et paroi', level: 'Chapitre 2 · aimantation, échange, anisotropie', icon: '↕️',
    summary: 'Descends à l’échelle du nanomètre : des zones aimantées, et la frontière qui les sépare.',
    steps: [
      {
        name: 'C’est quoi, un domaine ?',
        intro: 'Zoomons dans un aimant. Chaque électron se comporte comme un minuscule aimant : son spin. Une région où les spins pointent tous dans le même sens s’appelle un domaine. Ici, un ruban de 480 nm, environ 150 fois plus fin qu’un cheveu. En haut, vu de dessus : rouge = aimantation vers le haut (↑), bleu = vers le bas (↓). En bas, vu de côté : une flèche par petit groupe de spins.',
        do: [
          { txt: 'Appuie sur « Champ nul » pour que rien ne bouge.', actions: [{ label: 'Champ nul', set: { Bz: 0, A: 15, K: 500 }, act: 'reset' }] },
          { txt: 'Repère les zones de couleur dans la bande du haut.', actions: [{ label: 'C’est repéré' }] }
        ],
        notice: 'Combien de domaines vois-tu ?',
        choices: [
          { t: 'Deux : un rouge (↑) à gauche, un bleu (↓) à droite.', ok: true, fb: 'Oui. La petite zone blanche entre les deux est leur frontière.' },
          { t: 'Un seul, tout rouge.', ok: false, fb: 'Regarde toute la bande : la droite est bleue.' },
          { t: 'Des dizaines de petites zones.', ok: false, fb: 'Regarde encore : il n’y a que deux grandes zones.' }
        ],
        explain: 'Chaque couleur est un domaine : dans le rouge, l’aimantation pointe vers le haut, dans le bleu vers le bas. Un domaine contient des milliards de spins qui pointent ensemble. La frontière entre deux domaines s’appelle une paroi.',
        qty: ['m'],
        limit: 'Le ruban est modélisé en 1D (une ligne de cellules de 3 nm). Rouge et bleu sont des couleurs de dessin, pas la couleur du métal.',
        sources: ['hubert', 'nistdw']
      },
      {
        name: 'La paroi : un virage en douceur',
        intro: 'Regarde les flèches du bas, au niveau de la paroi. Elles ne passent pas d’un coup de ↑ à ↓ : chacune est un peu plus penchée que sa voisine. Deux grandeurs règlent la longueur de ce virage.',
        do: [
          { txt: 'Appuie sur « Échange fort » (A = 30). Compte à peu près les flèches penchées.', actions: [{ label: 'Échange fort', set: { A: 30, K: 500, Bz: 0 }, act: 'reset' }] },
          { txt: 'Puis sur « Échange faible » (A = 8). Compare.', actions: [{ label: 'Échange faible', set: { A: 8, K: 500, Bz: 0 }, act: 'reset' }] },
          { txt: 'Garde A et fais glisser le curseur de l’anisotropie K vers la droite.', focus: 'K' }
        ],
        focus: 'K',
        notice: 'Qu’est-ce qui a rendu la paroi plus large ?',
        choices: [
          { t: 'Un échange A plus fort.', ok: true, fb: 'Oui. Et une anisotropie K plus forte l’a rendue plus étroite.' },
          { t: 'Une anisotropie K plus forte.', ok: false, fb: 'Regarde la largeur affichée sous le panneau : quand K monte, elle diminue.' },
          { t: 'Rien : la paroi garde toujours la même largeur.', ok: false, fb: 'Regarde la largeur affichée : elle change avec A et avec K.' }
        ],
        explain: 'L’échange A oblige chaque spin à rester presque parallèle à ses voisins. Un retournement brutal coûterait beaucoup d’énergie d’échange : le virage s’étale. L’anisotropie K, elle, favorise l’orientation suivant un axe, ici vertical : les spins veulent être ↑ ou ↓. Dans la paroi, ils sont de travers, ce que K pénalise : la paroi se resserre. Le compromis donne une largeur d’environ √(A/K), quelques nanomètres.',
        qty: ['A', 'K'],
        limit: 'Δ = √(A/K) est l’estimation d’une paroi 1D idéale. Une vraie paroi dépend aussi de la forme de l’échantillon et du champ démagnétisant.',
        sources: ['nistdw', 'hubert']
      },
      {
        name: 'Pousser la paroi avec un champ',
        intro: 'On applique un champ B perpendiculaire au ruban. B > 0 pointe vers le haut, comme le rouge. Il favorise les spins qui pointent dans son sens.',
        do: [
          { txt: 'Appuie sur « Champ +40 mT » et suis la paroi (trait pointillé doré).', actions: [{ label: 'Champ +40 mT', set: { Bz: 40, A: 15, K: 500 }, act: 'reset' }] },
          { txt: 'Puis sur « Champ −40 mT ».', actions: [{ label: 'Champ −40 mT', set: { Bz: -40, A: 15, K: 500 }, act: 'reset' }] }
        ],
        focus: 'Bz',
        notice: 'Avec +40 mT, qu’a fait la paroi ?',
        choices: [
          { t: 'Elle a glissé vers la droite : le domaine rouge a grandi.', ok: true, fb: 'Oui. Et avec −40 mT, elle repart vers la gauche : le bleu grandit.' },
          { t: 'Elle a glissé vers la gauche : le domaine bleu a grandi.', ok: false, fb: 'Refais « Champ +40 mT » : c’est le rouge, aligné avec le champ, qui gagne.' },
          { t: 'Elle n’a pas bougé.', ok: false, fb: 'Refais l’essai et regarde le trait doré quelques secondes.' }
        ],
        explain: 'Un spin aligné avec le champ a une énergie plus basse. Le domaine aligné avec B grandit donc en repoussant la paroi. Plus le champ est fort, plus la paroi va vite : des dizaines de mètres par seconde, sur des nanomètres.',
        qty: ['B'],
        limit: 'Chaîne 1D sans défaut et sans température : une vraie paroi est freinée par les défauts du matériau (chapitre 4).',
        sources: ['walker', 'nistdw']
      }
    ]
  },
  {
    id: 'compass', short: 'Comment l’aimantation bouge', title: 'Une toupie magnétique', level: 'Chapitre 3 · précession et frottement', icon: '🌀',
    summary: 'Un aimant ne s’aligne pas tout de suite : il tourne d’abord autour du champ, comme une toupie.',
    steps: [
      {
        name: 'Un aimant qui tourne',
        intro: 'Voici un seul tout petit aimant, vu en 3D. La flèche blanche montre où il pointe, la flèche jaune montre le champ B. La boule représente toutes les directions possibles.',
        do: [
          { txt: 'Appuie sur « Recommencer » et suis la pointe de la flèche blanche.', actions: [{ label: 'Recommencer', set: { alpha: 0.1, B: 100 }, act: 'reset' }] },
          { txt: 'Fais tourner la boule avec le doigt pour la regarder d’en haut.', canvas: true }
        ],
        canvas: true,
        notice: 'Comment la flèche blanche rejoint-elle la flèche jaune ?',
        choices: [
          { t: 'En tournant autour d’elle, en spirale.', ok: true, fb: 'Oui, comme une toupie penchée qui tourne autour de la verticale.' },
          { t: 'Tout droit, comme une aiguille qui tombe.', ok: false, fb: 'Regarde la trace colorée : elle dessine une spirale.' },
          { t: 'Elle s’en éloigne.', ok: false, fb: 'Attends un peu : la spirale se resserre vers la flèche jaune.' }
        ],
        explain: 'Le champ ne tire pas l’aimantation tout droit : il la fait tourner autour de lui. C’est la précession. Elle est très rapide : environ 28 milliards de tours par seconde pour un champ de 1 tesla.',
        qty: ['B', 'm'],
        limit: 'Un seul aimant uniforme (macrospin) : dans un vrai matériau, chaque région précesse en interagissant avec ses voisines.',
        sources: ['gilbert', 'ubdyn']
      },
      {
        name: 'Le frottement α',
        intro: 'Si rien ne la freinait, la rotation ne s’arrêterait jamais. Ce qui la freine s’appelle le frottement, ou amortissement, noté α.',
        do: [
          { txt: 'Appuie sur « Sans frottement » (α = 0).', actions: [{ label: 'Sans frottement', set: { alpha: 0 }, act: 'kick' }] },
          { txt: 'Puis sur « Frottement fort » (α = 1).', actions: [{ label: 'Frottement fort', set: { alpha: 1 }, act: 'kick' }] }
        ],
        focus: 'alpha',
        notice: 'Sans frottement, que fait la flèche blanche ?',
        choices: [
          { t: 'Elle tourne sans fin autour du champ.', ok: true, fb: 'Oui. Avec α = 1, au contraire, elle file presque droit vers le champ.' },
          { t: 'Elle s’aligne tout de suite.', ok: false, fb: 'Refais « Sans frottement » : la spirale ne se resserre plus.' },
          { t: 'Elle s’arrête au hasard.', ok: false, fb: 'Regarde quelques secondes : elle continue de tourner.' }
        ],
        explain: 'α mesure les pertes d’énergie de l’aimantation, vers le réseau d’atomes. Grand α : alignement rapide. Petit α : longue rotation. Ce frottement compte pour écrire vite une mémoire, ou pour faire voyager des ondes magnétiques loin.',
        qty: ['alpha'],
        limit: 'α est ici une constante. Dans un vrai matériau, il dépend de la composition et des interfaces.',
        sources: ['gilbert']
      }
    ]
  },
  {
    id: 'paroi_pin', short: 'Défauts et ancrage', title: 'Pourquoi une paroi s’arrête', level: 'Chapitre 4 · défauts', icon: '🧱',
    summary: 'Une piste lisse, puis des entailles, puis des grains : ce qui retient une paroi.',
    steps: [
      {
        name: 'Une piste lisse',
        intro: 'Une piste magnétique vue de dessus. Rouge : aimantation vers toi (↑). Bleu : vers le fond (↓). Le trait doré est la paroi entre les deux domaines.',
        do: [
          { txt: 'Appuie sur « Piste lisse · +20 mT ».', actions: [{ label: 'Piste lisse · +20 mT', set: { notch: 0, dis: 0, Bz: 20, T: 0, u: 0 }, act: 'reset' }] },
          { txt: 'Observe le trait doré une dizaine de secondes.', actions: [{ label: 'C’est observé' }] }
        ],
        notice: 'Sur cette piste sans défaut, avec 20 mT, que fait la paroi ?',
        choices: [
          { t: 'Elle avance régulièrement vers la droite.', ok: function (s) { return s.xw > 80e-9 || s.exited; }, fb: 'C’est bien ce qu’a calculé la simulation.' },
          { t: 'Elle reste bloquée au départ.', ok: function (s) { return s.xw <= 80e-9 && !s.exited; }, fb: '' },
          { t: 'Elle recule vers la gauche.', ok: false, fb: '' }
        ],
        explain: 'Le champ favorise le domaine rouge, qui pousse la paroi. Sans obstacle, rien ne la retient : même un petit champ la fait avancer.',
        qty: ['B'],
        limit: 'Couche 2D très mince, anisotropie effective, sans température ici.',
        sources: ['walker', 'metaxas']
      },
      {
        name: 'Des entailles dans la piste',
        intro: 'Une entaille est un petit creux sur le bord de la piste. Ce sont les zones vides numérotées 1, 2, 3 sur l’image. C’est un premier type de défaut.',
        do: [
          { txt: 'Appuie sur « Entailles · +20 mT » et attends que la paroi arrive à l’entaille 1.', actions: [{ label: 'Entailles · +20 mT', set: { notch: 24, dis: 0, Bz: 20, T: 0, u: 0 }, act: 'reset' }] },
          { txt: 'Monte doucement le champ avec le curseur.', focus: 'Bz' }
        ],
        focus: 'Bz',
        notice: 'Qu’a fait la paroi à l’entaille 1 ?',
        choices: [
          { t: 'Elle s’y est arrêtée, puis elle est repartie quand le champ a monté.', ok: function (s) { return typeof s.dep[0] === 'number'; }, fb: 'C’est bien ce qu’a calculé la simulation. Le champ de décrochage s’affiche dans les mesures.' },
          { t: 'Elle y est encore bloquée.', ok: function (s) { return s.dep[0] === null && s.pinnedAt === 0; }, fb: 'C’est bien ce qu’a calculé la simulation. Monte encore le champ pour la décrocher.' },
          { t: 'Elle l’a traversée sans s’arrêter.', ok: function (s) { return s.dep[0] === 'libre'; }, fb: 'C’est bien ce qu’a calculé la simulation : à 20 mT, cette entaille ne suffit pas. Essaie un champ plus faible.' }
        ],
        explain: 'Dans l’entaille, la piste est plus étroite : la paroi y est plus courte, donc elle coûte moins d’énergie. Elle y tombe comme une bille dans un creux. Pour l’en sortir, il faut un champ plus fort : le champ de décrochage.',
        qty: ['def'],
        limit: 'Le champ de décrochage dépend de la forme de l’entaille et du matériau. Ce n’est pas une valeur universelle.',
        sources: ['gao', 'hayashi']
      },
      {
        name: 'Le désordre d’un vrai film',
        intro: 'Un vrai film magnétique est fait de grains de quelques nanomètres. D’un grain à l’autre, l’anisotropie K change un peu. Les traits fins sur l’image dessinent ces grains. Les grains teintés en jaune sont plus « mous » que les autres.',
        do: [
          { txt: 'Appuie sur « Grains irréguliers · +20 mT ».', actions: [{ label: 'Grains irréguliers · +20 mT', set: { notch: 0, dis: 25, Bz: 20, T: 0, u: 0 }, act: 'newdis' }] },
          { txt: 'Monte le champ par petits pas, en regardant la forme du trait doré.', focus: 'Bz' }
        ],
        focus: 'Bz',
        notice: 'Comment la paroi avance-t-elle maintenant ?',
        choices: [
          { t: 'De façon irrégulière : elle se tord, s’arrête, puis repart.', ok: true, fb: 'Oui. Chaque grain la retient plus ou moins.' },
          { t: 'Bien droite, toujours à la même vitesse.', ok: false, fb: 'Regarde la forme de la paroi : elle n’est plus droite.' },
          { t: 'Elle ne bouge jamais, quel que soit le champ.', ok: false, fb: 'Monte encore le champ : au-delà d’un seuil, elle repart.' }
        ],
        explain: 'Chaque grain retient un bout de paroi, plus ou moins fort. La paroi se tord et avance par sauts. C’est ce qu’on voit au microscope dans les films de cobalt-platine (Metaxas 2007). Avec de la température, elle peut même avancer lentement sous le seuil.',
        qty: ['def', 'K'],
        limit: 'Les grains sont tirés au hasard : ce n’est pas la microstructure mesurée d’un échantillon réel.',
        sources: ['metaxas', 'gao']
      }
    ]
  },
  {
    id: 'labyrinthe', short: 'Labyrinthes et bulles', title: 'Des bandes qui deviennent des bulles', level: 'Chapitre 5 · interaction DMI', icon: '🫧',
    summary: 'Un film forme tout seul un labyrinthe. Monte le champ : les bandes se coupent en bulles.',
    steps: [
      {
        name: 'Un motif qui apparaît tout seul',
        intro: 'Voici un film magnétique de 256 nm de côté, vu de dessus. Rouge : l’aimantation sort de l’écran, vers toi. Bleu : elle rentre dans l’écran. On part d’un désordre complet.',
        do: [
          { txt: 'Appuie sur « Désordre complet ».', actions: [{ label: 'Désordre complet', set: { Bz: 0, auto: false, D: 1.9 }, act: 'demag' }] },
          { txt: 'Attends que le motif ne change presque plus.', actions: [{ label: 'Le motif est stable' }] }
        ],
        notice: 'Quel motif s’est formé ?',
        choices: [
          { t: 'Des bandes sinueuses rouges et bleues, comme un labyrinthe.', ok: function (s) { return s.phase === 'labyrinthe' || s.phase === 'bandes + bulles'; }, fb: 'C’est bien ce qu’a calculé la simulation.' },
          { t: 'Des ronds bleus isolés.', ok: function (s) { return s.phase === 'bulles'; }, fb: 'C’est bien ce qu’a calculé la simulation.' },
          { t: 'Une seule couleur partout.', ok: function (s) { return s.phase === 'saturé'; }, fb: 'C’est bien ce qu’a calculé la simulation.' }
        ],
        explain: 'Trois effets se disputent. L’anisotropie K veut ↑ ou ↓. L’échange A veut des voisins pareils. L’interaction DMI, notée D, favorise une rotation dans un sens précis. Quand D est assez fort, tourner en bandes coûte moins cher que rester uniforme. La largeur des bandes est réglée par le rapport A/D.',
        qty: ['D'],
        limit: 'Le motif dépend des réglages et du hasard de départ : il n’est pas garanti pour toutes les valeurs.',
        sources: ['jagla', 'moreau']
      },
      {
        name: 'Monter le champ',
        intro: 'Le champ B pointe maintenant vers toi (symbole ⊙), dans le même sens que le rouge. Il favorise donc le rouge.',
        do: [
          { txt: 'Appuie trois fois sur « +10 mT », en attendant que le motif se calme entre deux appuis.', actions: [{ label: '+10 mT', act: 'up' }], times: 3 },
          { txt: 'Continue jusqu’à environ 100 mT avec le curseur.', focus: 'Bz' }
        ],
        focus: 'Bz',
        notice: 'Que sont devenues les zones bleues ?',
        choices: [
          { t: 'Elles ont maigri, se sont coupées, et certaines sont devenues des ronds.', ok: function (s) { return s.maxBub >= 1; }, fb: 'C’est bien ce qu’a calculé la simulation : ces ronds sont des bulles magnétiques.' },
          { t: 'Elles ont maigri, mais sont restées des bandes.', ok: function (s) { return s.maxBub === 0; }, fb: 'C’est bien ce qu’a calculé la simulation. Monte encore un peu le champ.' },
          { t: 'Elles ont grossi et envahi le film.', ok: function (s) { return s.mz < -0.2; }, fb: '' }
        ],
        explain: 'Le champ rend le bleu plus coûteux : les domaines bleus rétrécissent. Une bande trop fine se coupe, et les morceaux se referment en ronds : des bulles magnétiques. Leur taille dépend de B et de D.',
        qty: ['B', 'D'],
        limit: 'Une bulle n’est pas forcément un skyrmion : il faut regarder sa structure interne et sa charge topologique Q.',
        sources: ['jagla', 'rohart']
      },
      {
        name: 'Jusqu’à tout effacer',
        intro: 'Continuons à monter le champ.',
        do: [
          { txt: 'Appuie sur « Champ fort : 250 mT ».', actions: [{ label: 'Champ fort : 250 mT', set: { Bz: 250 } }] },
          { txt: 'Attends que le motif ne change presque plus.', actions: [{ label: 'Le motif est stable' }] }
        ],
        notice: 'À 250 mT, que reste-t-il ?',
        choices: [
          { t: 'Presque tout est rouge : les bulles ont disparu.', ok: function (s) { return s.mz > 0.97; }, fb: 'C’est bien ce qu’a calculé la simulation.' },
          { t: 'Quelques bulles résistent encore.', ok: function (s) { return s.mz <= 0.97 && s.stat && s.stat.nBub > 0; }, fb: 'C’est bien ce qu’a calculé la simulation. Ces bulles sont protégées par une barrière d’énergie.' },
          { t: 'Le labyrinthe est revenu.', ok: function (s) { return s.phase === 'labyrinthe'; }, fb: '' }
        ],
        explain: 'Assez fort, le champ gagne : l’état uniforme rouge devient le plus stable. Une bulle peut résister un moment : défaire son tourbillon demande de franchir une barrière d’énergie. Pour recommencer, appuie sur « Désaimanter » dans les réglages.',
        qty: ['B'],
        limit: 'Il faut laisser le calcul relaxer : un curseur déplacé ne donne pas tout de suite l’état d’équilibre.',
        sources: ['jagla', 'moreau']
      }
    ]
  },
  {
    id: 'curie', short: 'La chaleur désordonne', title: 'Chauffer un aimant', level: 'Chapitre 6 · température', icon: '🌡️',
    summary: 'Chauffe, refroidis, et regarde l’ordre magnétique disparaître puis revenir.',
    steps: [
      {
        name: 'Chauffer doucement',
        intro: 'Chaque case est un petit aimant, un spin : rouge vers le haut, bleu vers le bas. Les voisins aiment pointer pareil. La température les agite au hasard. Ici, elle est en unités réduites : T* ≈ 2,27 est la température critique.',
        do: [
          { txt: 'Appuie sur « Tout aligner, froid » (T* = 1).', actions: [{ label: 'Tout aligner, froid', set: { T: 1, h: 0 }, act: 'up' }] },
          { txt: 'Fais monter doucement la température avec le curseur, jusqu’à 3,5. Regarde la valeur |M| affichée.', focus: 'T', until: function (s) { return s.p.T >= 3; } }
        ],
        focus: 'T',
        notice: 'En chauffant, qu’est-il arrivé ?',
        choices: [
          { t: 'Vers T* ≈ 2,3, l’ordre s’est effondré : rouge et bleu mélangés, |M| proche de 0.', ok: function (s) { return s.p.T > 2.4 && s.obs.A < 0.35; }, fb: 'C’est bien ce qu’a calculé la simulation.' },
          { t: 'Rien : tout est resté rouge.', ok: function (s) { return s.obs.A > 0.8; }, fb: 'C’est bien ce qu’a calculé la simulation. Monte encore la température.' },
          { t: 'Tout est devenu bleu.', ok: false, fb: '' }
        ],
        explain: 'L’agitation retourne des spins au hasard. Tant qu’elle est faible, l’accord entre voisins l’emporte. Au-delà d’une température critique, la température de Curie T_C, l’aimantation d’ensemble disparaît. Pour le fer, T_C ≈ 770 °C.',
        qty: ['T'],
        limit: 'Modèle d’Ising 2D : des spins à deux états sur une grille. Ce n’est pas un calcul quantitatif du fer.',
        sources: ['onsager', 'metropolis']
      },
      {
        name: 'Refroidir : lentement ou d’un coup',
        intro: 'Maintenant, on refroidit. Deux façons : lentement, ou d’un coup (une trempe).',
        do: [
          { txt: 'Appuie sur « Refroidir lentement » et attends la fin.', actions: [{ label: 'Refroidir lentement', act: 'anneal' }] },
          { txt: 'Puis sur « Désordre + trempe brutale ».', actions: [{ label: 'Désordre + trempe brutale', act: 'quench' }] }
        ],
        notice: 'Juste après la trempe brutale, à quoi ressemble l’aimant ?',
        choices: [
          { t: 'Des zones rouges et des zones bleues : des domaines.', ok: function (s) { return s.obs.A < 0.9; }, fb: 'C’est bien ce qu’a calculé la simulation.' },
          { t: 'Tout d’une seule couleur, comme après le refroidissement lent.', ok: function (s) { return s.obs.A >= 0.9; }, fb: 'C’est bien ce qu’a calculé la simulation.' }
        ],
        explain: 'En refroidissant, l’ordre revient, mais région par région : chacune choisit son camp. Lentement, tout le monde a le temps de s’accorder. D’un coup, il reste des domaines. La chaleur affaiblit aussi la préférence d’axe K. Les disques durs récents s’en servent pour écrire (voir l’Application).',
        qty: ['T'],
        limit: 'Le temps de calcul n’est pas un temps réel : on compare seulement des vitesses de refroidissement.',
        sources: ['onsager', 'metropolis']
      }
    ]
  },
  {
    id: 'disk', app: true, short: 'Le disque dur', title: 'Écrire, garder, chauffer', level: 'Application', icon: '💾',
    summary: 'Le défi des ingénieurs : des bits plus petits qui n’oublient pas.',
    steps: [
      {
        name: 'Des grains trop petits oublient',
        intro: 'Ton mot est écrit en 96 bits, de 5 grains chacun. Le temps est accéléré : 1 s ici = 1 an. Le petit dessin montre la barrière d’énergie d’un grain.',
        do: [
          { txt: 'Appuie sur « Écrire BONJOUR, grains de 9 nm ». Attends quelques « années ».', actions: [{ label: 'Écrire BONJOUR, grains de 9 nm', set: { word: 'BONJOUR', mat: 'hdd', d: 9, T: 25, clock: 'year', laser: false }, act: 'write' }] },
          { txt: 'Puis « Réécrire avec des grains de 4 nm ». Attends encore.', actions: [{ label: 'Réécrire avec des grains de 4 nm', set: { d: 4 }, act: 'write' }] }
        ],
        barrier: true,
        notice: 'Avec des grains de 4 nm, que devient le mot ?',
        choices: [
          { t: 'Il s’abîme : des lettres changent toutes seules.', ok: function (s) { return s.correct < 96; }, fb: 'C’est bien ce qu’a calculé la simulation.' },
          { t: 'Il reste intact, comme avec 9 nm.', ok: function (s) { return s.correct === 96; }, fb: 'C’est bien ce qu’a calculé la simulation.' }
        ],
        explain: 'Pour qu’un grain se retourne, il doit franchir une barrière d’énergie K·V : K est l’anisotropie, V le volume du grain. L’agitation thermique donne des coups d’énergie de l’ordre de k_BT. Un grain plus petit a une barrière plus basse : la chaleur finit par la franchir. Pour garder un bit dix ans, il faut K·V environ 40 à 60 fois plus grand que k_BT.',
        qty: ['K', 'T'],
        limit: 'Loi de Néel–Arrhenius simplifiée, temps d’essai 1 ns : ce n’est pas la prédiction d’un disque commercial.',
        sources: ['weller', 'brown']
      },
      {
        name: 'Plus dur… trop dur',
        intro: 'Solution des ingénieurs : un matériau plus dur, le FePt, dont l’anisotropie K est environ 13 fois plus forte. Regarde la barrière.',
        do: [
          { txt: 'Appuie sur « FePt, grains de 4 nm, sans laser ».', actions: [{ label: 'FePt, grains de 4 nm, sans laser', set: { mat: 'hamr', d: 4, T: 25, laser: false }, act: 'write' }] }
        ],
        barrier: true,
        notice: 'Le mot a-t-il été écrit ?',
        choices: [
          { t: 'Non : la tête n’a pas réussi à retourner les grains.', ok: function (s) { return !s.writeOk; }, fb: 'C’est bien ce qu’a calculé la simulation.' },
          { t: 'Oui, sans problème.', ok: function (s) { return s.writeOk; }, fb: 'C’est bien ce qu’a calculé la simulation.' }
        ],
        explain: 'La barrière est maintenant très haute : même des grains de 4 nm tiendraient des siècles. Mais pour retourner un grain, la tête doit fournir un champ d’environ 2K/M_s, ici près de 9 T. La tête n’en donne qu’environ 2 T. Le bit est stable, mais impossible à écrire.',
        qty: ['K', 'B'],
        limit: 'Changer de matériau change aussi M_s et T_C, pas seulement K.',
        sources: ['weller', 'kryder']
      },
      {
        name: 'Chauffer juste pour écrire',
        intro: 'Souviens-toi du chapitre Température : chauffer affaiblit l’aimantation et l’anisotropie K, qui s’annule à la température de Curie. Un laser chauffe le grain un court instant, juste sous la tête.',
        do: [
          { txt: 'Appuie sur « FePt + laser ». Regarde la barrière pendant l’écriture.', actions: [{ label: 'FePt + laser', set: { mat: 'hamr', d: 4, T: 25, laser: true }, act: 'write' }] },
          { txt: 'Laisse passer une dizaine d’« années ».', actions: [{ label: 'Dix ans ont passé' }] }
        ],
        barrier: true,
        notice: 'Avec le laser, qu’as-tu observé ?',
        choices: [
          { t: 'Le mot s’est écrit, et il tient.', ok: function (s) { return s.writeOk && s.correct === 96; }, fb: 'C’est bien ce qu’a calculé la simulation.' },
          { t: 'Le mot s’est écrit, mais il s’efface.', ok: function (s) { return s.writeOk && s.correct < 96; }, fb: 'C’est bien ce qu’a calculé la simulation.' },
          { t: 'Rien ne s’est écrit.', ok: function (s) { return !s.writeOk; }, fb: 'C’est bien ce qu’a calculé la simulation.' }
        ],
        explain: 'Chaud, le grain a une barrière basse : la tête peut l’écrire. Refroidi, K redevient grand et la barrière remonte : le bit est figé. C’est l’enregistrement magnétique assisté par la chaleur (HAMR).',
        qty: ['T', 'K'],
        limit: 'Chaque grain n’a que deux états. Le transport de la chaleur n’est pas calculé.',
        sources: ['kryder', 'weller']
      }
    ]
  }
];

const DECOUVERTE = PARCOURS.filter(function (g) { return !g.app; });

export { MODELS, PARCOURS, DECOUVERTE, GRANDEURS, PAL, frNum };
