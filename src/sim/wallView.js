// Vue du monde « Paroi » (bac à sable), version sombre de la vue du tutoriel
// « Domaines et parois » :
//  1. le ruban vu de dessus (rouge ↑, bleu ↓, blanc = la paroi) ;
//  2. une rangée de flèches vues de côté sur tout le ruban (vue d'ensemble) ;
//  3. un zoom sur la paroi : une grande flèche par cellule autour d'elle, qui
//     suit la paroi. On y voit les spins tourner d'une cellule à l'autre.
//
// Vue de côté : x vers la droite (le long du ruban), z vers le haut. La flèche
// montre (mx, mz). Quand l'aimantation pointe surtout selon y (vers ou à
// l'opposé de l'observateur, cas d'une paroi de Bloch), la flèche se réduit :
// on dessine alors ⊙ (my > 0, vers toi) ou ⊗ (my < 0).

const RED = [215, 48, 31]
const BLUE = [52, 101, 190]
const WHITE = [240, 240, 236]
const GOLD = '#e2b84a'
const GREY = '#8a8a8a'
const ZOOM_CELLS = 25

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`
// mz = +1 rouge, 0 blanc, −1 bleu.
const mzColor = (z) => rgb(z >= 0 ? mix(WHITE, RED, Math.min(1, z)) : mix(WHITE, BLUE, Math.min(1, -z)))
const font = (size, weight = 400) => `${weight} ${size}px ui-monospace, Menlo, Consolas, monospace`

function arrow(ctx, cx, cy, ax, ay, head) {
  const len = Math.hypot(ax, ay)
  const ux = ax / len
  const uy = ay / len
  ctx.beginPath()
  ctx.moveTo(cx - ax, cy - ay)
  ctx.lineTo(cx + ax - ux * head * 0.6, cy + ay - uy * head * 0.6)
  ctx.stroke()
  const hx = cx + ax
  const hy = cy + ay
  ctx.beginPath()
  ctx.moveTo(hx, hy)
  ctx.lineTo(hx - ux * head + uy * head * 0.6, hy - uy * head - ux * head * 0.6)
  ctx.lineTo(hx - ux * head - uy * head * 0.6, hy - uy * head + ux * head * 0.6)
  ctx.closePath()
  ctx.fill()
}

function outOfPlane(ctx, cx, cy, r, out) {
  ctx.strokeStyle = '#d8d8d0'
  ctx.fillStyle = '#d8d8d0'
  ctx.lineWidth = Math.max(1.4, r * 0.18)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, 2 * Math.PI)
  ctx.stroke()
  if (out) {
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.3, 0, 2 * Math.PI)
    ctx.fill()
  } else {
    const k = r * 0.6
    ctx.beginPath()
    ctx.moveTo(cx - k, cy - k)
    ctx.lineTo(cx + k, cy + k)
    ctx.moveTo(cx + k, cy - k)
    ctx.lineTo(cx - k, cy + k)
    ctx.stroke()
  }
}

// Une flèche vue de côté pour la cellule i, centrée en (cx, cy), demi-longueur L.
function spin(core, i, cx, cy, L, head) {
  return (ctx) => {
    const ax = core.mx[i] * L
    const ay = -core.mz[i] * L
    if (Math.hypot(ax, ay) < 0.35 * L) {
      outOfPlane(ctx, cx, cy, Math.max(4, L * 0.32), core.my[i] > 0)
      return
    }
    const color = mzColor(core.mz[i])
    ctx.strokeStyle = color
    ctx.fillStyle = color
    arrow(ctx, cx, cy, ax, ay, head)
  }
}

// W, H : taille du canvas (px CSS). Ordinateur : on laisse la place du panneau
// à droite. Téléphone (W ≤ 640) : le panneau occupe le bas, la vue se tasse
// dans le haut de l'écran.
export function drawWall(ctx, core, info, W, H) {
  const { nx } = core
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const phone = W <= 640
  const area = phone ? H * 0.42 : H
  const left = phone ? 14 : Math.max(28, W * 0.04)
  const right = phone ? 14 : 300
  const w = W - left - right
  const cw = w / nx
  const xOf = (i) => left + (i + 0.5) * cw
  ctx.textBaseline = 'alphabetic'
  ctx.lineCap = 'round'

  // ---- 1. ruban vu de dessus ----
  const yR = area * (phone ? 0.1 : 0.12)
  const hR = area * (phone ? 0.1 : 0.09)
  ctx.fillStyle = GREY
  ctx.font = font(phone ? 10 : 12)
  ctx.textAlign = 'left'
  ctx.fillText(phone ? 'vue de dessus' : 'vue de dessus · rouge = aimantation vers le haut ↑ · bleu = vers le bas ↓ · blanc = la paroi', left, yR - 8)
  for (let i = 0; i < nx; i++) {
    ctx.fillStyle = mzColor(core.mz[i])
    ctx.fillRect(left + i * cw, yR, cw + 0.8, hR)
  }

  // ---- 2. vue de côté d'ensemble ----
  const yO = area * (phone ? 0.36 : 0.36)
  const stepO = Math.max(3, Math.round(14 / cw))
  const LO = Math.min(cw * stepO * 0.5, area * 0.07)
  ctx.fillStyle = GREY
  ctx.fillText(phone ? 'vue de côté' : 'vue de côté, tout le ruban · une flèche par groupe de spins', left, yO - LO - 12)
  ctx.lineWidth = phone ? 1.6 : 2
  for (let i = Math.floor(stepO / 2); i < nx; i += stepO) spin(core, i, xOf(i), yO, LO, Math.max(4, LO * 0.5))(ctx)

  // ---- 3. zoom sur la paroi ----
  const center = info.xw === null ? null : Math.round(info.xw / (info.length / nx) - 0.5)
  if (center !== null) {
    const half = Math.floor(ZOOM_CELLS / 2)
    const i0 = Math.max(0, Math.min(nx - ZOOM_CELLS, center - half))
    const yZ = area * (phone ? 0.72 : 0.7)
    const zw = w / ZOOM_CELLS
    const LZ = Math.min(zw * 0.46, area * 0.12)
    const headZ = Math.max(6, Math.min(13, LZ * 0.42))
    // cadre de la zone zoomée sur la vue d'ensemble, relié au zoom
    const xa = left + i0 * cw
    const xb = left + (i0 + ZOOM_CELLS) * cw
    ctx.strokeStyle = 'rgba(226, 184, 74, 0.55)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(xa, yO - LO - 4, xb - xa, 2 * LO + 8)
    ctx.beginPath()
    ctx.moveTo(xa, yO + LO + 4)
    ctx.lineTo(left, yZ - LZ - 22)
    ctx.moveTo(xb, yO + LO + 4)
    ctx.lineTo(left + w, yZ - LZ - 22)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = GREY
    ctx.textAlign = 'left'
    ctx.font = font(phone ? 10 : 12)
    ctx.fillText(phone ? 'zoom sur la paroi' : 'zoom sur la paroi · une flèche par cellule de 3 nm · ⊙ / ⊗ : aimantation vers toi / à l’opposé', left, yZ - LZ - 8)
    ctx.lineWidth = phone ? 2.2 : 3
    for (let k = 0; k < ZOOM_CELLS; k++) spin(core, i0 + k, left + (k + 0.5) * zw, yZ, LZ, headZ)(ctx)

    // repère de la paroi dans le zoom, avec sa largeur
    const Xz = left + (info.xw / (info.length / nx) - i0) * zw
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(Xz, yZ - LZ - 2)
    ctx.lineTo(Xz, yZ + LZ + 8)
    ctx.stroke()
    ctx.setLineDash([])
    const by = yZ + LZ + 18
    if (info.width !== null) {
      const hw = (info.width / (info.length / nx)) * zw
      ctx.beginPath()
      ctx.moveTo(Xz - hw, by - 5)
      ctx.lineTo(Xz - hw, by + 5)
      ctx.moveTo(Xz - hw, by)
      ctx.lineTo(Xz + hw, by)
      ctx.moveTo(Xz + hw, by - 5)
      ctx.lineTo(Xz + hw, by + 5)
      ctx.stroke()
    }
    ctx.fillStyle = GOLD
    ctx.font = font(phone ? 11 : 13, 600)
    ctx.textAlign = 'center'
    const parts = [
      info.width !== null ? `Δ = ${info.width.toFixed(1)} nm` : null,
      info.type ? (info.type === 'en précession' ? 'paroi en précession (elle tourne sur elle-même)' : `paroi de ${info.type}`) : null,
      info.v !== null ? `${Math.abs(info.v) < 1 ? 0 : Math.round(info.v)} m/s` : null,
    ].filter(Boolean)
    ctx.fillText(parts.join(' · '), left + w / 2, by + 20)

    // position de la paroi sur le ruban
    const X = left + (info.xw / info.length) * w
    ctx.strokeStyle = GOLD
    ctx.beginPath()
    ctx.moveTo(X, yR + hR + 3)
    ctx.lineTo(X, yR + hR + 12)
    ctx.stroke()
  } else {
    ctx.fillStyle = GOLD
    ctx.textAlign = 'center'
    ctx.font = font(phone ? 11 : 13, 600)
    ctx.fillText('La paroi est sortie du ruban · « Relancer » pour la remettre', left + w / 2, area * 0.66)
  }

  // ---- alertes ----
  const warn = []
  if (info.inPlane) warn.push('K ≤ 0 : l’aimantation se couche dans le plan, plus de domaines ↑ / ↓')
  if (info.unstable) warn.push(`D dépasse Dc ≈ ${info.Dc.toFixed(1)} mJ/m² : la paroi n’est plus stable`)
  if (info.tooThin) warn.push('Paroi plus fine qu’une cellule de calcul : résultat approximatif')
  ctx.fillStyle = '#ff9f80'
  ctx.textAlign = 'left'
  ctx.font = font(phone ? 10 : 12)
  warn.forEach((t, k) => ctx.fillText('⚠ ' + t, left, area * (phone ? 0.9 : 0.86) + k * 17))

  // ---- repères ----
  const yb = yR + hR + (phone ? 16 : 20)
  ctx.font = font(phone ? 10 : 12, 600)
  ctx.textAlign = 'left'
  ctx.fillStyle = rgb(RED)
  ctx.fillText('domaine ↑', left, yb)
  ctx.textAlign = 'right'
  ctx.fillStyle = rgb(BLUE)
  ctx.fillText('domaine ↓', left + w, yb)
  const bar = (100 / info.length) * w
  ctx.strokeStyle = GREY
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(left + w / 2 - bar / 2, yb - 4)
  ctx.lineTo(left + w / 2 + bar / 2, yb - 4)
  ctx.stroke()
  ctx.fillStyle = GREY
  ctx.textAlign = 'center'
  ctx.font = font(phone ? 9 : 11)
  ctx.fillText('100 nm', left + w / 2, yb + 10)
}
