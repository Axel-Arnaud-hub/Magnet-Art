import { useCallback, useEffect, useState } from 'react'
import FieldCanvas from './components/FieldCanvas.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import { DEFAULT_PARAMS, Simulation } from './sim/Simulation.js'

export default function App() {
  const [draft, setDraft] = useState(DEFAULT_PARAMS)
  const [applied, setApplied] = useState(DEFAULT_PARAMS)
  const [sim, setSim] = useState(() => new Simulation(DEFAULT_PARAMS))
  const [running, setRunning] = useState(true)
  const [view, setView] = useState({ mode: 'wheel', arrows: false })
  const [speed, setSpeed] = useState(1)
  const [stats, setStats] = useState({ t: 0, mz: 1, Q: 0 })

  const dirty = draft !== applied

  const launch = useCallback(() => {
    setSim(new Simulation(draft))
    setApplied(draft)
    setRunning(true)
  }, [draft])

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
      <FieldCanvas sim={sim} running={running} view={view} speed={speed} onStats={setStats} />
      <ControlPanel
        draft={draft}
        setDraft={setDraft}
        dirty={dirty}
        running={running}
        onLaunch={launch}
        onToggle={toggle}
        view={view}
        setView={setView}
        speed={speed}
        setSpeed={setSpeed}
        stats={stats}
      />
    </>
  )
}
