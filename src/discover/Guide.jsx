import { useEffect, useRef, useState } from 'react'
import Layout from '../pages/Layout.jsx'
import { DECOUVERTE, GRANDEURS, MODELS, frNum } from './vendor/aimantarium.js'
import './guide.css'

// Parcours guidé d'un chapitre : la simulation du prototype à gauche,
// les étapes « fais / remarque / comprends » à droite.

function createSim(id, host) {
  const def = MODELS.find((m) => m.id === id)
  const defaults = {}
  def.params.forEach((q) => (defaults[q.id] = q.value))
  return { def, sim: def.create(host, defaults) }
}

const count = (done, i) => done[i] || 0
const subDone = (step, done, i) => count(done, i) >= (step.do[i].times || 1)
function firstOpen(step, done) {
  for (let i = 0; i < step.do.length; i++) if (!subDone(step, done, i)) return i
  return step.do.length
}

function choiceOk(c, sim) {
  if (typeof c.ok !== 'function') return !!c.ok
  try {
    return !!c.ok(sim)
  } catch {
    return false
  }
}

function fmtParam(q, v) {
  const d = q.digits !== undefined ? q.digits : q.step < 1 ? 2 : 0
  return frNum(v, d) + (q.unit ? ' ' + q.unit : '')
}

// Ligne « ce que calcule la simulation » (repris du prototype).
function readout(id, sim) {
  const o = sim.obs || {}
  const v = (x, d) => (Number.isFinite(x) ? frNum(x, d) : '—')
  switch (id) {
    case 'limaille': {
      const disp = { all: 'limaille + lignes', lines: 'lignes de champ', compass: 'boussoles' }[sim.p.disp] || 'limaille'
      const b = o.Bh === null || o.Bh === undefined ? 'pose le doigt dans l’image pour mesurer B' : '|B| sous le doigt ≈ ' + sim.fmtB(o.Bh)
      return `${sim.mags.length} aimant(s) · ${b} · ${disp}`
    }
    case 'wall':
      return `B = ${v(sim.p.Bz, 0)} mT · A = ${v(sim.p.A, 0)} pJ/m · K = ${v(sim.p.K, 0)} kJ/m³ · largeur de paroi ≈ ${v(o.wallW * 1e9, 1)} nm`
    case 'compass':
      return `B = ${v(sim.p.B, 0)} mT · α = ${v(sim.p.alpha, 2)} · rotation ≈ ${v(o.f, 1)} milliards de tours/s · angle m–B ≈ ${v(o.angle !== undefined ? o.angle : sim.angle, 0)}°`
    case 'paroi_pin':
      return (
        `B = ${v(sim.p.Bz, 1)} mT · paroi à ${v(sim.xw * 1e9, 0)} nm · ${sim.state || 'évolution'}` +
        (typeof sim.dep[0] === 'number' ? ` · décrochée de l’entaille 1 à ${v(sim.dep[0], 1)} mT` : '')
      )
    case 'labyrinthe':
      return (
        `B = ${v(sim.p.Bz, 0)} mT · ${o.phase || 'évolution'} · ${o.nBub || 0} bulle(s) · part de rouge ≈ ${v(50 * (1 + (o.mz || 0)), 0)} %` +
        (o.conv === false ? ' · relaxation en cours' : '')
      )
    case 'curie':
      return `T* = ${v(sim.p.T, 2)} (unités réduites, T_C* ≈ 2,27) · |M| ≈ ${v(o.A, 2)}`
    default:
      return ''
  }
}

function Quantities({ keys }) {
  return (
    <div className="g-qty">
      {keys.map((k) => (
        <div key={k} className="g-qty-item">
          <b>{GRANDEURS[k].sym}</b>
          <span>
            <strong>{GRANDEURS[k].name}</strong> {GRANDEURS[k].role}
          </span>
        </div>
      ))}
    </div>
  )
}

