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

export function drawArrows(ctx, core, lay) {
  const { x0, y0, s } = lay
  const { nx, ny, mask, mx, my } = core
  const step = Math.max(2, Math.round(Math.max(nx, ny) / 24))
  const len = s * step * 0.42
  const half = Math.floor(step / 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let j = half; j < ny; j += step) {
    for (let i = half; i < nx; i += step) {
      const id = j * nx + i
      if (mask && mask[id] !== 1) continue
      const cx = x0 + (i + 0.5) * s
      const cy = y0 + (ny - j - 0.5) * s
      const ax = mx[id] * len
      const ay = my[id] * len
      ctx.moveTo(cx - ax, cy + ay)
      ctx.lineTo(cx + ax, cy - ay)
      ctx.moveTo(cx + ax + 1.6, cy - ay)
      ctx.arc(cx + ax, cy - ay, 1.6, 0, TAU)
    }
  }
  ctx.stroke()
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
