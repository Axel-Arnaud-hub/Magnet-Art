const TAU = Math.PI * 2;
const GAMMA = 1.760859e11;
const MU0 = 4e-7 * Math.PI;
const GHZ_PER_T = GAMMA / TAU / 1e9;
const DEG = Math.PI / 180;

function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

function qs(sel, root) { return (root || document).querySelector(sel); }

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

function divRGB(v) {
  const t = clamp(v, -1, 1);
  if (t >= 0) return [18 + (255 - 18) * t, 24 + (96 - 24) * t, 48 + (70 - 48) * t];
  const s = -t;
  return [18 + (56 - 18) * s, 24 + (190 - 24) * s, 48 + (255 - 48) * s];
}

function rgbStr(c) {
  return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
}

function fmtTime(t) {
  if (Math.abs(t) < 1e-9) return (t * 1e12).toFixed(0) + ' ps';
  return (t * 1e9).toFixed(2) + ' ns';
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
  return String(parseFloat(s.toPrecision(4)));
}

function wrapPi(a) {
  while (a > Math.PI) a -= TAU;
  while (a <= -Math.PI) a += TAU;
  return a;
}
