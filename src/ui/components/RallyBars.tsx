import { useState } from 'react'

interface Props {
  counts: number[]
  /** Fixed y-scale top, so sessions compare at a glance. */
  max?: number
  label: string
}

const H = 120
const GAP = 2

/** One bar per rally, oldest first; the longest is drawn in best-yellow. */
export function RallyBars({ counts, max, label }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  if (counts.length === 0) return null
  const top = Math.max(1, max ?? 0, ...counts)
  const best = Math.max(...counts)
  const w = Math.max(4, Math.min(28, 640 / counts.length))
  // Few rallies stay narrow bars on the left instead of stretching to fill.
  const width = Math.max(counts.length * (w + GAP), 320)
  const shown = hover !== null ? counts[hover] : undefined

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between text-sm text-chalk-dim">
        <span>{label}</span>
        <span className="figures text-base text-chalk" aria-live="polite">
          {shown !== undefined && hover !== null ? `Rally ${hover + 1}: ${shown}` : `Best ${best}`}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${H + 1}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        aria-hidden="true"
        onPointerLeave={() => setHover(null)}
      >
        <line
          x1={0}
          x2={width}
          y1={H + 0.5}
          y2={H + 0.5}
          stroke="var(--color-rule)"
          strokeWidth={1}
        />
        {counts.map((c, i) => {
          // Rallies never reorder; position is their identity.
          const h = Math.max(2, (c / top) * (H - 4))
          const x = i * (w + GAP)
          return (
            <g key={i} onPointerEnter={() => setHover(i)}>
              <rect x={x} y={0} width={w + GAP} height={H} fill="transparent" />
              <rect
                x={x}
                y={H - h}
                width={w}
                height={h}
                rx={Math.min(4, w / 2)}
                fill={c === best ? 'var(--color-series-best)' : 'var(--color-chalk-faint)'}
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
            </g>
          )
        })}
      </svg>
      <p className="sr-only">
        {label}: {counts.join(', ')}
      </p>
    </figure>
  )
}
