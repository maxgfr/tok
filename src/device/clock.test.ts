// @vitest-environment node
import { expect, test } from 'vitest'
import { agedPerf, perfToEpoch } from './clock.ts'

test('a monotonic time maps to the wall clock as it is now, not as it was at page load', () => {
  // The phone slept: performance.now() lags Date.now() by hours. An event 50 ms
  // ago (monotonic) happened 50 ms before the current wall time.
  expect(perfToEpoch(9_950, 10_000, 1_800_000_000_000)).toBe(1_799_999_999_950)
})

test('an onset is placed by its age in samples, not by any AudioContext clock', () => {
  // The worklet saw the onset 0.12 s of audio ago; the message arrived at 4000 ms.
  expect(agedPerf(0.12, 4000)).toBeCloseTo(3880)
})

test('an age can never place a hit in the future', () => {
  expect(agedPerf(-0.5, 4000)).toBe(4000)
})
