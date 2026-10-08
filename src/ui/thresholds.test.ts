import { expect, test } from 'vitest'
import { sensitivityToThreshold, thresholdToSensitivity } from './thresholds.ts'

test('full sensitivity is the lowest threshold and none is the highest', () => {
  expect(sensitivityToThreshold(100)).toBeCloseTo(2)
  expect(sensitivityToThreshold(0)).toBeCloseTo(40)
})

test('the two mappings invert each other', () => {
  for (const s of [0, 25, 62, 100])
    expect(thresholdToSensitivity(sensitivityToThreshold(s))).toBe(s)
})
