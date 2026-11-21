// Nappe de synthétiseur ambient pilotée par l'état du film magnétique.
// Web Audio pur, sans dépendance.
//
// Deux échelles de temps :
//  - en continu (~10 fois par seconde), le TIMBRE suit le film : volume, filtre,
//    désaccord, souffle, écho, panoramique. Tout est lissé sur ~1 s.
//  - l'HARMONIE (accord, mode, nombre de notes, tonalité) ne change que sur un
//    PIC DE CHANGEMENT de l'état du film (voir peaks.js) : un geste franc
//    (aimant posé, champ modifié, skyrmion créé…) fait tourner la musique,
//    l'agitation de fond non. Plus le pic est fort, plus le saut est grand.
//
// Chaque monde a son PROFIL : instrument, registre, tonalité, type d'accords,
// modes, textures. Le son évoque la nature du champ : le skyrmion est un trou
// (grave, sourd), le vortex tourne (les voix circulent dans l'espace stéréo,
// décalées en phase), le labyrinthe est dense et granuleux.
//
// Entrées (update) : world, activity ∈ [0,1], walls ∈ [0,1], mz ∈ [-1,1],
// inPlane ∈ [0,1], circulation, Q, magnet { x, strength ∈ [0,1], pole } ou null.

import { PeakDetector, featureVector } from './peaks.js'

// Modes (intervalles en demi-tons depuis la tonique).
export const SCALES = {
  auto: { label: 'Auto (selon le monde)' },
  penta: { label: 'Pentatonique', steps: [0, 2, 4, 7, 9] },
  lydian: { label: 'Lydien', steps: [0, 2, 4, 6, 7, 9, 11] },
  ionian: { label: 'Majeur', steps: [0, 2, 4, 5, 7, 9, 11] },
  mixolydian: { label: 'Mixolydien', steps: [0, 2, 4, 5, 7, 9, 10] },
  dorian: { label: 'Dorien', steps: [0, 2, 3, 5, 7, 9, 10] },
  aeolian: { label: 'Mineur', steps: [0, 2, 3, 5, 7, 8, 10] },
  phrygian: { label: 'Phrygien', steps: [0, 1, 3, 5, 7, 8, 10] },
}

// Profils sonores par monde.
//  voice : oscillateurs de chaque voix (forme, rapport de fréquence, sens du
//          désaccord, niveau) ; chord : degrés de l'accord dans la gamme ;
//  progression : degrés de départ des accords successifs ;
//  mode(f) : gamme en mode « auto » ; bell : cloche quand Q change (null = sans).
export const PROFILES = {
  // Le trou : un skyrmion est un creux dans l'aimantation. Son grave et sourd
  // (sinus, octave basse, filtre fermé, sous-basse permanente) ; il ne
  // s'éclaircit que quand le film s'agite. Les skyrmions qui naissent ou
  // meurent font des « gouttes » étouffées.
  skyrmion: {
    root: 45, // la grave
    voice: [
      { type: 'sine', ratio: 1, cents: 0, level: 0.5 },
      { type: 'triangle', ratio: 0.5, cents: -1, level: 0.38 },
      { type: 'sine', ratio: 2, cents: 1, level: 0.06 },
    ],
    chord: [0, 2, 4, 6, 8],
    progression: [0, 3, 5, 4, 1, 2],
    mode: (f) => (f.mz > 0.5 ? 'dorian' : f.mz > -0.5 ? 'aeolian' : 'phrygian'),
    detune: [2, 8],
    filter: { base: 260, act: 1800, walls: 500, q: 0.7 },
    lfo: { rate: 0.04, depth: 60 },
    rotation: { rate: 0.04, pan: 0.2, amp: 0.05, pitch: 0 },
    noise: { level: 0, freq: 3000, q: 1 },
    delay: { time: 0.45, fb: 0.3, send: 0.12 },
    reverb: 0.7,
    sub: 0.14,
    bell: { stable: 1, gap: 6, ratio: 2, decay: 3, octave: 1, muffled: true },
  },
  // Dédale : dents de scie et carré grave, modes sombres, filtre résonant qui
  // pulse, souffle granuleux qui suit les parois, échos denses.
  labyrinth: {
    root: 50, // ré
    voice: [
      { type: 'sawtooth', ratio: 1, cents: -1, level: 0.3 },
      { type: 'sawtooth', ratio: 1, cents: 1, level: 0.3 },
      { type: 'square', ratio: 0.5, cents: 0, level: 0.2 },
    ],
    chord: [0, 2, 4, 6, 8],
    progression: [0, 5, 3, 6, 4, 2],
    mode: (f) => (f.mz > 0.3 ? 'dorian' : f.mz > -0.3 ? 'aeolian' : 'phrygian'),
    detune: [8, 30],
    filter: { base: 200, act: 2200, walls: 1200, q: 4 },
    lfo: { rate: 0.22, depth: 350 },
    rotation: { rate: 0.1, pan: 0.25, amp: 0.1, pitch: 0 },
    noise: { level: 0.06, freq: 700, q: 0.8 },
    delay: { time: 0.62, fb: 0.5, send: 0.3 },
    reverb: 0.6,
    sub: 0,
    bell: { stable: 2.5, gap: 15, ratio: 1.41, decay: 6, octave: 0 },
  },
  // Tourbillon : orgue doux (quinte ajoutée), accords en quartes. Les voix
  // tournent autour de l'auditeur, chacune décalée en phase (panoramique,
  // volume et légère hauteur, comme une cabine Leslie), dans le sens de
  // l'enroulement du vortex ; plus vite quand le film s'agite ou que le cœur
  // se décale.
  vortex: {
    root: 53, // fa
    voice: [
      { type: 'triangle', ratio: 1, cents: 0, level: 0.4 },
      { type: 'sine', ratio: 1.5, cents: 1, level: 0.18 },
      { type: 'sine', ratio: 0.5, cents: -1, level: 0.35 },
    ],
    chord: [0, 3, 6, 9, 12],
    progression: [0, 4, 1, 5, 3],
    mode: (f) => (f.inPlane > 0.25 ? 'lydian' : 'mixolydian'),
    detune: [3, 8],
    filter: { base: 600, act: 2500, walls: 300, q: 2 },
    lfo: { rate: 0.08, depth: 150 },
    rotation: { rate: 0.15, pan: 0.9, amp: 0.35, pitch: 6 },
    noise: { level: 0.025, freq: 2500, q: 2 },
    delay: { time: 0.5, fb: 0.45, send: 0.25 },
    reverb: 0.8,
    sub: 0,
    bell: { stable: 1.5, gap: 8, ratio: 2, decay: 5, octave: 1 },
  },
}

