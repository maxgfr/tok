import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { buzz } from './haptics.ts'
import { clearSelfNoise, isSelfNoise, maskNoise, maskTouches } from './selfNoise.ts'

const NOW = 2_000_000

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  clearSelfNoise()
})

test('a mask covers its sources over its stretch of time, and nothing else', () => {
  maskNoise(NOW + 100, NOW + 200, ['audio'])
  expect(isSelfNoise(NOW + 50, 'audio')).toBe(false)
  expect(isSelfNoise(NOW + 150, 'audio')).toBe(true)
  expect(isSelfNoise(NOW + 150, 'motion')).toBe(false)
  expect(isSelfNoise(NOW + 250, 'audio')).toBe(false)
})

test('a candidate is judged at the time it happened, not when it arrived', () => {
  maskNoise(NOW, NOW + 100, ['audio'])
  // Its message arrives later, after the mask: it is still tok's own noise.
  vi.spyOn(Date, 'now').mockReturnValue(NOW + 400)
  expect(isSelfNoise(NOW + 60, 'audio')).toBe(true)
})

test('a mask can be ended once the noise stops', () => {
  const end = maskNoise(NOW, NOW + 10_000, ['audio'])
  end(NOW + 500)
  expect(isSelfNoise(NOW + 400, 'audio')).toBe(true)
  expect(isSelfNoise(NOW + 600, 'audio')).toBe(false)
})

test('a vibration is neither heard nor felt as a hit', () => {
  vi.stubGlobal('navigator', { vibrate: () => true })
  buzz([30, 50, 30])
  for (const source of ['audio', 'motion'] as const) {
    expect(isSelfNoise(NOW + 200, source)).toBe(true)
    expect(isSelfNoise(NOW + 260, source)).toBe(false)
  }
})

test('without a vibration motor, nothing is masked', () => {
  vi.stubGlobal('navigator', {})
  buzz(200)
  expect(isSelfNoise(NOW + 100, 'audio')).toBe(false)
})

test('a tap on the screen is masked just before and after the finger lands', () => {
  const stop = maskTouches(window)
  window.dispatchEvent(new Event('pointerdown'))
  expect(isSelfNoise(NOW - 50, 'audio')).toBe(true)
  expect(isSelfNoise(NOW + 250, 'motion')).toBe(true)
  expect(isSelfNoise(NOW + 350, 'audio')).toBe(false)
  expect(isSelfNoise(NOW + 100, 'vision')).toBe(false)
  stop()
  clearSelfNoise()
  window.dispatchEvent(new Event('pointerdown'))
  expect(isSelfNoise(NOW, 'audio')).toBe(false)
})
