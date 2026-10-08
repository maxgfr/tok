import { useEffect, useRef, useState } from 'react'
import { GATE_W, ROW_H, tallyLayout, type Stroke } from './tally.ts'

interface Props {
  count: number
  gatesPerRow?: number
  maxRows?: number
  className?: string
  /** Stroke colour, a CSS colour or var(). */
  tone?: string
}

const line = (s: Stroke) => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 })

/**
 * The rally drawn as chalk tally marks. Each new stroke draws itself; an
 * undone stroke is struck through in coral and fades — it cancels, it does
 * not silently vanish.
 */
export function Tally({
  count,
  gatesPerRow = 10,
  maxRows = 4,
  className = '',
  tone = 'var(--color-chalk)',
}: Props) {
  const capacity = gatesPerRow * maxRows * 5
  const { strokes, rows, carried } = tallyLayout(count, { gatesPerRow, capacity })
  const previous = useRef(count)
  const [cancelled, setCancelled] = useState<Stroke[]>([])

  useEffect(() => {
    const before = previous.current
    previous.current = count
    if (count < before && count > 0) {
      const all = tallyLayout(before, { gatesPerRow, capacity }).strokes
      setCancelled(all.filter((s) => s.index >= count))
    } else if (count === 0 || count > before) {
      setCancelled([])
    }
  }, [count, gatesPerRow, capacity])

  const gates = Math.ceil(
    Math.max(strokes.length, ...cancelled.map((s) => s.index - carried + 1), 1) / 5,
  )
  const cols = Math.min(gatesPerRow, gates)
  const width = cols * GATE_W
  const height = Math.max(rows, ...cancelled.map((s) => s.row + 1)) * ROW_H

  return (
    <div className={`flex items-start justify-center gap-3 ${className}`}>
      {carried > 0 && (
        <span className="figures shrink-0 pt-1 text-2xl font-semibold text-best">+{carried}</span>
      )}
      <svg
        viewBox={`-4 0 ${width + 8} ${height}`}
        className="h-auto max-w-full shrink overflow-visible"
        style={{ width: `${(cols * GATE_W) / 16}rem` }}
        aria-hidden="true"
      >
        <g stroke={tone} strokeWidth={4.2} strokeLinecap="round" fill="none">
          {strokes.map((s) => (
            <line
              key={s.index}
              {...line(s)}
              pathLength={1}
              strokeDasharray={1}
              style={{ animation: 'stroke-in 220ms var(--ease-out-expo) both' }}
            />
          ))}
        </g>
        {cancelled.map((s) => (
          <g
            key={`x${s.index}`}
            style={{ animation: 'cancel-out 900ms ease-out forwards' }}
            onAnimationEnd={() => setCancelled((list) => list.filter((c) => c !== s))}
          >
            <line
              {...line(s)}
              stroke={tone}
              strokeWidth={4.2}
              strokeLinecap="round"
              opacity={0.5}
            />
            <line
              x1={s.x1 - 6}
              y1={s.y1 + 26}
              x2={s.x2 + 6}
              y2={s.y2 - 26}
              stroke="var(--color-side-b)"
              strokeWidth={3.4}
              strokeLinecap="round"
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
