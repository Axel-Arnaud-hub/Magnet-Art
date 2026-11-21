class Plot {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.box = { l: 50, t: 24, r: 12, b: 32 };
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
    ctx.fillStyle = '#9fb0d8';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, b.l, 15);
    const sx = niceStep(xmax - xmin, 6), sy = niceStep(ymax - ymin, 4);
    ctx.lineWidth = 1;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const x0 = Math.ceil(xmin / sx - 1e-9) * sx;
    for (let i = 0; i < 60; i++) {
      const v = x0 + i * sx;
      if (v > xmax + sx * 1e-6) break;
      const x = this.X(v);
      ctx.strokeStyle = 'rgba(130,160,255,0.13)';
      ctx.beginPath(); ctx.moveTo(x, b.t); ctx.lineTo(x, b.t + this.ph); ctx.stroke();
      ctx.fillStyle = '#7f90bb';
      ctx.fillText(tickLabel(v), x, b.t + this.ph + 13);
    }
    ctx.textAlign = 'right';
    const y0 = Math.ceil(ymin / sy - 1e-9) * sy;
    for (let i = 0; i < 60; i++) {
      const v = y0 + i * sy;
      if (v > ymax + sy * 1e-6) break;
      const y = this.Y(v);
      ctx.strokeStyle = Math.abs(v) < sy * 1e-6 ? 'rgba(200,215,255,0.35)' : 'rgba(130,160,255,0.13)';
      ctx.beginPath(); ctx.moveTo(b.l, y); ctx.lineTo(b.l + this.pw, y); ctx.stroke();
      ctx.fillStyle = '#7f90bb';
      ctx.fillText(tickLabel(v), b.l - 5, y + 4);
    }
    ctx.fillStyle = '#8fa0c8';
    ctx.textAlign = 'center';
    if (xlab) ctx.fillText(xlab, b.l + this.pw / 2, H - 4);
    if (ylab) {
      ctx.save();
      ctx.translate(11, b.t + this.ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(ylab, 0, 0);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(160,185,255,0.3)';
    ctx.strokeRect(b.l, b.t, this.pw, this.ph);
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

  line(xs, ys, col, lw) {
    const ctx = this.ctx, n = Math.min(xs.length, ys.length);
    if (n < 2) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw || 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.X(xs[0]), this.Y(ys[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(this.X(xs[i]), this.Y(ys[i]));
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
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, px + 4, b.t + 12);
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
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(label, b.l + this.pw - 4, py - 4);
    }
  }

  text(s, x, y, col, align) {
    const ctx = this.ctx;
    ctx.fillStyle = col || '#b8c6ee';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.fillText(s, x, y);
  }

  legend(defs) {
    const ctx = this.ctx;
    let x = this.W - this.box.r - 6;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let i = defs.length - 1; i >= 0; i--) {
      const d = defs[i], w = ctx.measureText(d.label).width;
      ctx.fillStyle = '#b8c6ee';
      ctx.fillText(d.label, x, 15);
      ctx.fillStyle = d.col;
      ctx.fillRect(x - w - 16, 11, 11, 3);
      x -= w + 26;
    }
  }
}

