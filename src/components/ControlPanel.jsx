import { useState } from 'react'
import { MATERIALS, INITIAL_STATES, SHAPES, PARAM_SPEC, presetParams } from '../sim/Simulation.js'

const MATERIAL_KEYS = new Set(['Ms', 'A', 'K', 'D', 'alpha'])

function NumberField({ spec, value, onChange }) {
  const [key, label, unit, min, max, step] = spec
  return (
    <label className="row">
      <span className="lbl">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(key, e.target.value)}
      />
      <span className="unit">{unit}</span>
    </label>
  )
}

function Group({ title, children }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      {children}
    </fieldset>
  )
}

export default function ControlPanel({ draft, setDraft, dirty, running, onLaunch, onToggle, view, setView, speed, setSpeed, stats, grid }) {
  // Sur téléphone, le panneau démarre replié pour laisser voir la simulation.
  const [open, setOpen] = useState(() => window.innerWidth > 640)

  const set = (key, value) =>
    setDraft((d) => ({ ...d, [key]: value, ...(MATERIAL_KEYS.has(key) ? { material: 'custom' } : {}) }))

  const choosePreset = (id) => {
    if (id !== 'custom') setDraft(presetParams(id))
  }

  const fields = (group) =>
    PARAM_SPEC[group].map((spec) => <NumberField key={spec[0]} spec={spec} value={draft[spec[0]]} onChange={set} />)

  return (
    <aside className={'panel' + (open ? '' : ' closed')}>
      <header>
        <button className="ghost" onClick={() => setOpen(!open)} title="Afficher / masquer" aria-label={open ? 'Replier' : 'Déplier'}>
          {open ? '–' : '+'}
        </button>
        <span className="stats">
          t {(stats.t * 1e9).toFixed(2)} ns · ⟨mz⟩ {stats.mz.toFixed(2)} · Q {stats.Q.toFixed(2)}
        </span>
        <button className="ghost play" onClick={onToggle} aria-label={running ? 'Pause' : 'Reprendre'}>
          {running ? '❚❚' : '▶'}
        </button>
      </header>

      {open && (
        <div className="body">
          <Group title="Préréglage">
            <select value={draft.material} onChange={(e) => choosePreset(e.target.value)}>
              {Object.entries(MATERIALS).map(([id, m]) => (
                <option key={id} value={id}>{m.label}</option>
              ))}
              <option value="custom">Personnalisé</option>
            </select>
          </Group>

          <Group title="Champ extérieur">{fields('field')}</Group>
          <Group title="Matériau">{fields('material')}</Group>
          <Group title="Géométrie">
            <label className="row check">
              <input type="checkbox" checked={draft.fill} onChange={(e) => set('fill', e.target.checked)} />
              <span>Plein écran (ratio de la fenêtre)</span>
            </label>
            {fields('geometry')}
            {draft.fill && (
              <p className="hint">
                Lx et Nx fixent la taille de cellule ; maillage actuel {grid[0]}×{grid[1]} ({Math.round(grid[2])}×{Math.round(grid[3])} nm)
              </p>
            )}
            <label className="row">
              <span className="lbl">Forme</span>
              <select value={draft.shape} onChange={(e) => set('shape', e.target.value)}>
                {SHAPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="row check">
              <input type="checkbox" checked={draft.demag} onChange={(e) => set('demag', e.target.checked)} />
              <span>Champ démagnétisant (FFT, lent)</span>
            </label>
          </Group>
          <Group title="État initial">
            <select value={draft.initial} onChange={(e) => set('initial', e.target.value)}>
              {INITIAL_STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {fields('seed')}
          </Group>

          <Group title="Affichage">
            <label className="row">
              <span className="lbl">Couleur</span>
              <select value={view.mode} onChange={(e) => setView({ ...view, mode: e.target.value })}>
                <option value="wheel">Direction</option>
                <option value="mz">mz</option>
                <option value="mx">mx</option>
                <option value="my">my</option>
              </select>
            </label>
            <label className="row check">
              <input type="checkbox" checked={view.arrows} onChange={(e) => setView({ ...view, arrows: e.target.checked })} />
              <span>Flèches</span>
            </label>
            <label className="row">
              <span className="lbl">Vitesse</span>
              <input type="range" min="0.1" max="4" step="0.1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              <span className="unit">×{speed.toFixed(1)}</span>
            </label>
          </Group>

          <div className="actions">
            <button className={'primary' + (dirty ? ' dirty' : '')} onClick={onLaunch} title="Relancer (R)">
              {dirty ? 'Lancer' : 'Relancer'}
            </button>
            <button onClick={onToggle} title="Pause (Espace)">{running ? 'Pause' : 'Reprendre'}</button>
          </div>
          <p className="hint">Toucher le film : injecter un skyrmion</p>
        </div>
      )}
    </aside>
  )
}
