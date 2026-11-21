// Magnétomètre du téléphone (API Generic Sensor, Chrome Android).
//
// Disponibilité : l'interface `Magnetometer` n'existe dans Chrome Android que
// si le réglage chrome://flags/#enable-generic-sensor-extra-classes est
// activé, et seulement sur une page sécurisée (https ou localhost). Safari
// (iPhone) ne la fournit pas.
//
// Mesure : champ (µT) dans le repère du téléphone — x vers la droite de
// l'écran, y vers le haut de l'écran, z sortant de l'écran. C'est le repère de
// la simulation vue à l'écran : la perturbation s'y reporte directement.
//
// On ne garde que la PERTURBATION : au démarrage (et sur « Recalibrer »), le
// champ ambiant (Terre, environnement) est moyenné et pris comme zéro.

const CALIB_SAMPLES = 10 // ~0,5 s à 20 Hz
const SMOOTH = 0.3 // lissage exponentiel par mesure
const DEADZONE = 3 // µT : en dessous, la perturbation est ignorée (bruit, dérive)

export function magnetometerSupport() {
  if (typeof window === 'undefined') return 'none'
  if (!window.isSecureContext) return 'insecure'
  if ('Magnetometer' in window) return 'ok'
  return /Android/i.test(navigator.userAgent) ? 'flag' : 'none'
}

export class PhoneMagnetometer {
  constructor(onStatus) {
    this.onStatus = onStatus
    this.sensor = null
    this.base = null
    this.acc = []
    this.d = [0, 0, 0]
  }

  start() {
    try {
      const s = new window.Magnetometer({ frequency: 20 })
      s.addEventListener('reading', () => this.onReading(s.x, s.y, s.z))
      s.addEventListener('error', (e) => {
        const n = e.error && e.error.name
        this.onStatus(
          n === 'NotAllowedError'
            ? 'Accès au capteur refusé : autorise « Capteurs de mouvement » pour ce site dans Chrome.'
            : n === 'NotReadableError'
              ? 'Ce téléphone n’a pas de magnétomètre utilisable.'
              : 'Erreur du capteur : ' + (e.error ? e.error.message : 'inconnue'),
        )
      })
      s.start()
      this.sensor = s
      this.recalibrate()
    } catch (err) {
      this.onStatus('Impossible de démarrer le magnétomètre : ' + err.message)
    }
  }

  stop() {
    if (this.sensor) this.sensor.stop()
    this.sensor = null
    this.d = [0, 0, 0]
  }

  // Le champ ambiant actuel devient le zéro (à refaire si on tourne le téléphone).
  recalibrate() {
    this.base = null
    this.acc = []
    this.d = [0, 0, 0]
    this.onStatus('Calibration… garde le téléphone immobile, loin des aimants.')
  }

  onReading(x, y, z) {
    if (x === null || x === undefined) return
    if (!this.base) {
      this.acc.push([x, y, z])
      if (this.acc.length >= CALIB_SAMPLES) {
        const n = this.acc.length
        this.base = [0, 1, 2].map((k) => this.acc.reduce((s, v) => s + v[k], 0) / n)
        this.onStatus('ok')
      }
      return
    }
    const raw = [x - this.base[0], y - this.base[1], z - this.base[2]]
    for (let k = 0; k < 3; k++) this.d[k] += (raw[k] - this.d[k]) * SMOOTH
  }

  // Perturbation lissée (µT), nulle sous le seuil de bruit.
  delta() {
    const [x, y, z] = this.d
    return Math.hypot(x, y, z) < DEADZONE ? [0, 0, 0] : [x, y, z]
  }
}
