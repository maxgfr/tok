import { afterEach, expect, test, vi } from 'vitest'
import { hitSound, isSounding, rallyEndSound } from './sounds.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

test('while tok makes a sound, the mic is told to ignore it', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(10_000)
  expect(isSounding()).toBe(false)
  hitSound()
  expect(isSounding()).toBe(true)
  now.mockReturnValue(10_400)
  expect(isSounding()).toBe(false)
})

test('a rally end lasts longer than a hit, a record longer still', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(20_000)
  rallyEndSound(false)
  now.mockReturnValue(20_300)
  expect(isSounding()).toBe(true)
  now.mockReturnValue(30_000)
  rallyEndSound(true)
  now.mockReturnValue(30_400)
  expect(isSounding()).toBe(true)
})
