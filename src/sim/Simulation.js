// Logique de simulation extraite du Sandbox du prototype MicroMag.
// Aucune dépendance à React ni au DOM : le solveur LLG est dans FilmCore.
import { FilmCore } from './FilmCore.js'
import { TAU, clamp } from './math.js'

// Unités : Ms kA/m, A pJ/m, K kJ/m³, D mJ/m², B mT, longueurs nm.
export const MATERIALS = {
  // Co/Pt effectif : K ≈ Ku − μ0Ms²/2, sans magnétostatique (rapide).
  sky: { label: 'Co/Pt — skyrmion', Ms: 580, A: 15, K: 600, D: 3.5, alpha: 0.3, thick: 1, Lx: 192, Ly: 192, nx: 64, ny: 64, Bx: 0, By: 0, Bz: 20, demag: false, radius: 25, initial: 'skyrmion' },
  // Même système, champ démagnétisant FFT film mince (plus lent).
  skyfft: { label: 'Co/Pt — skyrmion + FFT', Ms: 580, A: 15, K: 800, D: 3.5, alpha: 0.3, thick: 1, Lx: 192, Ly: 192, nx: 64, ny: 64, Bx: 0, By: 0, Bz: 20, demag: true, radius: 25, initial: 'skyrmion' },
  // Co/Pt : paramètres de simulation publiés.
  cop: { label: 'Co/Pt', Ms: 580, A: 15, K: 800, D: 3.5, alpha: 0.3, thick: 1, Lx: 192, Ly: 192, nx: 64, ny: 64, Bx: 0, By: 0, Bz: 0, demag: false, radius: 30, initial: 'random' },
  // Permalloy, µMAG standard problem #4.
  py: { label: 'Permalloy (µMAG #4)', Ms: 800, A: 13, K: 0, D: 0, alpha: 0.02, thick: 3, Lx: 500, Ly: 125, nx: 96, ny: 24, Bx: 0, By: 0, Bz: 0, demag: true, radius: 30, initial: 'random' },
}

export const INITIAL_STATES = [
  ['skyrmion', 'Skyrmion central'],
  ['random', 'Aléatoire'],
  ['up', 'Uniforme +z'],
  ['inplane', 'Uniforme +x'],
  ['stripes', 'Bandes'],
]

export const SHAPES = [
  ['rectangle', 'Rectangle'],
  ['disk', 'Disque'],
]

// Définition des paramètres numériques : [clé, libellé, unité, min, max, pas]
export const PARAM_SPEC = {
  geometry: [
    ['Lx', 'Lx', 'nm', 30, 2000, 10],
    ['Ly', 'Ly', 'nm', 30, 2000, 10],
    ['thick', 't', 'nm', 0.5, 100, 0.5],
    ['nx', 'Nx', '', 12, 128, 1],
    ['ny', 'Ny', '', 12, 128, 1],
  ],
  material: [
    ['Ms', 'Ms', 'kA/m', 10, 2500, 10],
    ['A', 'A', 'pJ/m', 0.1, 100, 0.1],
    ['K', 'K', 'kJ/m³', -2000, 3000, 10],
    ['D', 'D', 'mJ/m²', -10, 10, 0.1],
    ['alpha', 'α', '', 0, 1, 0.01],
  ],
  field: [
    ['Bx', 'Bx', 'mT', -1000, 1000, 5],
    ['By', 'By', 'mT', -1000, 1000, 5],
    ['Bz', 'Bz', 'mT', -1000, 1000, 5],
  ],
  seed: [['radius', 'Rayon', 'nm', 5, 180, 5]],
}

export function presetParams(id) {
  const rest = { ...MATERIALS[id] }
  delete rest.label
  return { material: id, shape: 'rectangle', fill: true, ...rest }
}

export const DEFAULT_PARAMS = presetParams('sky')

// Ramène chaque paramètre numérique dans son domaine valide.
export function sanitize(raw) {
  const p = { ...raw }
  for (const group of Object.values(PARAM_SPEC)) {
    for (const [key, , , min, max] of group) {
      const v = Number(p[key])
      p[key] = Number.isFinite(v) ? clamp(v, min, max) : DEFAULT_PARAMS[key]
    }
  }
  p.nx = Math.floor(p.nx)
  p.ny = Math.floor(p.ny)
  p.demag = !!p.demag
  return p
}

