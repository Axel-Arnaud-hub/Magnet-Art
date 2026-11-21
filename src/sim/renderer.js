// Outils de rendu partagés + rendu de secours en canvas 2D (si WebGL2 absent).
import { TAU, clamp } from './math.js'
import { buildLut, LUT_SIZE } from './palettes.js'

// Mélange vers le blanc (mz > 0) ou le noir (mz < 0) pour le mode direction.
export const MZ_SHADE = 0.92

// Position du film à l'écran, en pixels CSS. cover : remplit tout l'écran.
export function computeLayout(nx, ny, W, H, cover) {
  const s = cover ? Math.max(W / nx, H / ny) : Math.min((W * 0.88) / nx, (H * 0.88) / ny)
  return { s, x0: (W - nx * s) / 2, y0: (H - ny * s) / 2, nx, ny }
}

// Coordonnées écran (px CSS) -> coordonnées de cellule (j vers le haut).
export function toCell(lay, x, y) {
  const ix = (x - lay.x0) / lay.s
  const iy = lay.ny - (y - lay.y0) / lay.s
  if (ix < 0 || ix >= lay.nx || iy < 0 || iy >= lay.ny) return null
  return [ix, iy]
}

// Échelle adaptative pour mx / my (qui peuvent rester petits) ; 1 pour mz.
export class ComponentScale {
  constructor() {
    this.vmax = 1
  }
  update(core, mode) {
    if (mode !== 'mx' && mode !== 'my') return (this.vmax = 1)
    const comp = mode === 'mx' ? core.mx : core.my
    let vm = 0
    for (let i = 0; i < core.n; i++) vm = Math.max(vm, Math.abs(comp[i]))
    this.vmax = Math.max(this.vmax * 0.985, vm, 0.01)
    return this.vmax
  }
}

// Tracé en deux passes : contour sombre puis trait clair, lisible sur le blanc
// (mz > 0) comme sur le noir (mz < 0).
export function strokeTwice(ctx, strokes, fills, width) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = width + 2
  for (const p of strokes) ctx.stroke(p)
  for (const p of fills) ctx.stroke(p)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = width
  for (const p of strokes) ctx.stroke(p)
  for (const p of fills) ctx.fill(p)
}

// Flèches de la composante dans le plan (mx, my) : longueur ∝ |m∥|, pointe
// pleine. Quand m est presque hors du plan : ⊙ (mz > 0) ou ⊗ (mz < 0).
export function drawArrows(ctx, core, lay) {
  const { x0, y0, s } = lay
  const { nx, ny, mask, mx, my, mz } = core
  const step = Math.max(1, Math.round(34 / s))
  const pitch = s * step
  const len = pitch * 0.82
  const head = Math.min(pitch * 0.34, 10)
  const i0 = Math.floor(((nx - 1) % step) / 2)
  const j0 = Math.floor(((ny - 1) % step) / 2)
  const shafts = new Path2D()
  const heads = new Path2D()
  const marks = new Path2D()
  const dots = new Path2D()
  for (let j = j0; j < ny; j += step) {
    for (let i = i0; i < nx; i += step) {
      const id = j * nx + i
      if (mask && mask[id] !== 1) continue
      const cx = x0 + (i + 0.5) * s
      const cy = y0 + (ny - j - 0.5) * s
      const p = Math.hypot(mx[id], my[id])
      if (p < 0.25) {
        const r = Math.max(2, head * 0.4)
        if (mz[id] >= 0) {
          dots.moveTo(cx + r * 0.45, cy)
          dots.arc(cx, cy, r * 0.45, 0, TAU)
        } else {
          marks.moveTo(cx - r, cy - r)
          marks.lineTo(cx + r, cy + r)
          marks.moveTo(cx + r, cy - r)
          marks.lineTo(cx - r, cy + r)
        }
        continue
      }
      // Direction à l'écran (y vers le bas).
      const ux = mx[id] / p
      const uy = -my[id] / p
      const L = len * p
      const hs = head * Math.min(1, 0.45 + p * 0.6)
      const tx = cx + ux * L * 0.5
      const ty = cy + uy * L * 0.5
      const bx = tx - ux * hs
      const by = ty - uy * hs
      shafts.moveTo(cx - ux * L * 0.5, cy - uy * L * 0.5)
      shafts.lineTo(bx, by)
      heads.moveTo(tx, ty)
      heads.lineTo(bx - uy * hs * 0.55, by + ux * hs * 0.55)
      heads.lineTo(bx + uy * hs * 0.55, by - ux * hs * 0.55)
      heads.closePath()
    }
  }
  strokeTwice(ctx, [shafts, marks], [heads, dots], 1.6)
}

