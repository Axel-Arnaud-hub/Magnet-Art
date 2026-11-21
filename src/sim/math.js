export const TAU = Math.PI * 2
export const GAMMA = 1.760859e11
export const MU0 = 4e-7 * Math.PI

export function clamp(x, a, b) {
  return x < a ? a : x > b ? b : x
}

// HSL -> RGB (0..255), écrit dans `out` pour éviter les allocations par pixel.
export function hsl2rgb(h, s, l, out) {
  h = h - Math.floor(h)
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  out[0] = f(h + 1 / 3) * 255
  out[1] = f(h) * 255
  out[2] = f(h - 1 / 3) * 255
  return out
}

// Carte divergente sur fond noir : bleu (-1) -> noir (0) -> rouge (+1).
export function divRGB(v, out) {
  const t = clamp(v, -1, 1)
  if (t >= 0) {
    out[0] = 255 * t
    out[1] = 70 * t
    out[2] = 50 * t
  } else {
    const s = -t
    out[0] = 40 * s
    out[1] = 150 * s
    out[2] = 255 * s
  }
  return out
}