const VOICES = 5
const WARMUP = 3 // s sans pic après un changement de monde
const FALLBACK = 45 // s : sans aucun pic, l'accord avance quand même
const Q_HYST = 0.75 // écart de Q (stable) qui fait sonner la cloche
const MOD_GAP = 30 // s minimum entre deux modulations
// Dispositions des voix (octaves ajoutées), variées sur les pics moyens.
const VOICINGS = [
  [0, 0, 0, 0, 0],
  [0, 1, 0, 1, 0],
  [-1, 0, 0, 0, 1],
]

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12)
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

function noteOf(root, steps, degree, octave = 0) {
  const n = steps.length
  const o = Math.floor(degree / n)
  return root + steps[((degree % n) + n) % n] + 12 * (o + octave)
}

// Sinusoïde déphasée de φ, pour des LFO synchrones décalés entre les voix.
function phaseWave(ctx, phi) {
  const real = new Float32Array([0, Math.sin(phi)])
  const imag = new Float32Array([0, Math.cos(phi)])
  return ctx.createPeriodicWave(real, imag, { disableNormalization: true })
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
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = impulse(ctx, 7)
    this.wet = ctx.createGain()
    this.reverb.connect(this.wet).connect(this.master)

    this.delay = ctx.createDelay(2)
    this.fb = ctx.createGain()
    const fbTone = ctx.createBiquadFilter()
    fbTone.type = 'lowpass'
    fbTone.frequency.value = 1800
    this.delay.connect(fbTone).connect(this.fb).connect(this.delay)
    this.delaySend = ctx.createGain()
    this.delaySend.connect(this.delay)
    this.delay.connect(this.reverb)
    this.delay.connect(this.master)

    // Nappe : voix -> filtre résonant -> panoramique -> bus (fondu entre
    // mondes) -> volume -> direct / délai / réverb.
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 400
    this.pan = ctx.createStereoPanner()
    this.bus = ctx.createGain()
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0.3
    const dry = ctx.createGain()
    dry.gain.value = 0.35
    this.filter.connect(this.pan).connect(this.bus).connect(this.padGain)
    this.padGain.connect(dry).connect(this.master)
    this.padGain.connect(this.reverb)
    this.padGain.connect(this.delaySend)

    // LFO sur la coupure : la nappe « respire ».
    this.lfo = ctx.createOscillator()
    this.lfoAmt = ctx.createGain()
    this.lfo.connect(this.lfoAmt).connect(this.filter.frequency)
    this.lfo.start()

    // Souffle : bruit blanc en boucle, filtré en bande.
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const nd = nb.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = nb
    noise.loop = true
    this.noiseBand = ctx.createBiquadFilter()
    this.noiseBand.type = 'bandpass'
    this.noiseGain = ctx.createGain()
    this.noiseGain.gain.value = 0
    noise.connect(this.noiseBand).connect(this.noiseGain).connect(this.pan)
    noise.start()

    // Voix : 3 oscillateurs (formes définies par le profil) -> niveau de la
    // note -> trémolo -> panoramique propre -> filtre.
    // Rotation : chaque voix a deux LFO de même fréquence, déphasés de
    // 2π·v/5 d'une voix à l'autre. Le premier la promène gauche/droite, le
    // second (en quadrature) module son volume (devant/derrière) et sa hauteur
    // (effet Doppler). Toutes les voix circulent ainsi l'une après l'autre.
    this.voices = []
    this.rotDir = 1
    for (let v = 0; v < VOICES; v++) {
      const g = ctx.createGain()
      g.gain.value = 0
      const trem = ctx.createGain()
      const vp = ctx.createStereoPanner()
      g.connect(trem).connect(vp).connect(this.filter)
      const lfoPan = ctx.createOscillator()
      const lfoQuad = ctx.createOscillator()
      const panAmt = ctx.createGain()
      const ampAmt = ctx.createGain()
      const pitchAmt = ctx.createGain()
      panAmt.gain.value = 0
      ampAmt.gain.value = 0
      pitchAmt.gain.value = 0
      lfoPan.connect(panAmt).connect(vp.pan)
      lfoQuad.connect(ampAmt).connect(trem.gain)
      lfoQuad.connect(pitchAmt)
      const oscs = [0, 1, 2].map(() => {
        const osc = ctx.createOscillator()
        const lv = ctx.createGain()
        osc.connect(lv).connect(g)
        pitchAmt.connect(osc.detune)
        osc.start()
        return { osc, lv, ratio: 1, cents: 0 }
      })
      lfoPan.start()
      lfoQuad.start()
      this.voices.push({ g, trem, oscs, midi: null, lfoPan, lfoQuad, panAmt, ampAmt, pitchAmt })
    }
    this.setRotationDir(1)

    // Sous-basse : sinus, gonfle avec la force de l'aimant.
    this.sub = ctx.createOscillator()
    this.sub.type = 'sine'
    this.subGain = ctx.createGain()
    this.subGain.gain.value = 0
    this.sub.connect(this.subGain).connect(this.master)
    this.sub.start()

    // État harmonique.
    this.chordIdx = 0
    this.key = 0 // transposition accumulée par les grands pics (demi-tons)
    this.voicing = VOICINGS[0]
    this.mode = 'ionian'
    this.nNotes = 3
    this.poleShift = 0
    this.detune = 4
    this.qShown = null
    this.qSince = 0
    this.lastBell = -Infinity
    this.lastMod = -Infinity
    this.world = null
    this.applyProfile('skyrmion', true)
  }

  // Sens de rotation : l'ordre des phases entre voix fixe le sens de circulation.
  setRotationDir(dir) {
    this.rotDir = dir
    this.voices.forEach((voice, v) => {
      const phi = (dir * 2 * Math.PI * v) / VOICES
      voice.lfoPan.setPeriodicWave(phaseWave(this.ctx, phi))
      voice.lfoQuad.setPeriodicWave(phaseWave(this.ctx, phi + Math.PI / 2))
    })
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
    return SCALES[this.scale === 'auto' ? this.mode : this.scale].steps
  }

  // Change d'instrument : fondu au silence, nouveaux réglages, fondu retour.
  applyProfile(world, instant) {
    const P = PROFILES[world] || PROFILES.skyrmion
    this.world = world
    this.P = P
    const t = this.ctx.currentTime
    this.peaks = new PeakDetector()
    this.worldStart = t
    this.lastChange = t
    this.chordIdx = 0
    this.key = 0
    this.voicing = VOICINGS[0]
    this.qShown = null
    this.fresh = true // mode et nombre de notes pris à la prochaine mesure
    const set = () => {
      const now = this.ctx.currentTime
      for (const voice of this.voices) {
        voice.oscs.forEach((o, k) => {
          const d = P.voice[k]
          o.osc.type = d.type
          o.ratio = d.ratio
          o.cents = d.cents
          o.lv.gain.setValueAtTime(d.level, now)
        })
      }
      this.lfo.frequency.setValueAtTime(P.lfo.rate, now)
      this.lfoAmt.gain.setValueAtTime(P.lfo.depth, now)
      for (const voice of this.voices) {
        voice.panAmt.gain.setValueAtTime(P.rotation.pan, now)
        voice.ampAmt.gain.setValueAtTime(P.rotation.amp, now)
        voice.trem.gain.setValueAtTime(1 - P.rotation.amp, now)
        voice.pitchAmt.gain.setValueAtTime(P.rotation.pitch, now)
      }
      this.noiseBand.frequency.setValueAtTime(P.noise.freq, now)
      this.noiseBand.Q.setValueAtTime(P.noise.q, now)
      this.delay.delayTime.setValueAtTime(P.delay.time, now)
      this.fb.gain.setValueAtTime(P.delay.fb, now)
      this.wet.gain.setValueAtTime(P.reverb, now)
      this.filter.Q.setValueAtTime(P.filter.q, now)
      this.applyChord(true)
      this.bus.gain.setTargetAtTime(1, now, instant ? 0.01 : 0.8)
    }
    if (instant) {
      set()
      return
    }
    this.bus.gain.setTargetAtTime(0, t, 0.12)
    setTimeout(set, 500)
  }

  // Répartit les notes de l'accord courant sur les voix (glissando lent).
  applyChord(instant) {
    const t = this.ctx.currentTime
    const P = this.P
    const steps = this.steps()
    const root = P.root + this.key + this.poleShift
    const deg = P.progression[this.chordIdx % P.progression.length]
    for (let v = 0; v < VOICES; v++) {
      const voice = this.voices[v]
      voice.midi = noteOf(root, steps, deg + P.chord[v], this.voicing[v])
      this.tune(voice, instant ? 0 : 0.8)
      // Les voix au-delà du nombre de notes voulu s'éteignent doucement.
      const on = v < this.nNotes ? 0.22 / Math.sqrt(this.nNotes) : 0
      voice.g.gain.setTargetAtTime(on, t, instant ? 0.01 : 2.5)
    }
    this.sub.frequency.setTargetAtTime(midiHz(root - 24), t, instant ? 0.01 : 0.8)
  }

  tune(voice, tau) {
    const t = this.ctx.currentTime
    for (const o of voice.oscs) {
      const f = midiHz(voice.midi) * o.ratio * 2 ** ((o.cents * this.detune) / 1200)
      if (tau === 0) o.osc.frequency.setValueAtTime(f, t)
      else o.osc.frequency.setTargetAtTime(f, t, tau)
    }
  }

  // Pic de changement : l'harmonie avance, d'autant plus loin que le pic est fort.
  //  < 2,2 : accord suivant ; 2,2 à 3,5 : saut de deux accords et nouvelle
  //  disposition ; ≥ 3,5 : modulation (quarte ou quinte), retour au premier
  //  degré — au plus une modulation toutes les 30 s.
  harmonicStep(strength, pending) {
    const t = this.ctx.currentTime
    this.mode = pending.mode
    this.nNotes = pending.nNotes
    this.poleShift = pending.poleShift
    if (strength >= 3.5 && t - this.lastMod > MOD_GAP) {
      this.lastMod = t
      const moves = [5, -5, 7, -7].filter((m) => Math.abs(this.key + m) <= 7)
      this.key += moves[Math.floor(Math.random() * moves.length)]
      this.chordIdx = 0
      this.voicing = VOICINGS[0]
    } else if (strength >= 2.2) {
      this.chordIdx += 2
      this.voicing = VOICINGS[1 + Math.floor(Math.random() * 2)]
    } else {
      this.chordIdx += 1
    }
    this.lastChange = t
    this.applyChord(false)
    // Accent : le filtre s'ouvre d'un coup puis se referme (~2 s).
    const accent = Math.min(2400, 600 * strength)
    this.filter.detune.cancelScheduledValues(t)
    this.filter.detune.setValueAtTime(accent, t)
    this.filter.detune.setTargetAtTime(0, t + 0.05, 0.8)
  }

  // Cloche FM courte, très réverbérée, sur une note de l'accord.
  bell(up) {
    const B = this.P.bell
    const ctx = this.ctx
    const t = ctx.currentTime
    if (!B || t - this.lastBell < B.gap) return
    this.lastBell = t
    const P = this.P
    const deg = P.progression[this.chordIdx % P.progression.length] + P.chord[Math.floor(Math.random() * 3)]
    const f = midiHz(noteOf(P.root + this.key + this.poleShift, this.steps(), deg, B.octave + (up ? 1 : 0)))
    const car = ctx.createOscillator()
    const mod = ctx.createOscillator()
    const modAmt = ctx.createGain()
    const env = ctx.createGain()
    car.frequency.value = f
    mod.frequency.value = f * B.ratio
    modAmt.gain.setValueAtTime(f * 2, t)
    modAmt.gain.exponentialRampToValueAtTime(1, t + B.decay * 0.6)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.12, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t + B.decay)
    mod.connect(modAmt).connect(car.frequency)
    car.connect(env)
    if (B.muffled) {
      // Étouffée : passe par le filtre fermé de la nappe.
      env.connect(this.filter)
    } else {
      env.connect(this.reverb)
      env.connect(this.delaySend)
      env.connect(this.pan)
    }
    car.start(t)
    mod.start(t)
    car.stop(t + B.decay + 0.1)
    mod.stop(t + B.decay + 0.1)
  }

  update(f) {
    if (!this.running) return
    if (f.world && f.world !== this.world) this.applyProfile(f.world, false)
    const P = this.P
    const t = this.ctx.currentTime
    const a = clamp01(f.activity)
    const walls = clamp01(f.walls)
    const inPlane = clamp01(f.inPlane || 0)
    const m = f.magnet

    // --- Timbre, en continu ---
    this.padGain.gain.setTargetAtTime(0.18 + 0.5 * a, t, 1.2)
    this.filter.frequency.setTargetAtTime(P.filter.base + P.filter.act * a * a + P.filter.walls * walls, t, 1.5)
    this.detune = P.detune[0] + P.detune[1] * walls
    for (const voice of this.voices) if (voice.midi !== null) this.tune(voice, 1)
    this.delaySend.gain.setTargetAtTime(P.delay.send * (0.6 + 1.5 * walls), t, 2)
    this.noiseGain.gain.setTargetAtTime(P.noise.level * (0.25 + 1.5 * walls) * (0.3 + a), t, 1)
    this.pan.pan.setTargetAtTime(m ? (m.x * 2 - 1) * 0.7 : 0, t, 0.6)
    this.subGain.gain.setTargetAtTime(P.sub + (m ? 0.25 * m.strength : 0), t, m ? 0.8 : 2)

    // Rotation : vitesse selon l'agitation et le décalage du cœur ; sens selon
    // l'enroulement (change seulement si l'enroulement est net).
    const rate = P.rotation.rate * (1 + 3 * a + 2 * inPlane)
    for (const voice of this.voices) {
      voice.lfoPan.frequency.setTargetAtTime(rate, t, 2)
      voice.lfoQuad.frequency.setTargetAtTime(rate, t, 2)
    }
    const circ = f.circulation || 0
    if (Math.abs(circ) > 0.2 && Math.sign(circ) !== this.rotDir) this.setRotationDir(Math.sign(circ))

    // --- Cloche : Q s'écarte franchement de sa dernière valeur et y reste ---
    if (this.qShown === null) this.qShown = f.Q
    if (Math.abs(f.Q - this.qShown) > Q_HYST) {
      if (!this.qSince) this.qSince = t
      if (P.bell && t - this.qSince > P.bell.stable) {
        // Pas de cloche pendant que le nouveau monde se met en place.
        if (t - this.worldStart > WARMUP) this.bell(Math.abs(f.Q) > Math.abs(this.qShown))
        this.qShown = f.Q
        this.qSince = 0
      }
    } else this.qSince = 0

    // --- Harmonie, seulement sur un pic (ou après un long calme) ---
    const pending = {
      mode: P.mode({ ...f, inPlane }),
      nNotes: Math.min(VOICES, 2 + Math.min(Math.round(Math.abs(this.qShown)), 2) + (walls > 0.2 ? 1 : 0)),
      poleShift: m && m.pole === 'S' ? 7 : 0,
    }
    if (this.fresh) {
      // Nouveau monde : l'harmonie part directement de l'état mesuré.
      this.fresh = false
      Object.assign(this, pending)
      this.applyChord(false)
    }
    const peak = this.peaks.push(t, featureVector({ ...f, inPlane }))
    if (peak && t - this.worldStart > WARMUP) this.harmonicStep(peak, pending)
    else if (t - this.lastChange > FALLBACK) this.harmonicStep(1, pending)
  }
}
