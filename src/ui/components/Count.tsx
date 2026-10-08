interface Props {
  value: number
  className?: string
  label?: string
}

/**
 * A figure in fixed tabular cells. Cells are keyed by position from the right
 * and by digit, so only the digit that changed rolls in — the count never
 * jitters as it grows.
 */
export function Count({ value, className = '', label }: Props) {
  const digits = String(Math.max(0, value)).split('')
  return (
    <span
      className={`figures inline-flex leading-[0.82] font-extrabold tracking-[-0.02em] ${className}`}
    >
      <span className="sr-only">{label ?? String(value)}</span>
      {digits.map((d, i) => {
        const fromRight = digits.length - i
        return (
          <span
            key={`${fromRight}-${d}`}
            className="inline-block"
            style={{ animation: 'digit-in 180ms var(--ease-out-expo) both' }}
            aria-hidden="true"
          >
            {d}
          </span>
        )
      })}
    </span>
  )
}