// Canvas de la simulation : boucle d'animation et toucher.
function Stage({ sim, onTouch }) {
  const ref = useRef(null)
  const touch = useRef(onTouch)
  useEffect(() => {
    touch.current = onTouch
  }, [onTouch])

  useEffect(() => {
    const c = ref.current
    const ctx = c.getContext('2d')
    let w = 0
    let h = 0
    let dpr = 1
    const fit = () => {
      const r = c.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = Math.max(10, r.width)
      h = Math.max(10, r.height)
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      draw()
    }
    // Redimensionner efface le canvas : on redessine aussitôt.
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      sim.draw(ctx, w, h)
    }
    const ro = new ResizeObserver(fit)
    ro.observe(c)

    let raf = 0
    let last = performance.now()
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
      last = now
      try {
        sim.update(dt, 1)
        draw()
      } catch (err) {
        console.error(err)
        cancelAnimationFrame(raf)
      }
    }
    fit()
    raf = requestAnimationFrame(frame)

    let drag = null
    const pos = (e) => {
      const r = c.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    const down = (e) => {
      drag = { x: e.clientX, y: e.clientY }
      c.setPointerCapture(e.pointerId)
      if (sim.pointer) sim.pointer('down', ...pos(e))
    }
    const move = (e) => {
      if (sim.pointer) sim.pointer(drag ? 'move' : 'hover', ...pos(e))
      if (!drag) return
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) touch.current()
      sim.drag(e.clientX - drag.x, e.clientY - drag.y)
      drag = { x: e.clientX, y: e.clientY }
    }
    const end = () => {
      drag = null
      if (sim.pointer) sim.pointer('up', 0, 0)
    }
    const leave = () => {
      if (!drag && sim.pointer) sim.pointer('leave', 0, 0)
    }
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)
    c.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', end)
      c.removeEventListener('pointercancel', end)
      c.removeEventListener('pointerleave', leave)
    }
  }, [sim])

  return <canvas ref={ref} className="g-canvas" />
}

const EMPTY = { index: 0, done: [], choice: null, verdict: null }

