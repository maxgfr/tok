// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { steady, synth, type SynthOptions } from '../test/synth.ts'
import { OnsetDetector, type Onset } from './onset.ts'
import {
  learn,
  learnable,
  learnGuided,
  MIN_EXAMPLES,
  MIN_SIMILARITY,
  ready,
  similarity,
  steadyRhythm,
  suggestThreshold,
  type Toneprint,
} from './toneprint.ts'
import type { Hit, Rally } from './types.ts'

const SR = 48_000

function detect(opts: Omit<SynthOptions, 'sampleRate'>, voiceFilter = true) {
  const det = new OnsetDetector({
    sampleRate: SR,
    bandHz: [1500, 6000],
    refractoryMs: 120,
    voiceFilter,
  })
  const signal = synth({ sampleRate: SR, ...opts })
  const onsets: Onset[] = []
  let noisePeak = 0
  for (let i = 0; i < signal.length; i += 128) {
    onsets.push(...det.push(signal.subarray(i, i + 128)))
    noisePeak = Math.max(noisePeak, det.level().score)
  }
  return { onsets, noisePeak }
}

// The player's ball: a 2.6 kHz "tok".
const BALL = { freq: 2600, decayMs: 30 }

function trained(): Toneprint {
  const { onsets } = detect({ seconds: 8, toks: steady(10, 1, 0.6, BALL), seed: 2 })
  return learn(
    null,
    onsets.map((o) => o.print),
    onsets.map((o) => o.score),
  )
}

const sims = (model: Toneprint, onsets: Onset[]) => onsets.map((o) => similarity(o.print, model))

