// Outils communs aux ateliers et aux quiz de la Découverte.
import { MODELS } from './vendor/aimantarium.js'

// Hôte minimal attendu par les simulations du prototype.
export function makeHost(toast) {
  return { toast, setParamUI() {}, sfx() {}, click() {}, buzz() {} }
}

export function createSim(modelId, host) {
  const def = MODELS.find((m) => m.id === modelId)
  const defaults = {}
  def.params.forEach((q) => (defaults[q.id] = q.value))
  return def.create(host, defaults)
}

// Applique des réglages puis, éventuellement, une action (comme le prototype).
export function applySet(sim, set, act) {
  if (set) for (const k of Object.keys(set)) sim.setParam(k, set[k])
  if (act) sim.action(act)
}

// Mémoire de la session : réglages de chaque atelier (conservés entre
// l'atelier et son quiz) et question où chaque quiz s'est arrêté.
const exploreSettings = {}
const quizProgress = {}

export const savedSettings = (chapterId) => exploreSettings[chapterId] || {}
export function rememberSetting(chapterId, key, value) {
  exploreSettings[chapterId] = { ...savedSettings(chapterId), [key]: value }
}

export const savedQuestion = (chapterId) => quizProgress[chapterId] || 0
export function rememberQuestion(chapterId, index) {
  quizProgress[chapterId] = index
}
