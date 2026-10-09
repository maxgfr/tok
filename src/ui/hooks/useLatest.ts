import { useLayoutEffect, useRef } from 'react'

/**
 * A ref that always holds the value from the last render: for callbacks handed
 * to sensors and timers that must call the current handler, not the one from
 * when they were set up.
 */
export function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
