import { expect, test } from 'vitest'
import { clock, fmtBytes, fmtDuration } from './format.ts'

test('durations read in the largest sensible units', () => {
  expect(fmtDuration(42_000)).toBe('42s')
  expect(fmtDuration(125_000)).toBe('2m 05s')
  expect(fmtDuration(3_900_000)).toBe('1h 05m')
})

test('bytes read in binary units', () => {
  expect(fmtBytes(512)).toBe('512 B')
  expect(fmtBytes(5 * 1024 ** 2)).toBe('5 MB')
  expect(fmtBytes(10 * 1024 ** 3)).toBe('10 GB')
  expect(fmtBytes(2.5 * 1024 ** 3)).toBe('2.5 GB')
})

test('video positions read like a player clock', () => {
  expect(clock(2.4)).toBe('0:02')
  expect(clock(760)).toBe('12:40')
  expect(clock(3725)).toBe('1:02:05')
})
