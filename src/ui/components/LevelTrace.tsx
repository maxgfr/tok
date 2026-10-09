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
  label: string
}

/** The last few seconds of sound on screen. */
const WINDOW_MS = 6000

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** Index of the first point at or after `t`; points are in time order. */
function firstFrom(points: readonly TracePoint[], t: number): number {
  let lo = 0
  let hi = points.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid]!.t < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * The detector's view of the last few seconds: the sound's flux in chalk,
 * the adaptive threshold in yellow, every detected hit as a green stroke.
 */
export function LevelTrace({ levels, onsets, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let frame = 0
    let w = 0
    let h = 0
    // What the last frame drew from: nothing new, nothing to redraw.
    let drawnLevel = NaN
    let drawnOnsets = -1
    let drawnOnset = NaN
    const el = canvas.current
    const observer =
      el && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(([entry]) => {
            if (!entry) return
            const dpr = window.devicePixelRatio || 1
            w = entry.contentRect.width
            h = entry.contentRect.height
            el.width = Math.round(w * dpr)
            el.height = Math.round(h * dpr)
            drawnLevel = NaN
          })
        : null
    if (el) observer?.observe(el)
    const colors = {
      chalk: css('--color-chalk') || '#eef0e6',
      best: css('--color-best') || '#f5d547',
      live: css('--color-live') || '#8fe3a0',
      rule: css('--color-rule') || '#34463e',
    }
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const ctx = el?.getContext('2d')
      if (!el || !ctx || !w || !h) return
      const all = levels.current ?? []
      const hits = onsets.current ?? []
      const lastLevel = all.at(-1)?.t ?? 0
      const lastOnset = hits.at(-1) ?? 0
      if (lastLevel === drawnLevel && hits.length === drawnOnsets && lastOnset === drawnOnset)
        return
      drawnLevel = lastLevel
      drawnOnsets = hits.length
      drawnOnset = lastOnset
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const now = Date.now()
      const from = now - WINDOW_MS
      const points = all.slice(firstFrom(all, from))
      let top = 0.05
      for (const p of points) top = Math.max(top, p.flux, p.threshold)
      top *= 1.15
      const x = (t: number) => ((t - from) / WINDOW_MS) * w
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
      for (const t of hits) {
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
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [levels, onsets])

  return <canvas ref={canvas} className="h-44 w-full rounded-lg bg-slate-2" aria-label={label} />
}