describe('toneprint', () => {
  test('the same ball, quieter and over more noise, is recognised', () => {
    const { onsets } = detect({
      seconds: 8,
      toks: steady(10, 1, 0.6, { ...BALL, gain: 0.2 }),
      noise: 0.006,
      seed: 5,
    })
    expect(onsets).toHaveLength(10)
    for (const s of sims(trained(), onsets)) expect(s).toBeGreaterThanOrEqual(MIN_SIMILARITY)
  })

  test('table tennis: paddle and table sound unlike each other, and both are the ball', () => {
    const exchange = (start: number, seed: number) => {
      const toks = []
      for (let i = 0; i < 8; i += 1) {
        const at = start + i * 0.42
        toks.push({ at, freq: 3400, gain: 0.4, decayMs: 14 })
        toks.push({ at: at + 0.21, freq: 2100, gain: 0.3, decayMs: 12 })
      }
      return detect({ seconds: start + 4, toks, seed }).onsets
    }
    const taught = exchange(1, 11)
    const prints = taught.map((o) => o.print)
    const scores = taught.map((o) => o.score)
    // One average shape fits neither sound well…
    const single = learn(null, prints, scores, 1)
    const two = learn(null, prints, scores, 2)
    expect(two.means).toHaveLength(2)
    const heard = exchange(1, 31)
    expect(heard).toHaveLength(16)
    // …one shape for each recognises them all.
    for (const s of sims(two, heard)) expect(s).toBeGreaterThanOrEqual(MIN_SIMILARITY)
    expect(Math.min(...sims(single, heard))).toBeLessThan(Math.min(...sims(two, heard)))
    const at = steady(8, 1, 0.7).map(({ at }) => ({ at, gain: 0.6 }))
    for (const s of sims(two, detect({ seconds: 8, toks: [], claps: at }).onsets))
      expect(s).toBeLessThan(MIN_SIMILARITY)
  })

  test('claps, footsteps and a voice are not the ball', () => {
    const model = trained()
    const at = steady(8, 1, 0.7).map(({ at }) => ({ at, gain: 0.6 }))
    const claps = detect({ seconds: 8, toks: [], claps: at }).onsets
    const steps = detect({ seconds: 8, toks: [], steps: at }).onsets
    // The voice filter would drop the syllables already: here they get through.
    const voice = detect({ seconds: 8, toks: [], speech: at }, false).onsets
    for (const onsets of [claps, steps, voice]) {
      expect(onsets.length).toBeGreaterThan(0)
      for (const s of sims(model, onsets)) expect(s).toBeLessThan(MIN_SIMILARITY)
    }
  })

  test('the suggested threshold sits between the noise and the hits', () => {
    const model = trained()
    const threshold = suggestThreshold(model)!
    const { noisePeak } = detect({ seconds: 6, toks: [], noise: 0.01, rumble: 0.05 })
    expect(threshold).toBeGreaterThan(noisePeak)
    expect(threshold).toBeLessThan(Math.min(...model.scores))
  })

  test('a threshold only once enough hits are known, within 3..40', () => {
    expect(suggestThreshold(null)).toBeNull()
    const few = learn(null, [[1, 0]], [20])
    expect(suggestThreshold(few)).toBeNull()
    const prints = Array.from({ length: MIN_EXAMPLES }, () => [1, 0, 0])
    expect(
      suggestThreshold(
        learn(
          null,
          prints,
          prints.map(() => 1000),
        ),
      ),
    ).toBe(40)
    expect(
      suggestThreshold(
        learn(
          null,
          prints,
          prints.map(() => 1),
        ),
      ),
    ).toBe(3)
  })

  test('learning on purpose replaces the model and is enough to judge', () => {
    const old = learn(
      null,
      Array.from({ length: 30 }, () => [1, 0, 0, 0]),
      [],
    )
    expect(old.count).toBe(30)
    const prints = Array.from({ length: 6 }, () => [0, 0, 0, 1])
    const model = learnGuided(prints, [20, 22, 24, 26, 28, 30])
    expect(ready(model)).toBe(true)
    expect(similarity([0, 0, 0, 1], model)).toBeCloseTo(1)
    expect(suggestThreshold(model)).toBeCloseTo(12)
  })

  test('the model is ready to judge after enough hits', () => {
    const prints = Array.from({ length: MIN_EXAMPLES }, () => [1, 0, 0])
    expect(ready(learn(null, prints.slice(1), []))).toBe(false)
    expect(ready(learn(null, prints, []))).toBe(true)
  })

  test('learning keeps following the ball as it changes', () => {
    const a = [1, 0, 0, 0]
    const b = [0, 0, 0, 1]
    let model = learn(
      null,
      Array.from({ length: 20 }, () => a),
      [],
    )
    expect(similarity(a, model)).toBeCloseTo(1)
    model = learn(
      model,
      Array.from({ length: 60 }, () => b),
      [],
    )
    expect(similarity(b, model)).toBeGreaterThan(similarity(a, model))
  })
})

const hit = (t: number, source: Hit['sources'][number] = 'audio'): Hit => ({
  t,
  sources: [source],
  confidence: 1,
})
const rallyOf = (times: number[], extra: Partial<Rally> = {}): Rally => ({
  startedAt: times[0]!,
  endedAt: times.at(-1)!,
  hits: times.map((t) => hit(t)),
  endReason: 'timeout',
  ...extra,
})

describe('which rallies teach the model', () => {
  test('a steady exchange of four sensor hits or more', () => {
    expect(learnable(rallyOf([0, 600, 1210, 1800]))).toBe(true)
  })

  test('too short, irregular, tapped or corrected: no', () => {
    expect(learnable(rallyOf([0, 600, 1200]))).toBe(false)
    expect(learnable(rallyOf([0, 100, 1500, 1600, 3500]))).toBe(false)
    expect(
      learnable({
        ...rallyOf([0, 600, 1200, 1800]),
        hits: [hit(0, 'manual'), hit(600), hit(1200), hit(1800)],
      }),
    ).toBe(false)
    expect(learnable(rallyOf([0, 600, 1200, 1800], { count: 5 }))).toBe(false)
  })

  test('a steady rhythm has intervals that vary less than half their mean', () => {
    expect(steadyRhythm([0, 500, 1000, 1500])).toBe(true)
    expect(steadyRhythm([0, 50, 1000, 1050])).toBe(false)
    expect(steadyRhythm([0, 500])).toBe(false)
  })
})
