import { maskNoise } from './selfNoise.ts'

/** The phone keeps shaking, and its case keeps buzzing, this long after the motor stops. */
const SETTLE_MS = 120

/** Short buzz per hit, longer pattern at rally end. Silently absent on iOS. */
export function buzz(pattern: number | number[]): void {
  try {
    if (!navigator.vibrate?.(pattern)) return
  } catch {
    // Some browsers throw without a user gesture; feedback is optional.
    return
  }
  // The mic hears the motor and the accelerometer feels it: neither is a hit.
  const length = typeof pattern === 'number' ? pattern : pattern.reduce((a, b) => a + b, 0)
  const now = Date.now()
  maskNoise(now, now + length + SETTLE_MS, ['audio', 'motion'])
}
