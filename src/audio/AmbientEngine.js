// Nappe de synthétiseur ambient pilotée par l'état du film magnétique.
// Web Audio pur, sans dépendance. Toutes les modulations passent par
// setTargetAtTime (constantes de temps de l'ordre de la seconde) : le son
// évolue lentement même quand la simulation s'agite.
//
// Entrées (update, ~10 fois par seconde) :
//   activity ∈ [0, 1]  agitation de l'aimantation -> volume, ouverture du filtre
//   mz ∈ [-1, 1]       aimantation moyenne -> mode (lumineux / sombre)
//   Q                  charge topologique -> nombre de notes ; un saut = cloche
//   walls ∈ [0, 1]     part de parois -> désaccord, délai
//   magnet             { x ∈ [0, 1], strength ∈ [0, 1], pole } ou null

// Modes (intervalles en demi-tons depuis la tonique).
export const SCALES = {
  auto: { label: 'Auto (selon ⟨mz⟩)' },
  penta: { label: 'Pentatonique', steps: [0, 2, 4, 7, 9] },
  lydian: { label: 'Lydien', steps: [0, 2, 4, 6, 7, 9, 11] },
  ionian: { label: 'Majeur', steps: [0, 2, 4, 5, 7, 9, 11] },
  dorian: { label: 'Dorien', steps: [0, 2, 3, 5, 7, 9, 10] },
  aeolian: { label: 'Mineur', steps: [0, 2, 3, 5, 7, 8, 10] },
}

const ROOT = 50 // ré (D3)
const VOICES = 5
// Degrés de l'accord, empilés en tierces (1, 3, 5, 7, 9).
const CHORD = [0, 2, 4, 6, 8]
// Degrés de départ des accords successifs (I, IV, vi, V, ii, iii).
const PROGRESSION = [0, 3, 5, 4, 1, 2]

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12)
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

function noteOf(steps, degree, octave = 0) {
  const n = steps.length
  const o = Math.floor(degree / n)
  return ROOT + steps[((degree % n) + n) % n] + 12 * (o + octave)
}

// Réponse impulsionnelle stéréo : bruit à décroissance exponentielle.
function impulse(ctx, seconds) {
  const len = Math.round(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  }
  return buf
}

export class AmbientEngine {
  constructor() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.ctx = ctx
    this.scale = 'auto'
    this.volume = 0.6

    // Sortie : master -> compresseur -> haut-parleurs.
    this.master = ctx.createGain()
    this.master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    this.master.connect(comp).connect(ctx.destination)

    // Réverbération longue + délai filtré, en parallèle du signal direct.
    const reverb = ctx.createConvolver()
    reverb.buffer = impulse(ctx, 7)
    const wet = ctx.createGain()
    wet.gain.value = 0.75
    reverb.connect(wet).connect(this.master)
    this.reverb = reverb

    const delay = ctx.createDelay(2)
    delay.delayTime.value = 0.48
    const fb = ctx.createGain()
    fb.gain.value = 0.38
    const fbTone = ctx.createBiquadFilter()
    fbTone.type = 'lowpass'
    fbTone.frequency.value = 1800
    delay.connect(fbTone).connect(fb).connect(delay)
    this.delaySend = ctx.createGain()
    this.delaySend.gain.value = 0.15
    this.delaySend.connect(delay)
    delay.connect(reverb)
    delay.connect(this.master)

    // Bus de la nappe : filtre résonant -> panoramique -> direct / délai / réverb.
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 400
    this.filter.Q.value = 3
    this.pan = ctx.createStereoPanner()
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0.3
    const dry = ctx.createGain()
    dry.gain.value = 0.35
    this.filter.connect(this.pan).connect(this.padGain)
    this.padGain.connect(dry).connect(this.master)
    this.padGain.connect(reverb)
    this.padGain.connect(this.delaySend)

    // LFO très lent sur la coupure : la nappe « respire ».
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.06
    const lfoAmt = ctx.createGain()
    lfoAmt.gain.value = 150
    lfo.connect(lfoAmt).connect(this.filter.frequency)
    lfo.start()

    // Voix : deux dents de scie désaccordées + un triangle à l'octave basse.
    this.voices = []
    for (let v = 0; v < VOICES; v++) {
      const g = ctx.createGain()
      g.gain.value = 0
      g.connect(this.filter)
      const oscs = [
        { type: 'sawtooth', ratio: 1, cents: -1, level: 0.35 },
        { type: 'sawtooth', ratio: 1, cents: 1, level: 0.35 },
        { type: 'triangle', ratio: 0.5, cents: 0, level: 0.5 },
      ].map((o) => {
        const osc = ctx.createOscillator()
        osc.type = o.type
        const lv = ctx.createGain()
        lv.gain.value = o.level
        osc.connect(lv).connect(g)
        osc.start()
        return { osc, ...o }
      })
      this.voices.push({ g, oscs, midi: null })
    }

    // Sous-basse : sinus, gonfle avec la force de l'aimant.
    this.sub = ctx.createOscillator()
    this.sub.type = 'sine'
    this.sub.frequency.value = midiHz(ROOT - 24)
    this.subGain = ctx.createGain()
    this.subGain.gain.value = 0
    this.sub.connect(this.subGain).connect(this.master)
    this.sub.start()

