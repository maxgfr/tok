import { useState } from 'react'
import type { DayPoint } from '../../engine/stats.ts'

const W = 600
const H = 180
const PAD = { top: 12, right: 12, bottom: 12, left: 12 }

const fmtDay = (day: string) => {
  const [, m, d] = day.split('-')
  return `${Number(d)}/${Number(m)}`
}

/**
 * Best and average rally per day on one fixed scale (0 → all-time best), so a
 * good day looks good next to every other day. Best wears the record yellow;
 * the average is chalk, dashed, so the two never rely on colour alone.
 */
export function DayChart({ points }: { points: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length === 0) return null
  const top = Math.max(1, ...points.map((p) => p.best))
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw)
  const y = (v: number) => PAD.top + ih - (v / top) * ih
  const path = (key: 'best' | 'average') =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join('')
  const ticks = [0, Math.round(top / 2), top]
  const active = hover !== null ? points[hover] : undefined
  const last = points.length - 1

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = points.length === 1 ? 0 : Math.round(((px - PAD.left) / iw) * last)
    setHover(Math.min(last, Math.max(0, i)))
  }

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-chalk-dim">
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-best" aria-hidden="true" /> Best rally
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-chalk-dim" aria-hidden="true" />{' '}
            Average
          </span>
        </span>
        <span className="figures text-base text-chalk" aria-live="polite">
          {active
            ? `${fmtDay(active.day)} · best ${active.best} · avg ${active.average.toFixed(1)}`
            : ''}
        </span>
      </figcaption>
      <div className="flex gap-2">
        {/* Labels in CSS pixels: they must not shrink with the drawing. */}
        <div
          className="figures relative w-8 shrink-0 text-right text-sm text-chalk-dim"
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(y(t) / H) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto min-w-0 flex-1 touch-none"
          aria-hidden="true"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <line
              key={t}
              x1={0}
              x2={W}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-rule)"
              strokeWidth={1}
            />
          ))}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + ih}
              stroke="var(--color-chalk-faint)"
              strokeWidth={1}
            />
          )}
          <path
            d={path('average')}
            fill="none"
            stroke="var(--color-chalk-dim)"
            strokeWidth={2}
            strokeDasharray="6 5"
            strokeLinejoin="round"
          />
          <path
            d={path('best')}
            fill="none"
            stroke="var(--color-best)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <g key={p.day}>
              <circle
                cx={x(i)}
                cy={y(p.average)}
                r={3.5}
                fill="var(--color-chalk-dim)"
                stroke="var(--color-slate)"
                strokeWidth={2}
              />
              <circle
                cx={x(i)}
                cy={y(p.best)}
                r={hover === i ? 5.5 : 4.5}
                fill="var(--color-best)"
                stroke="var(--color-slate)"
                strokeWidth={2}
              />
            </g>
          ))}
        </svg>
      </div>
      <div className="figures flex justify-between pl-10 text-sm text-chalk-dim" aria-hidden="true">
        <span>{fmtDay(points[0]!.day)}</span>
        {last > 0 && <span>{fmtDay(points[last]!.day)}</span>}
      </div>
      <p className="sr-only">
        Best rally per day: {points.map((p) => `${fmtDay(p.day)} ${p.best}`).join(', ')}
      </p>
    </figure>
  )
}
