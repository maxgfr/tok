import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { GATE_W, ROW_H, tallyLayout, type Stroke } from './tally.ts'

interface Props {
  count: number
  className?: string
  /** Stroke colour, a CSS colour or var(). */
  tone?: string
}

const line = (s: Stroke) => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 })

const GATES_PER_ROW = 10
const MAX_ROWS = 4
const CAPACITY = GATES_PER_ROW * MAX_ROWS * 5

const STROKE_IN = { animation: 'stroke-in 220ms var(--ease-out-expo) both' }
const CANCEL_OUT = { animation: 'cancel-out 900ms ease-out forwards' }

/**
 * The rally drawn as chalk tally marks. Each new stroke draws itself; an
 * undone stroke is struck through in coral and fades — it cancels, it does
 * not silently vanish.
 */
export const Tally = memo(function Tally({
  count,
  className = '',
  tone = 'var(--color-chalk)',
}: Props) {
  const { strokes, rows, carried } = useMemo(
    () => tallyLayout(count, { gatesPerRow: GATES_PER_ROW, capacity: CAPACITY }),
    [count],
  )
  const previous = useRef(count)
  const [cancelled, setCancelled] = useState<Stroke[]>([])

  useEffect(() => {
    const before = previous.current
    previous.current = count
    if (count < before) {
      const all = tallyLayout(before, { gatesPerRow: GATES_PER_ROW, capacity: CAPACITY }).strokes
      setCancelled(all.filter((s) => s.index >= count))
    } else if (count > before) {
      setCancelled([])
    }
  }, [count])

  const gates = Math.ceil(
    Math.max(strokes.length, ...cancelled.map((s) => s.index - carried + 1), 1) / 5,
  )
  const cols = Math.min(GATES_PER_ROW, gates)
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
            <line key={s.index} {...line(s)} pathLength={1} strokeDasharray={1} style={STROKE_IN} />
          ))}
        </g>
        {cancelled.map((s) => (
          <g
            key={`x${s.index}`}
            style={CANCEL_OUT}
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
})