    this.chordIdx = 0
    this.nextChange = ctx.currentTime + 6
    this.rootShift = 0
    this.detune = 6
    this.nNotes = 3
    this.qShown = null
    this.qCandidate = null
    this.qSince = 0
    this.lastBell = 0
    this.mz = 1
    this.applyChord(true)
  }

  get running() {
    return this.ctx.state === 'running'
  }

  async start() {
    this.wanted = true
    await this.ctx.resume()
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 1.5)
  }

  async stop() {
    this.wanted = false
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3)
    await new Promise((r) => setTimeout(r, 1200))
    if (!this.wanted) await this.ctx.suspend()
  }

  setVolume(v) {
    this.volume = v
    if (this.running) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2)
  }

  setScale(id) {
    this.scale = id
    this.applyChord(false)
  }

  steps() {
    if (this.scale !== 'auto') return SCALES[this.scale].steps
    // ⟨mz⟩ > 0 : lumineux ; ⟨mz⟩ < 0 : sombre.
    if (this.mz > 0.5) return SCALES.lydian.steps
    if (this.mz > 0) return SCALES.ionian.steps
    if (this.mz > -0.5) return SCALES.dorian.steps
    return SCALES.aeolian.steps
  }

  // Répartit les notes de l'accord courant sur les voix (glissando lent).
  applyChord(instant) {
    const t = this.ctx.currentTime
    const steps = this.steps()
    const deg = PROGRESSION[this.chordIdx % PROGRESSION.length]
    for (let v = 0; v < VOICES; v++) {
      const voice = this.voices[v]
      const midi = noteOf(steps, deg + CHORD[v]) + this.rootShift
      voice.midi = midi
      for (const o of voice.oscs) {
        const f = midiHz(midi) * o.ratio * 2 ** ((o.cents * this.detune) / 1200)
        if (instant) o.osc.frequency.value = f
        else o.osc.frequency.setTargetAtTime(f, t, 0.8)
      }
      // Les voix au-delà du nombre de notes voulu s'éteignent doucement.
      const on = v < this.nNotes ? 0.22 / Math.sqrt(this.nNotes) : 0
      voice.g.gain.setTargetAtTime(on, t, instant ? 0.01 : 2.5)
    }
  }

  // Cloche FM courte, très réverbérée, sur une note haute de la gamme.
  bell(up) {
    const ctx = this.ctx
    const t = ctx.currentTime
    if (t - this.lastBell < 1.2) return
    this.lastBell = t
    const steps = this.steps()
    const deg = PROGRESSION[this.chordIdx % PROGRESSION.length] + CHORD[Math.floor(Math.random() * 3)]
    const f = midiHz(noteOf(steps, deg, up ? 2 : 1) + this.rootShift)
    const car = ctx.createOscillator()
    const mod = ctx.createOscillator()
    const modAmt = ctx.createGain()
    const env = ctx.createGain()
    car.frequency.value = f
    mod.frequency.value = f * 3.5
    modAmt.gain.setValueAtTime(f * 2, t)
    modAmt.gain.exponentialRampToValueAtTime(1, t + 2.5)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.12, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 4)
    mod.connect(modAmt).connect(car.frequency)
    car.connect(env)
    env.connect(this.reverb)
    env.connect(this.delaySend)
    env.connect(this.pan)
    car.start(t)
    mod.start(t)
    car.stop(t + 4.1)
    mod.stop(t + 4.1)
  }

  update(f) {
    if (!this.running) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const a = clamp01(f.activity)
    const walls = clamp01(f.walls)

    // Agitation : volume et brillance.
    this.padGain.gain.setTargetAtTime(0.18 + 0.5 * a, t, 1.2)
    this.filter.frequency.setTargetAtTime(280 + 2600 * a * a + 900 * walls, t, 1.5)
    this.filter.Q.setTargetAtTime(2 + 6 * a, t, 1.5)
    // Parois : désaccord et délai.
    this.detune = 4 + 22 * walls
    this.delaySend.gain.setTargetAtTime(0.1 + 0.5 * walls, t, 2)

    // Aimant : stéréo, sous-basse, pôle sud = tonique une quinte au-dessus.
    const m = f.magnet
    this.pan.pan.setTargetAtTime(m ? (m.x * 2 - 1) * 0.7 : 0, t, 0.6)
    this.subGain.gain.setTargetAtTime(m ? 0.25 * m.strength : 0, t, m ? 0.8 : 2)
    const shift = m && m.pole === 'S' ? 7 : 0
    this.sub.frequency.setTargetAtTime(midiHz(ROOT - 24 + shift), t, 0.8)

    // Q (lissé) : nombre de notes ; un changement stable = cloche.
    const q = Math.round(f.Q)
    if (q !== this.qCandidate) {
      this.qCandidate = q
      this.qSince = t
    } else if (q !== this.qShown && t - this.qSince > 0.5) {
      if (this.qShown !== null) this.bell(Math.abs(q) > Math.abs(this.qShown))
      this.qShown = q
    }
    const nNotes = Math.min(VOICES, 2 + Math.min(Math.abs(this.qShown ?? 0), 2) + (walls > 0.2 ? 1 : 0))

    // Changement d'accord : plus fréquent quand ça bouge.
    let changed = nNotes !== this.nNotes || shift !== this.rootShift
    const prevMode = this.steps()
    this.mz = f.mz
    if (prevMode !== this.steps()) changed = true
    this.nNotes = nNotes
    this.rootShift = shift
    if (t > this.nextChange) {
      this.chordIdx++
      this.nextChange = t + 14 - 9 * a
      changed = true
    }
    if (changed) this.applyChord(false)
    else {
      // Met à jour le désaccord sans toucher aux notes.
      for (const voice of this.voices) {
        for (const o of voice.oscs) {
          if (!o.cents) continue
          const fr = midiHz(voice.midi) * o.ratio * 2 ** ((o.cents * this.detune) / 1200)
          o.osc.frequency.setTargetAtTime(fr, t, 1)
        }
      }
    }
  }
}
