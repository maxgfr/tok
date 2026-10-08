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
 * Monotonic ms of an audio event, from its age: how many seconds of audio the
 * worklet has processed since it. Sample counts are the one clock the audio
 * thread always keeps, even where AudioContext.currentTime stalls (no output
 * device) or the output timestamp adds Bluetooth latency.
 */
export function agedPerf(ageSeconds: number, receivedPerf: number): number {
  return receivedPerf - Math.max(0, ageSeconds) * 1000
}
