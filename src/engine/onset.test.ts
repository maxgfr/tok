// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { steady, synth } from '../test/synth.ts'
import { calibrateThreshold, OnsetDetector, type Onset } from './onset.ts'

const SR = 48_000

function detect(
  signal: Float32Array,
  opts: Partial<ConstructorParameters<typeof OnsetDetector>[0]> = {},
) {
  const det = new OnsetDetector({
    sampleRate: SR,
    bandHz: [1500, 6000],
    refractoryMs: 120,
    ...opts,
  })
  const onsets: Onset[] = []
  // Feed in render-quantum sized chunks, as an AudioWorklet would.
  for (let i = 0; i < signal.length; i += 128) onsets.push(...det.push(signal.subarray(i, i + 128)))
  return onsets
}

describe('OnsetDetector', () => {
  test('finds every hit of a steady rally', () => {
    const toks = steady(12, 1, 0.6)
    const onsets = detect(synth({ sampleRate: SR, seconds: 9, toks }))
    expect(onsets).toHaveLength(12)
  })

  test('onset times land within 15 ms of the hits', () => {
    const toks = steady(5, 1, 0.8)
    const onsets = detect(synth({ sampleRate: SR, seconds: 6, toks }))
    onsets.forEach((o, i) => expect(Math.abs(o.t - toks[i]!.at)).toBeLessThan(0.015))
  })

  test('background noise alone triggers nothing', () => {
    expect(detect(synth({ sampleRate: SR, seconds: 6, toks: [], noise: 0.02 }))).toEqual([])
  })

  test('a low rumble (wind, waves) outside the band triggers nothing', () => {
    expect(detect(synth({ sampleRate: SR, seconds: 6, toks: [], rumble: 0.3 }))).toEqual([])
  })

  test('a low thump outside the band is ignored', () => {
    const toks = steady(6, 1, 0.6, { freq: 120, click: 0, attackMs: 8 })
    expect(detect(synth({ sampleRate: SR, seconds: 6, toks }))).toEqual([])
  })

  test('quiet hits are still found over a quiet floor', () => {
    const toks = steady(8, 1, 0.5, { gain: 0.05 })
    expect(detect(synth({ sampleRate: SR, seconds: 6, toks, noise: 0.002 }))).toHaveLength(8)
  })

  test('fast table-tennis exchanges are separated', () => {
    const toks = steady(20, 1, 0.18, { decayMs: 15 })
    expect(detect(synth({ sampleRate: SR, seconds: 6, toks }), { refractoryMs: 80 })).toHaveLength(
      20,
    )
  })

  test('a hit inside the refractory period is merged with the previous one', () => {
    const toks = [{ at: 1 }, { at: 1.05 }, { at: 2 }]
    expect(detect(synth({ sampleRate: SR, seconds: 4, toks }), { refractoryMs: 120 })).toHaveLength(
      2,
    )
  })

  test('a higher threshold drops quiet hits', () => {
    const toks = [...steady(4, 1, 0.5), ...steady(4, 3.2, 0.5, { gain: 0.02 })]
    const signal = synth({ sampleRate: SR, seconds: 6, toks, noise: 0.004 })
    expect(detect(signal, { threshold: 6 }).length).toBe(8)
    expect(detect(signal, { threshold: 30 }).length).toBe(4)
  })

  test('confidence is between 0 and 1', () => {
    const onsets = detect(synth({ sampleRate: SR, seconds: 4, toks: steady(4, 1, 0.5) }))
    for (const o of onsets) {
      expect(o.confidence).toBeGreaterThan(0)
      expect(o.confidence).toBeLessThanOrEqual(1)
    }
  })

  test('spoken syllables are not counted', () => {
    const speech = steady(6, 1, 0.8).map(({ at }) => ({ at, gain: 0.6 }))
    expect(detect(synth({ sampleRate: SR, seconds: 6, toks: [], speech }))).toEqual([])
  })

  test('with the voice filter off, the same syllables would count', () => {
    const speech = steady(6, 1, 0.8).map(({ at }) => ({ at, gain: 0.6 }))
    const signal = synth({ sampleRate: SR, seconds: 6, toks: [], speech })
    expect(detect(signal, { voiceFilter: false }).length).toBeGreaterThanOrEqual(4)
  })

  test('hits still count next to talking', () => {
    const toks = steady(8, 1, 0.8)
    const speech = toks.map(({ at }) => ({ at: at + 0.35, gain: 0.6 }))
    const onsets = detect(synth({ sampleRate: SR, seconds: 8, toks, speech }))
    expect(onsets).toHaveLength(8)
    onsets.forEach((o, i) => expect(Math.abs(o.t - toks[i]!.at)).toBeLessThan(0.015))
  })

  test('counts the sounds it set aside as voice', () => {
    const det = new OnsetDetector({ sampleRate: SR, bandHz: [1500, 6000], refractoryMs: 120 })
    const speech = steady(3, 1, 0.8).map(({ at }) => ({ at, gain: 0.6 }))
    const signal = synth({ sampleRate: SR, seconds: 4, toks: [], speech })
    for (let i = 0; i < signal.length; i += 128) det.push(signal.subarray(i, i + 128))
    expect(det.rejected).toBeGreaterThanOrEqual(3)
  })

  test('nothing fired: the same empty array, no allocation', () => {
    const det = new OnsetDetector({ sampleRate: SR, bandHz: [1500, 6000], refractoryMs: 120 })
    expect(det.push(new Float32Array(128))).toBe(det.push(new Float32Array(128)))
  })

  test('reports a level frame for the live graph', () => {
    const det = new OnsetDetector({ sampleRate: SR, bandHz: [1500, 6000], refractoryMs: 120 })
    det.push(new Float32Array(4096))
    expect(det.level()).toMatchObject({
      flux: expect.any(Number),
      threshold: expect.any(Number),
      median: expect.any(Number),
      spread: expect.any(Number),
    })
  })
})

describe('calibrateThreshold', () => {
  test('puts the threshold between the n-th and the next strongest peak', () => {
    expect(calibrateThreshold([50, 40, 30, 10, 8], 3)).toBe(20)
  })

  test('with no weaker peak it keeps a margin under the weakest hit', () => {
    expect(calibrateThreshold([50, 40, 30], 3)).toBeCloseTo(21)
  })

  test('stays within sane bounds', () => {
    expect(calibrateThreshold([1.2, 1.1], 2)).toBeGreaterThanOrEqual(2)
    expect(calibrateThreshold([], 3)).toBeNull()
  })
})
