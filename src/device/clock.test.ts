import { expect, test } from 'vitest'
import { contextToPerf, perfToEpoch } from './clock.ts'

test('a monotonic time maps to the wall clock as it is now, not as it was at page load', () => {
  // The phone slept: performance.now() lags Date.now() by hours. An event 50 ms
  // ago (monotonic) happened 50 ms before the current wall time.
  expect(perfToEpoch(9_950, 10_000, 1_800_000_000_000)).toBe(1_799_999_999_950)
})

test('an AudioContext time maps through the render clock, not the output timestamp', () => {
  // currentTime 12.5 s at performance 4_000 ms → an onset at 12.38 s was 120 ms earlier.
  expect(contextToPerf(12.38, 12.5, 4000)).toBeCloseTo(3880)
})
