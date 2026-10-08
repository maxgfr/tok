/** Short buzz per hit, longer pattern at rally end. Silently absent on iOS. */
export function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Some browsers throw without a user gesture; feedback is optional.
  }
}
