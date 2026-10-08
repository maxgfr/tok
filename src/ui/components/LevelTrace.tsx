import { useEffect, useRef } from 'react'

export interface TracePoint {
  t: number
  flux: number
  threshold: number
}

interface Props {
  /** Mutable buffers owned by the caller; the trace only reads them. */
  levels: React.RefObject<TracePoint[]>
  onsets: React.RefObject<number[]>
  windowMs?: number
  label: string
}

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/**
 * The detector's view of the last few seconds: the sound's flux in chalk,
 * the adaptive threshold in yellow, every detected hit as a green stroke.
 */
export function LevelTrace({ levels, onsets, windowMs = 6000, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let frame = 0
    const colors = {
      chalk: css('--color-chalk') || '#eef0e6',
      best: css('--color-best') || '#f5d547',
      live: css('--color-live') || '#8fe3a0',
      rule: css('--color-rule') || '#34463e',
    }
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const el = canvas.current
      const ctx = el?.getContext('2d')
      if (!el || !ctx) return
      const dpr = window.devicePixelRatio || 1
      const w = el.clientWidth
      const h = el.clientHeight
      if (el.width !== Math.round(w * dpr)) el.width = Math.round(w * dpr)
      if (el.height !== Math.round(h * dpr)) el.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const now = Date.now()
      const from = now - windowMs
      const points = (levels.current ?? []).filter((p) => p.t >= from)
      let top = 0.05
      for (const p of points) top = Math.max(top, p.flux, p.threshold)
      top *= 1.15
      const x = (t: number) => ((t - from) / windowMs) * w
      const y = (v: number) => h - (v / top) * (h - 4) - 2

      ctx.strokeStyle = colors.rule
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h - 0.5)
      ctx.lineTo(w, h - 0.5)
      ctx.stroke()

      ctx.strokeStyle = colors.live
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      for (const t of onsets.current ?? []) {
        if (t < from) continue
        ctx.beginPath()
        ctx.moveTo(x(t), 6)
        ctx.lineTo(x(t), h - 6)
        ctx.stroke()
      }

      const line = (key: 'flux' | 'threshold', color: string, width: number) => {
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.lineJoin = 'round'
        ctx.beginPath()
        points.forEach((p, i) =>
          i ? ctx.lineTo(x(p.t), y(p[key])) : ctx.moveTo(x(p.t), y(p[key])),
        )
        ctx.stroke()
      }
      line('threshold', colors.best, 2)
      line('flux', colors.chalk, 1.5)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [levels, onsets, windowMs])

  return <canvas ref={canvas} className="h-44 w-full rounded-lg bg-slate-2" aria-label={label} />
}
