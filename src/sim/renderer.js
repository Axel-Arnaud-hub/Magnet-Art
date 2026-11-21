// Rendu canvas de l'aimantation : carte de couleur + flèches optionnelles.
import { TAU, clamp, hsl2rgb, divRGB } from './math.js'

export class FieldRenderer {
  constructor() {
    this.off = document.createElement('canvas')
    this.octx = this.off.getContext('2d')
    this.img = null
    this.nx = 0
    this.ny = 0
    this.vmax = 1
    this.rgb = [0, 0, 0]
    this.lay = { x0: 0, y0: 0, s: 1 }
  }

  resize(nx, ny) {
    if (nx === this.nx && ny === this.ny) return
    this.nx = nx
    this.ny = ny
    this.off.width = nx
    this.off.height = ny
    this.img = this.octx.createImageData(nx, ny)
    this.vmax = 1
  }

  paint(core, mode) {
    this.resize(core.nx, core.ny)
    const { nx, ny, rgb } = this
    const d = this.img.data
    const { mx, my, mz, mask } = core
    const comp = mode === 'mx' ? mx : mode === 'my' ? my : mode === 'mz' ? mz : null
    if (comp && mode !== 'mz') {
      let vm = 0
      for (let i = 0; i < core.n; i++) vm = Math.max(vm, Math.abs(comp[i]))
      this.vmax = Math.max(this.vmax * 0.985, vm, 0.01)
    } else {
      this.vmax = 1
    }
    const vmax = this.vmax
    for (let j = 0; j < ny; j++) {
      const row = ny - 1 - j
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i
        const o = (row * nx + i) * 4
        if (mask && mask[id] !== 1) {
          d[o + 3] = 0
          continue
        }
        if (comp) divRGB(comp[id] / vmax, rgb)
        else hsl2rgb(Math.atan2(my[id], mx[id]) / TAU, 1, clamp(0.5 + 0.5 * mz[id], 0.04, 0.96), rgb)
        d[o] = rgb[0]
        d[o + 1] = rgb[1]
        d[o + 2] = rgb[2]
        d[o + 3] = 255
      }
    }
    this.octx.putImageData(this.img, 0, 0)
  }

  // cover = true : le film remplit tout l'écran (les bords en trop sont rognés).
  draw(ctx, W, H, cover) {
    const s = cover
      ? Math.max(W / this.nx, H / this.ny)
      : Math.min((W * 0.88) / this.nx, (H * 0.88) / this.ny)
    this.lay = { s, x0: (W - this.nx * s) / 2, y0: (H - this.ny * s) / 2 }
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(this.off, this.lay.x0, this.lay.y0, this.nx * s, this.ny * s)
  }

  drawArrows(ctx, core) {
    const { x0, y0, s } = this.lay
    const { nx, ny, mask, mx, my } = core
    const step = Math.max(2, Math.round(Math.max(nx, ny) / 24))
    const len = s * step * 0.42
    const half = Math.floor(step / 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1
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

  // Convertit des coordonnées écran (CSS px) en coordonnées de cellules.
  toCell(x, y) {
    const { x0, y0, s } = this.lay
    const ix = (x - x0) / s
    const iy = this.ny - (y - y0) / s
    if (ix < 0 || ix >= this.nx || iy < 0 || iy >= this.ny) return null
    return [ix, iy]
  }
}
