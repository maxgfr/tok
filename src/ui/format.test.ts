import { expect, test } from 'vitest'
import { fmtBytes, fmtDuration } from './format.ts'

test('durations read in the largest sensible units', () => {
  expect(fmtDuration(42_000)).toBe('42s')
  expect(fmtDuration(125_000)).toBe('2m 05s')
  expect(fmtDuration(3_900_000)).toBe('1h 05m')
})

test('bytes read in binary units', () => {
  expect(fmtBytes(512)).toBe('512 B')
  expect(fmtBytes(5 * 1024 ** 2)).toBe('5.0 MB')
})
