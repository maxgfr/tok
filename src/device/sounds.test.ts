import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearSelfNoise, isSelfNoise } from './selfNoise.ts'
import { hitSound, rallyEndSound } from './sounds.ts'

const node = () => ({
  type: '',
  frequency: { value: 0 },
  gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
  connect() {},
  start() {},
  stop() {},
})

/** A context whose output lags 210 ms, like Bluetooth earbuds. */
class BluetoothContext {
  state = 'running'
  currentTime = 0
  outputLatency = 0.2
  baseLatency = 0.01
  destination = {}
  createOscillator = node
  createGain = node
  resume = () => Promise.resolve()
}

const NOW = 1_000_000

beforeEach(() => {
  vi.stubGlobal('AudioContext', BluetoothContext)
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  clearSelfNoise()
})

test('the mic ignores a hit sound when it comes out of the speaker, not before', () => {
  hitSound()
  // A real hit right after the click is still heard…
  expect(isSelfNoise(NOW + 100, 'audio')).toBe(false)
  // …the click itself, 210 ms later through the earbuds, is not…
  expect(isSelfNoise(NOW + 230, 'audio')).toBe(true)
  // …and the mic is back once it has rung out.
  expect(isSelfNoise(NOW + 340, 'audio')).toBe(false)
})

test('a rally end lasts longer than a hit, a record longer still', () => {
  rallyEndSound(false)
  expect(isSelfNoise(NOW + 500, 'audio')).toBe(true)
  expect(isSelfNoise(NOW + 560, 'audio')).toBe(false)
  clearSelfNoise()
  rallyEndSound(true)
  expect(isSelfNoise(NOW + 580, 'audio')).toBe(true)
  expect(isSelfNoise(NOW + 640, 'audio')).toBe(false)
})

test('a sound does not blind the motion sensor', () => {
  hitSound()
  expect(isSelfNoise(NOW + 230, 'motion')).toBe(false)
})