function drawSphere(ctx, W, H, view, it) {
  const R = Math.min(W, H) * 0.34, cx = W * 0.5, cy = H * 0.53;
  const cyw = Math.cos(view.yaw), syw = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const P = function (x, y, z) {
    const x1 = x * cyw - y * syw, y1 = x * syw + y * cyw;
    return [cx + R * x1, cy - R * (y1 * sp + z * cp), -y1 * cp + z * sp];
  };
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  g.addColorStop(0, 'rgba(100,130,255,0.22)');
  g.addColorStop(1, 'rgba(20,30,90,0.10)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(140,170,255,0.35)';
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
  ring(function (a) { return [Math.cos(a), Math.sin(a), 0]; }, 'rgba(210,225,255,0.55)', 'rgba(150,180,255,0.16)');
  ring(function (a) { return [Math.cos(a), 0, Math.sin(a)]; }, 'rgba(150,180,255,0.32)', 'rgba(150,180,255,0.10)');
  ring(function (a) { return [0, Math.cos(a), Math.sin(a)]; }, 'rgba(150,180,255,0.32)', 'rgba(150,180,255,0.10)');
  ring(function (a) { return [0.7071 * Math.cos(a), 0.7071 * Math.sin(a), 0.7071]; }, 'rgba(150,180,255,0.2)', 'rgba(150,180,255,0.07)');
  ring(function (a) { return [0.7071 * Math.cos(a), 0.7071 * Math.sin(a), -0.7071]; }, 'rgba(150,180,255,0.2)', 'rgba(150,180,255,0.07)');

  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const axes = [[1.32, 0, 0, 'x'], [0, 1.32, 0, 'y'], [0, 0, 1.32, 'z']];
  for (let k = 0; k < 3; k++) {
    const a = axes[k], p0 = P(-a[0] / 1.32 * 1.15, -a[1] / 1.32 * 1.15, -a[2] / 1.32 * 1.15), p1 = P(a[0] / 1.32 * 1.15, a[1] / 1.32 * 1.15, a[2] / 1.32 * 1.15);
    ctx.strokeStyle = 'rgba(190,205,255,0.28)';
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    const pl = P(a[0], a[1], a[2]);
    ctx.fillStyle = 'rgba(200,215,255,0.7)';
    ctx.fillText(a[3], pl[0], pl[1] + 4);
  }

  const arrow = function (a, b, col, lw, o) {
    o = o || {};
    const p0 = P(a[0], a[1], a[2]), p1 = P(b[0], b[1], b[2]);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 16; }
    ctx.setLineDash(o.dash ? [6, 5] : []);
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    ctx.setLineDash([]);
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / L, uy = dy / L, hs = o.head || 11;
    if (!o.nohead) {
      ctx.beginPath();
      ctx.moveTo(p1[0] + ux * hs * 0.6, p1[1] + uy * hs * 0.6);
      ctx.lineTo(p1[0] - ux * hs + uy * hs * 0.5, p1[1] - uy * hs - ux * hs * 0.5);
      ctx.lineTo(p1[0] - ux * hs - uy * hs * 0.5, p1[1] - uy * hs + ux * hs * 0.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (o.label) {
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(o.label, p1[0] + ux * 16, p1[1] + uy * 16 + 4);
    }
  };

  const vecs = it.vecs || [];
  for (let k = 0; k < vecs.length; k++) {
    const v = vecs[k];
    if (v.axis) arrow([-v.v[0], -v.v[1], -v.v[2]], v.v, v.col, 1.6, { dash: true, nohead: true, label: v.label });
    else arrow([0, 0, 0], v.v, v.col, 3, { glow: v.col, label: v.label, head: 12 });
  }

  const tr = it.trail || [];
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let i = 1; i < tr.length; i++) {
    const a = P(tr[i - 1][0], tr[i - 1][1], tr[i - 1][2]), b = P(tr[i][0], tr[i][1], tr[i][2]);
    const f = i / tr.length;
    const hue = 185 + 115 * (1 - tr[i][2]) / 2;
    ctx.strokeStyle = 'hsla(' + hue.toFixed(0) + ',100%,65%,' + (Math.pow(f, 1.6) * 0.95).toFixed(3) + ')';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.lineCap = 'butt';

  const m = it.m;
  if (m) {
    arrow([0, 0, 0], [m[0], m[1], 0], 'rgba(255,255,255,0.22)', 1.2, { dash: true, nohead: true });
    arrow([m[0], m[1], 0], [m[0], m[1], m[2]], 'rgba(255,255,255,0.22)', 1.2, { dash: true, nohead: true });
    const pf = P(m[0], m[1], 0);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(pf[0], pf[1], 3, 0, TAU); ctx.fill();
    arrow([0, 0, 0], [m[0], m[1], m[2]], '#ffffff', 3.4, { glow: '#37e6ff', label: 'm', head: 13 });
    const pt = P(m[0], m[1], m[2]);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#37e6ff'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(pt[0], pt[1], 5, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
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
          c = hsl2rgb(hue, 1, clamp(0.5 + 0.5 * mz[id], 0.04, 0.96));
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
    return this.lay;
  }

  px(i, j) { return [this.lay.x0 + i * this.lay.s, this.lay.y0 + (this.ny - j) * this.lay.s]; }
}

function drawArrowsOver(ctx, core, view, step) {
  const L = view.lay, nx = core.nx, ny = core.ny, s = L.s, len = s * step * 0.42;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const half = Math.floor(step / 2);
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
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (let j = half; j < ny; j += step) {
    for (let i = half; i < nx; i += step) {
      const id = j * nx + i;
      if (core.mask && core.mask[id] !== 1) continue;
      const ax = core.mx[id], ay = core.my[id];
      const cx = L.x0 + (i + 0.5) * s, cy = L.y0 + (ny - j - 0.5) * s;
      ctx.beginPath();
      ctx.arc(cx + ax * len, cy - ay * len, 1.7, 0, TAU);
      ctx.fill();
    }
  }
}

function drawWheelLegend(ctx, x, y, r) {
  ctx.save();
  ctx.lineWidth = r * 0.3;
  for (let a = 0; a < 360; a += 4) {
    ctx.strokeStyle = rgbStr(hsl2rgb(a / 360, 1, 0.5));
    ctx.beginPath();
    ctx.arc(x, y, r, -a * DEG - 0.09, -a * DEG + 0.02);
    ctx.stroke();
  }
  const bx = x + r + 16, g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(bx, y - r, 9, 2 * r);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, y - r, 9, 2 * r);
  ctx.fillStyle = 'rgba(220,230,255,0.85)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('z ↑', bx + 14, y - r + 9);
  ctx.fillText('z ↓', bx + 14, y + r);
  ctx.textAlign = 'center';
  ctx.fillText('direction dans le plan', x + 22, y + r + 20);
  ctx.restore();
}

function drawScaleBar(ctx, x, y, px, label) {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + px, y);
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
  ctx.moveTo(x + px, y - 4); ctx.lineTo(x + px, y + 4);
  ctx.stroke();
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + px / 2, y - 8);
  ctx.restore();
}
