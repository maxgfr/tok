// One clock for every hit. Sensors stamp events on the monotonic clock
// (performance.now, AudioContext time); the session stores wall-clock epoch ms.
// The two drift apart when a phone sleeps, so the mapping is anchored at the
// moment of conversion, a few milliseconds after the event, never at page load.

/** Monotonic ms → epoch ms. */
export function perfToEpoch(
  perfMs: number,
  perfNow = performance.now(),
  dateNow = Date.now(),
): number {
  return dateNow - (perfNow - perfMs)
}

/**
 * AudioContext seconds → monotonic ms, through the render clock. The output
 * timestamp would add output latency (large with Bluetooth earbuds) to a
 * sound that came in through the microphone.
 */
export function contextToPerf(contextTime: number, currentTime: number, perfNow: number): number {
  return perfNow - (currentTime - contextTime) * 1000
}