// m interpolé bilinéairement en (x, y), coordonnées en cellules (y vers le
// haut). Renvoie la composante dans le plan, ou null hors du film.
function sampleInPlane(core, x, y, out) {
  const { nx, ny, mask, mx, my } = core
  if (x < 0 || y < 0 || x >= nx || y >= ny) return null
  if (mask && mask[Math.floor(y) * nx + Math.floor(x)] !== 1) return null
  const gx = clamp(x - 0.5, 0, nx - 1)
  const gy = clamp(y - 0.5, 0, ny - 1)
  const i = Math.min(Math.floor(gx), nx - 2)
  const j = Math.min(Math.floor(gy), ny - 2)
  const fx = gx - i
  const fy = gy - j
  const a = j * nx + i
  const b = a + 1
  const c = a + nx
  const d = c + 1
  const w00 = (1 - fx) * (1 - fy)
  const w10 = fx * (1 - fy)
  const w01 = (1 - fx) * fy
  const w11 = fx * fy
  out[0] = w00 * mx[a] + w10 * mx[b] + w01 * mx[c] + w11 * mx[d]
  out[1] = w00 * my[a] + w10 * my[b] + w01 * my[c] + w11 * my[d]
  return out
}

// Lignes de champ de l'aimantation dans le plan : courbes tangentes à
// (mx, my), espacées régulièrement (méthode de Jobard–Lefer simplifiée).
// Elles s'arrêtent là où m sort du plan (|m∥| < 0.12). Un chevron au milieu
// de chaque ligne indique le sens. Renvoie les chemins (à tracer avec
// drawFieldLines), pour pouvoir les réutiliser sur plusieurs images.
export function fieldLinePaths(core, lay) {
  const { x0, y0, s } = lay
  const { nx, ny } = core
  const sep = Math.max(1, 18 / s) // espacement entre lignes (cellules)
  const h = clamp(4 / s, 0.1, 0.5) // pas d'intégration (cellules)
  const minP = 0.12
  const maxSteps = Math.ceil((4 * (nx + ny)) / h)
  // Grille d'occupation : une case de côté sep/2 par point déjà tracé.
  const cs = sep * 0.5
  const gw = Math.ceil(nx / cs) + 1
  const gh = Math.ceil(ny / cs) + 1
  const occ = new Uint8Array(gw * gh)
  const cellOf = (x, y) => Math.floor(y / cs) * gw + Math.floor(x / cs)
  const v = [0, 0]
  const own = new Set()

  // Direction unitaire (sens `dir`) au point (x, y), ou null pour s'arrêter.
  const dirAt = (x, y, dir) => {
    if (!sampleInPlane(core, x, y, v)) return null
    const p = Math.hypot(v[0], v[1])
    if (p < minP) return null
    return [(dir * v[0]) / p, (dir * v[1]) / p]
  }

  // Suit la ligne depuis (x, y) dans le sens `dir` (RK2, point milieu).
  const trace = (x, y, dir) => {
    const pts = []
    let prev = null
    for (let k = 0; k < maxSteps; k++) {
      const d1 = dirAt(x, y, dir)
      if (!d1) break
      const d2 = dirAt(x + d1[0] * h * 0.5, y + d1[1] * h * 0.5, dir)
      if (!d2) break
      // Demi-tour brutal : singularité (cœur de vortex, paroi), on s'arrête.
      if (prev && d2[0] * prev[0] + d2[1] * prev[1] < 0.3) break
      x += d2[0] * h
      y += d2[1] * h
      const c = cellOf(x, y)
      if (c < 0 || c >= occ.length || (occ[c] && !own.has(c))) break
      own.add(c)
      pts.push(x, y)
      prev = d2
    }
    return pts
  }

  const lines = new Path2D()
  const heads = new Path2D()
  const head = clamp(sep * s * 0.28, 4, 8)
  for (let sy = sep * 0.5; sy < ny; sy += sep) {
    for (let sx = sep * 0.5; sx < nx; sx += sep) {
      const c0 = cellOf(sx, sy)
      if (occ[c0] || !dirAt(sx, sy, 1)) continue
      own.clear()
      own.add(c0)
      const back = trace(sx, sy, -1)
      const fwd = trace(sx, sy, 1)
      const n = (back.length + fwd.length) / 2 + 1
      if (n * h < sep * 0.8) continue
      // Points dans l'ordre du sens de m : arrière inversé, graine, avant.
      const pts = []
      for (let k = back.length - 2; k >= 0; k -= 2) pts.push(back[k], back[k + 1])
      pts.push(sx, sy)
      for (let k = 0; k < fwd.length; k++) pts.push(fwd[k])
      for (const c of own) occ[c] = 1
      const X = (k) => x0 + pts[k] * s
      const Y = (k) => y0 + (ny - pts[k + 1]) * s
      lines.moveTo(X(0), Y(0))
      for (let k = 2; k < pts.length; k += 2) lines.lineTo(X(k), Y(k))
      // Chevron au milieu de la ligne, si elle est assez longue.
      if (n * h * s > head * 3) {
        const m = Math.floor(n / 2) * 2
        const a = Math.max(0, m - 2)
        const b = Math.min(pts.length - 2, m + 2)
        let ux = X(b) - X(a)
        let uy = Y(b) - Y(a)
        const l = Math.hypot(ux, uy)
        if (l > 0) {
          ux /= l
          uy /= l
          const tx = X(m) + ux * head * 0.5
          const ty = Y(m) + uy * head * 0.5
          const bx = tx - ux * head
          const by = ty - uy * head
          heads.moveTo(tx, ty)
          heads.lineTo(bx - uy * head * 0.5, by + ux * head * 0.5)
          heads.lineTo(bx + uy * head * 0.5, by - ux * head * 0.5)
          heads.closePath()
        }
      }
    }
  }
  return { lines, heads, lay, core }
}

