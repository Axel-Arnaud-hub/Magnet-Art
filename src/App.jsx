import { useCallback, useEffect, useRef, useState } from 'react'
import FieldCanvas from './components/FieldCanvas.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import { WORLDS, Simulation, fitToAspect, worldPhys } from './sim/Simulation.js'
import { AmbientEngine } from './audio/AmbientEngine.js'

const DEFAULT_WORLD = 'skyrmion'

// Monde + paramètres réglables. Plein écran : le film prend le ratio de la fenêtre.
function makeSim(world, phys) {
  const params = { ...WORLDS[world], ...phys }
  const p = params.fill ? fitToAspect(params, window.innerHeight / window.innerWidth) : params
  return new Simulation(p)
}

export default function App() {
  const [world, setWorld] = useState(DEFAULT_WORLD)
  const [phys, setPhysState] = useState(() => worldPhys(DEFAULT_WORLD))
  const [sim, setSim] = useState(() => makeSim(DEFAULT_WORLD, worldPhys(DEFAULT_WORLD)))
  const [running, setRunning] = useState(true)
  const [view, setView] = useState({ mode: 'wheel', wheelPalette: 'hsl', linearPalette: 'redblue', arrows: false })
  const [speed, setSpeed] = useState(1)
  // Interaction au toucher : graine de skyrmion (clic) ou aimant (suit le pointeur).
  const [tool, setTool] = useState({ kind: 'magnet', strength: 2500, height: 30, pole: 'N' })
  const [stats, setStats] = useState({ t: 0, mz: 1, Q: 0 })
  // Son : le moteur est créé au premier clic (les navigateurs l'exigent).
  const engine = useRef(null)
  const [audio, setAudioState] = useState({ on: false, volume: 0.6, scale: 'auto' })

  const setAudio = useCallback(async (next) => {
    setAudioState(next)
    if (next.on && !engine.current) engine.current = new AmbientEngine()
    const e = engine.current
    if (!e) return
    e.setVolume(next.volume)
    if (e.scale !== next.scale) e.setScale(next.scale)
    if (next.on && !e.wanted) await e.start()
    else if (!next.on && e.wanted) await e.stop()
  }, [])

  // A, K, D, B, démag : appliqués en direct, sans réinitialiser le film.
  const setPhys = useCallback(
    (next) => {
      setPhysState(next)
      sim.setPhysics(next)
    },
    [sim],
  )

  const chooseWorld = useCallback((id) => {
    const p = worldPhys(id)
    setWorld(id)
    setPhysState(p)
    setSim(makeSim(id, p))
    setRunning(true)
  }, [])

  // Relance le monde courant avec les réglages actuels.
  const launch = useCallback(() => {
    setSim(makeSim(world, phys))
    setRunning(true)
  }, [world, phys])

  const toggle = useCallback(() => setRunning((r) => !r), [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea')) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'r' || e.key === 'R') {
        launch()
      } else if (e.key === 'h' || e.key === 'H') {
        document.body.classList.toggle('hide-ui')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [launch, toggle])

  return (
    <>
      <FieldCanvas sim={sim} running={running} view={view} speed={speed} tool={tool} onStats={setStats} engine={engine} />
      <ControlPanel
        world={world}
        onWorld={chooseWorld}
        phys={phys}
        setPhys={setPhys}
        running={running}
        onLaunch={launch}
        onToggle={toggle}
        view={view}
        setView={setView}
        speed={speed}
        setSpeed={setSpeed}
        stats={stats}
        tool={tool}
        setTool={setTool}
        audio={audio}
        setAudio={setAudio}
      />
    </>
  )
}
