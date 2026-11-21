// Équation LLG macrospin, RK4 (B en tesla, t en secondes).
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