export function drawFieldLines(ctx, paths) {
  strokeTwice(ctx, [paths.lines], [paths.heads], 1.2)
}

// Rendu CPU : une couleur par cellule, puis agrandissement lissé.
export class CpuRenderer {
  constructor(ctx) {
    this.ctx = ctx
    this.off = document.createElement('canvas')
    this.octx = this.off.getContext('2d')
    this.img = null
    this.nx = 0
    this.ny = 0
    this.lutId = null
    this.lut = null
  }

  render(core, lay, W, H, opts) {
    const { nx, ny, mx, my, mz, mask } = core
    if (nx !== this.nx || ny !== this.ny) {
      this.nx = nx
      this.ny = ny
      this.off.width = nx
      this.off.height = ny
      this.img = this.octx.createImageData(nx, ny)
    }
    if (opts.palette !== this.lutId) {
      this.lutId = opts.palette
      this.lut = buildLut(opts.palette)
    }
    const lut = this.lut
    const d = this.img.data
    const comp = opts.mode === 'mx' ? mx : opts.mode === 'my' ? my : opts.mode === 'mz' ? mz : null
    for (let j = 0; j < ny; j++) {
      const row = ny - 1 - j
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i
        const o = (row * nx + i) * 4
        if (mask && mask[id] !== 1) {
          d[o + 3] = 0
          continue
        }
        let r, g, b
        if (comp) {
          const t = clamp((comp[id] / opts.vmax) * 0.5 + 0.5, 0, 1)
          const k = Math.round(t * (LUT_SIZE - 1)) * 4
          r = lut[k]
          g = lut[k + 1]
          b = lut[k + 2]
        } else {
          const phi = Math.atan2(my[id], mx[id]) / TAU
          const k = (Math.floor((phi - Math.floor(phi)) * LUT_SIZE) % LUT_SIZE) * 4
          const z = mz[id] * MZ_SHADE
          const target = z > 0 ? 255 : 0
          const f = Math.abs(z)
          r = lut[k] + (target - lut[k]) * f
          g = lut[k + 1] + (target - lut[k + 1]) * f
          b = lut[k + 2] + (target - lut[k + 2]) * f
        }
        d[o] = r
        d[o + 1] = g
        d[o + 2] = b
        d[o + 3] = 255
      }
    }
    this.octx.putImageData(this.img, 0, 0)
    const ctx = this.ctx
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(this.off, lay.x0, lay.y0, nx * lay.s, ny * lay.s)
  }
}