export default function Guide({ id }) {
  const g = DECOUVERTE.find((q) => q.id === id)
  const [toast, setToast] = useState('')
  const [{ def, sim }] = useState(() =>
    createSim(id, {
      toast: (m) => setToast(m),
      setParamUI() {},
      sfx() {},
      click() {},
      buzz() {},
    }),
  )
  const [st, setSt] = useState(EMPTY)
  // Rafraîchit la mesure et les curseurs (la simulation change sans React).
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3400)
    return () => clearTimeout(t)
  }, [toast])

  const n = DECOUVERTE.indexOf(g)
  const step = g.steps[st.index]

  const mark = (i) =>
    setSt((s) => {
      const sp = g.steps[s.index]
      if (!sp || i < 0 || i > firstOpen(sp, s.done)) return s
      const done = [...s.done]
      done[i] = count(done, i) + 1
      return { ...s, done }
    })

  // Manipulation « directement dans l'image » : validée au premier glissé.
  const onTouch = () =>
    setSt((s) => {
      const sp = g.steps[s.index]
      if (!sp) return s
      const i = firstOpen(sp, s.done)
      if (i >= sp.do.length || !sp.do[i].canvas || sp.do[i].actions) return s
      const done = [...s.done]
      done[i] = count(done, i) + 1
      return { ...s, done }
    })

  const runAction = (i, a) => {
    if (a.set) for (const k of Object.keys(a.set)) sim.setParam(k, a.set[k])
    if (a.act) sim.action(a.act)
    mark(i)
  }

  const pick = (k) => {
    const c = step.choices[k]
    const ok = choiceOk(c, sim)
    let truth = null
    if (!ok) {
      const t = step.choices.find((x) => typeof x.ok === 'function' && choiceOk(x, sim))
      truth = t ? t.t : null
    }
    setSt((s) => ({ ...s, choice: k, verdict: { ok, truth } }))
  }

  const go = (index) => {
    setSt({ ...EMPTY, index })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const slider = (pid, sub, disabled) => {
    const q = def.params.find((z) => z.id === pid)
    if (!q) return null
    const commit = () => {
      if (sub < 0) return
      const d = step.do[sub]
      let ok = true
      if (d && typeof d.until === 'function') {
        try {
          ok = !!d.until(sim)
        } catch {
          ok = false
        }
      }
      if (ok) mark(sub)
    }
    return (
      <label className="g-slider">
        <span>
          {q.label} <output>{fmtParam(q, sim.p[pid])}</output>
        </span>
        <input
          type="range"
          min={q.min}
          max={q.max}
          step={q.step || 'any'}
          value={sim.p[pid]}
          disabled={disabled}
          onChange={(e) => {
            sim.setParam(pid, Number(e.target.value))
            setTick((t) => t + 1)
          }}
          onPointerUp={commit}
          onKeyUp={commit}
        />
      </label>
    )
  }

  let panel
  if (!step) {
    const next = DECOUVERTE[n + 1]
    const qk = []
    g.steps.forEach((s) => (s.qty || []).forEach((k) => qk.includes(k) || qk.push(k)))
    panel = (
      <>
        <p className="g-eyebrow">CHAPITRE TERMINÉ</p>
        <p className="g-done">✓</p>
        <h3>Tu as exploré « {g.short} »</h3>
        <Quantities keys={qk} />
        <div className="g-foot">
          {next ? (
            <a className="g-btn primary" href={'#guide-' + next.id}>
              Chapitre suivant : {next.short} →
            </a>
          ) : (
            <a className="g-btn primary" href="#xp-sandbox">
              Essayer le bac à sable →
            </a>
          )}
          <button className="g-link" onClick={() => go(0)}>
            Recommencer
          </button>
        </div>
      </>
    )
  } else {
    const open = firstOpen(step, st.done)
    const all = open >= step.do.length
    const v = st.verdict
    const picked = st.choice !== null ? step.choices[st.choice] : null
    let fb = ''
    if (picked) {
      if (v.ok) fb = '✓ ' + (picked.fb || 'Oui.')
      else if (v.truth) fb = `↺ Pas tout à fait. La simulation montre plutôt : « ${v.truth} »` + (picked.fb ? ' ' + picked.fb : '')
      else fb = '↺ ' + (picked.fb || 'Regarde encore l’image, puis réponds.')
    }
    panel = (
      <>
        <p className="g-eyebrow">
          CHAPITRE {n + 1} · ÉTAPE {st.index + 1}/{g.steps.length}
        </p>
        <div className="g-progress" aria-hidden="true">
          {g.steps.map((_, i) => (
            <span key={i} className={i < st.index ? 'past' : i === st.index ? 'active' : ''} />
          ))}
        </div>
        <h3>{step.name}</h3>
        <p className="g-intro">{step.intro}</p>

        <div className="g-block">
          <p className="g-label">1 · FAIS</p>
          <ol className="g-do">
            {step.do.map((d, i) => {
              const state = subDone(step, st.done, i) ? 'done' : i === open ? 'active' : 'locked'
              const locked = state === 'locked'
              return (
                <li key={i} className={state}>
                  <span className="g-n">{state === 'done' ? '✓' : i + 1}</span>
                  <div>
                    <p>
                      {d.txt}
                      {d.times > 1 && (
                        <span className="g-count">
                          {' '}
                          {Math.min(count(st.done, i), d.times)} / {d.times}
                        </span>
                      )}
                    </p>
                    {d.actions && (
                      <div className="g-actions">
                        {d.actions.map((a, j) => (
                          <button key={j} className="g-btn" disabled={locked} onClick={() => runAction(i, a)}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {d.focus && slider(d.focus, i, locked)}
                    {d.canvas && !d.actions && <p className="g-hint">☝ Directement dans l’image.</p>}
                  </div>
                </li>
              )
            })}
          </ol>
          {step.focus && !step.do.some((d) => d.focus === step.focus) && (
            <>
              <p className="g-hint">Tu peux aussi régler à la main :</p>
              {slider(step.focus, -1, false)}
            </>
          )}
          <div className="g-live">
            <span>Ce que calcule la simulation</span>
            <b>{readout(id, sim) || '—'}</b>
          </div>
        </div>

        {!all ? (
          <p className="g-hint">Fais les manipulations dans l’ordre. La question viendra après.</p>
        ) : (
          <div className="g-block">
            <p className="g-label">2 · QU’AS-TU REMARQUÉ ?</p>
            <p>{step.notice}</p>
            {step.choices.map((c, k) => (
              <button key={k} className={'g-option' + (st.choice === k ? ' picked' : '')} onClick={() => pick(k)}>
                {c.t}
              </button>
            ))}
            {picked && <p className={'g-fb ' + (v.ok ? 'ok' : 'no')}>{fb}</p>}
          </div>
        )}

        {all && picked && (
          <>
            <div className="g-block g-explain">
              <p className="g-label">3 · CE QUI SE PASSE</p>
              <p>{step.explain}</p>
              <Quantities keys={step.qty || []} />
              <details>
                <summary>Jusqu’où croire le modèle ?</summary>
                <p>{step.limit}</p>
              </details>
            </div>
            <div className="g-foot">
              <button className="g-btn primary" onClick={() => go(st.index + 1)}>
                {st.index === g.steps.length - 1 ? 'Terminer le chapitre →' : 'Étape suivante →'}
              </button>
              <button className="g-link" onClick={() => setSt((s) => ({ ...s, done: [], choice: null, verdict: null }))}>
                Refaire l’expérience
              </button>
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <Layout current="decouverte" wide>
      <a className="g-back" href="#decouverte">
        ← La découverte
      </a>
      <h1 className="g-title">{g.title}</h1>
      <div className="g-lab">
        <div className="g-stage">
          <Stage sim={sim} onTouch={onTouch} />
          {toast && (
            <div className="g-toast" role="status">
              {toast}
            </div>
          )}
        </div>
        <section className="g-panel" aria-live="polite">
          {panel}
        </section>
      </div>
    </Layout>
  )
}
