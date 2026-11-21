import { useEffect, useRef } from 'react'
import { FieldRenderer } from '../sim/renderer.js'

// Canvas plein écran : boucle d'animation, intégration LLG et rendu.
export default function FieldCanvas({ sim, running, view, speed, onStats }) {
  const canvasRef = useRef(null)
  const live = useRef({ sim, running, view, speed, onStats })

  useEffect(() => {
    live.current = { sim, running, view, speed, onStats }
  }, [sim, running, view, speed, onStats])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const renderer = new FieldRenderer()
    let W = 0
    let H = 0
    let raf = 0
    let last = performance.now()
    let lastStats = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      W = canvas.clientWidth
      H = canvas.clientHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const frame = (now) => {
      const { sim, running, view, speed, onStats } = live.current
      const dtReal = Math.min(0.05, (now - last) / 1000)
      last = now
      if (sim) {
        if (running) sim.advance(dtReal, speed)
        renderer.paint(sim.core, view.mode)
        renderer.draw(ctx, W, H, sim.p.fill)
        if (view.arrows) renderer.drawArrows(ctx, sim.core)
        if (now - lastStats > 200) {
          lastStats = now
          onStats(sim.computeStats())
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const onClick = (e) => {
      const { sim } = live.current
      if (!sim) return
      const rect = canvas.getBoundingClientRect()
      const cell = renderer.toCell(e.clientX - rect.left, e.clientY - rect.top)
      if (cell) sim.placeSeed(cell[0], cell[1])
    }
    canvas.addEventListener('pointerdown', onClick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onClick)
    }
  }, [])

  return <canvas ref={canvasRef} className="field" />
}