// Adapte le film au rapport hauteur/largeur de l'écran : même taille de cellule
// (Lx/Nx) et à peu près le même nombre de cellules, pour un coût de calcul inchangé.
export function fitToAspect(raw, aspect) {
  const p = sanitize(raw)
  const cell = p.Lx / p.nx
  const n = p.nx * p.ny
  let nx = Math.round(Math.sqrt(n / aspect))
  let ny = Math.round(nx * aspect)
  const k = Math.min(1, 128 / Math.max(nx, ny))
  nx = clamp(Math.round(nx * k), 12, 128)
  ny = clamp(Math.round(ny * k), 12, 128)
  return { ...p, nx, ny, Lx: nx * cell, Ly: ny * cell }
}

export class Simulation {
  constructor(params) {
    this.p = sanitize(params)
    this.t = 0
    // Temps simulé (s) par seconde réelle à vitesse 1.
    this.timeScale = 1.8e-9
    this.build()
    this.init(this.p.initial)
  }

  build() {
    const p = this.p
    const nx = p.nx
    const ny = p.ny
    const dx = (p.Lx * 1e-9) / nx
    const dy = (p.Ly * 1e-9) / ny
    let mask = null
    if (p.shape === 'disk') {
      mask = new Uint8Array(nx * ny)
      const cx = p.Lx * 0.5
      const cy = p.Ly * 0.5
      const r = 0.49 * Math.min(p.Lx, p.Ly)
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const x = ((i + 0.5) * p.Lx) / nx - cx
          const y = ((j + 0.5) * p.Ly) / ny - cy
          mask[j * nx + i] = x * x + y * y <= r * r ? 1 : 0
        }
      }
    }
    const c = new FilmCore(nx, ny, dx, { dy, mask, thickness: p.thick * 1e-9, demag: p.demag })
    c.Ms = p.Ms * 1e3
    c.A = p.A * 1e-12
    c.Kc = p.K * 1e3
    c.D = p.D * 1e-3
    c.alpha.fill(p.alpha)
    c.Bx = p.Bx * 1e-3
    c.By = p.By * 1e-3
    c.Bz = p.Bz * 1e-3
    c.prepare()
    this.core = c
    this.nx = nx
    this.ny = ny
    this.lex = Math.sqrt((2 * c.A) / (4e-7 * Math.PI * c.Ms * c.Ms))
  }

  init(kind) {
    const c = this.core
    const { nx, ny } = this
    c.mx.fill(0)
    c.my.fill(0)
    c.mz.fill(1)
    if (kind === 'inplane') {
      c.mx.fill(1)
      c.mz.fill(0)
    } else if (kind === 'stripes') {
      const period = Math.max(6, nx / 3)
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          c.mz[j * nx + i] = Math.sin((TAU * (i + 0.5)) / period) >= 0 ? 1 : -1
        }
      }
    } else if (kind === 'random') {
      c.randomize()
    }
    c.normalizeAll()
    if (kind === 'skyrmion') this.placeSeed(nx / 2, ny / 2)
    c.invalidate()
    this.t = 0
    this.computeStats()
  }

  // Graine chirale de skyrmion centrée en (cx, cy), coordonnées en cellules.
  placeSeed(cx, cy) {
    const c = this.core
    const { nx, ny } = this
    const radius = this.p.radius * 1e-9
    const width = Math.max(Math.min(this.lex, radius / 3), Math.min(c.dx, c.dy))
    const chirality = this.p.D < 0 ? -1 : 1
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i
        if (c.mask && c.mask[id] !== 1) continue
        const x = (i + 0.5 - cx) * c.dx
        const y = (j + 0.5 - cy) * c.dy
        const r = Math.hypot(x, y)
        if (r > radius + 4 * width) continue
        const theta = 2 * Math.atan(Math.exp(clamp((radius - r) / width, -35, 35)))
        const phi = Math.atan2(y, x)
        c.mx[id] = chirality * Math.sin(theta) * Math.cos(phi)
        c.my[id] = chirality * Math.sin(theta) * Math.sin(phi)
        c.mz[id] = Math.cos(theta)
      }
    }
    c.normalizeAll()
    c.invalidate()
  }

  // Avance la simulation d'un intervalle réel `dtReal` (s), budget CPU ~11 ms.
  advance(dtReal, speed) {
    const c = this.core
    const dt = c.dt
    const target = this.timeScale * speed * dtReal
    const t0 = performance.now()
    let adv = 0
    let k = 0
    while (adv < target) {
      c.step(dt, this.t)
      this.t += dt
      adv += dt
      k++
      if ((k & 3) === 0 && performance.now() - t0 > 11) break
    }
  }

  computeStats() {
    const c = this.core
    const n = c.act.length
    let mz = 0
    for (let q = 0; q < n; q++) mz += c.mz[c.act[q]]
    this.stats = { t: this.t, mz: mz / n, Q: c.topoCharge() }
    return this.stats
  }
}
