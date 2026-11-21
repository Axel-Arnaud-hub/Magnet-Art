import { useEffect, useRef } from 'react'
import { GLRenderer } from '../sim/glRenderer.js'
import { CpuRenderer, ComponentScale, computeLayout, drawArrows, toCell } from '../sim/renderer.js'

// Plein écran : boucle d'animation, intégration LLG et rendu.
// Canvas du dessous : champ (WebGL2, ou 2D en secours). Canvas du dessus : flèches.
export default function FieldCanvas({ sim, running, view, speed, onStats }) {
  const glRef = useRef(null)
  const overlayRef = useRef(null)
  const live = useRef({ sim, running, view, speed, onStats })

  useEffect(() => {
    live.current = { sim, running, view, speed, onStats }
  }, [sim, running, view, speed, onStats])

  useEffect(() => {
    const glCanvas = glRef.current
    const overlay = overlayRef.current
    const octx = overlay.getContext('2d')
    let gl = null
    let cpu = null
    try {
      gl = new GLRenderer(glCanvas)
    } catch (err) {
      console.warn('Rendu WebGL2 indisponible, rendu 2D de secours :', err)
      glCanvas.style.display = 'none'
      cpu = new CpuRenderer(octx)
    }
    const scale = new ComponentScale()
    let W = 0
    let H = 0
    let dpr = 1
    let lay = null
    let raf = 0
    let last = performance.now()
    let lastStats = 0

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      W = overlay.clientWidth
      H = overlay.clientHeight
      for (const c of [glCanvas, overlay]) {
        c.width = Math.round(W * dpr)
        c.height = Math.round(H * dpr)
      }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(overlay)
    resize()

    const frame = (now) => {
      const { sim, running, view, speed, onStats } = live.current
      const dtReal = Math.min(0.05, (now - last) / 1000)
      last = now
      if (sim) {
        if (running) sim.advance(dtReal, speed)
        const core = sim.core
        lay = computeLayout(core.nx, core.ny, W, H, sim.p.fill)
        const palette = view.mode === 'wheel' ? view.wheelPalette : view.linearPalette
        const opts = { mode: view.mode, palette, vmax: scale.update(core, view.mode) }
        if (gl) {
          gl.render(core, lay, dpr, opts)
          octx.clearRect(0, 0, W, H)
        } else {
          cpu.render(core, lay, W, H, opts)
        }
        if (view.arrows) drawArrows(octx, core, lay)
        if (now - lastStats > 200) {
          lastStats = now
          onStats(sim.computeStats())
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const onPointer = (e) => {
      const { sim } = live.current
      if (!sim || !lay) return
      const rect = overlay.getBoundingClientRect()
      const cell = toCell(lay, e.clientX - rect.left, e.clientY - rect.top)
      if (cell) sim.placeSeed(cell[0], cell[1])
    }
    overlay.addEventListener('pointerdown', onPointer)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      overlay.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  return (
    <>
      <canvas ref={glRef} className="field" />
      <canvas ref={overlayRef} className="field overlay" />
    </>
  )
}
