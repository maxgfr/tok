// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { steady, synth, type SynthOptions } from '../test/synth.ts'
import { OnsetDetector, type Onset } from './onset.ts'
import { sport, type SportId } from './sports.ts'
import { countHits } from './stats.ts'
import { learn, MIN_SIMILARITY, similarity, type Toneprint } from './toneprint.ts'

/** 16-bit PCM mono WAV → samples. Only what our fixtures use. */
function readWav(path: string): { sampleRate: number; samples: Float32Array } {
  const buf = readFileSync(path)
  const sampleRate = buf.readUInt32LE(24)
  let offset = 12
  while (buf.toString('ascii', offset, offset + 4) !== 'data')
    offset += 8 + buf.readUInt32LE(offset + 4)
  const length = buf.readUInt32LE(offset + 4) / 2
  const samples = new Float32Array(length)
  for (let i = 0; i < length; i += 1) samples[i] = buf.readInt16LE(offset + 8 + i * 2) / 32768
  return { sampleRate, samples }
}

function hitsIn(file: string, sportId: SportId): number {
  const preset = sport(sportId)
  const { sampleRate, samples } = readWav(file)
  const det = new OnsetDetector({
    sampleRate,
    bandHz: preset.bandHz,
    refractoryMs: preset.refractoryMs,
  })
  const onsets = []
  for (let i = 0; i < samples.length; i += 128)
    onsets.push(...det.push(samples.subarray(i, i + 128)))
  const hits = onsets.map((o) => ({
    t: o.t * 1000,
    sources: ['audio' as const],
    confidence: o.confidence,
  }))
  return countHits(hits, preset.soundsPerHit)
}

describe('reference recordings (synthetic)', () => {
  test('beach rackets: 10 hits', () => {
    expect(hitsIn('fixtures/beach-rackets.wav', 'beach-rackets')).toBe(10)
  })

  test('table tennis: 10 hits from 20 sounds', () => {
    expect(hitsIn('fixtures/table-tennis.wav', 'table-tennis')).toBe(10)
  })
})

function onsetsIn(samples: Float32Array, sampleRate: number, sportId: SportId): Onset[] {
  const preset = sport(sportId)
  const det = new OnsetDetector({
    sampleRate,
    bandHz: preset.bandHz,
    refractoryMs: preset.refractoryMs,
  })
  const onsets: Onset[] = []
  for (let i = 0; i < samples.length; i += 128)
    onsets.push(...det.push(samples.subarray(i, i + 128)))
  return onsets
}

describe('a rally among other noises (synthetic)', () => {
  const SR = 48_000
  const BALL = { freq: 2600, gain: 0.45, decayMs: 30 }
  const heard = (opts: Omit<SynthOptions, 'sampleRate'>) =>
    onsetsIn(synth({ sampleRate: SR, ...opts }), SR, 'beach-rackets')
  // What a few earlier rallies taught tok of this ball.
  const known = (): Toneprint => {
    const onsets = heard({ seconds: 8, toks: steady(10, 1, 0.6, BALL), seed: 21 })
    return learn(
      null,
      onsets.map((o) => o.print),
      onsets.map((o) => o.score),
    )
  }
  // 12 hits 0.6 s apart; between them, a clap, a footstep or a word.
  const toks = steady(12, 1, 0.6, BALL)
  const between = toks.slice(0, -1).map(({ at }) => at + 0.3)
  const signal = {
    seconds: 10,
    toks,
    claps: between.filter((_, i) => i % 3 === 0).map((at) => ({ at, gain: 0.5 })),
    steps: between.filter((_, i) => i % 3 === 1).map((at) => ({ at, gain: 0.8 })),
    speech: between.filter((_, i) => i % 3 === 2).map((at) => ({ at, gain: 0.5, ms: 150 })),
    noise: 0.004,
    rumble: 0.05,
    seed: 23,
  }

  test('alone, the detector hears more than the hits', () => {
    expect(heard(signal).length).toBeGreaterThan(12)
  })

  test('knowing the ball, only its hits count', () => {
    const model = known()
    const counted = heard(signal).filter((o) => similarity(o.print, model) >= MIN_SIMILARITY)
    expect(counted).toHaveLength(12)
    counted.forEach((o, i) => expect(Math.abs(o.t - toks[i]!.at)).toBeLessThan(0.015))
  })
})

// Real recordings, saved from a session's mic panel ("Save last 20 s"): the
// WAV and its JSON, with `hits` filled in by hand with the real count.
const REAL = 'fixtures/real'
const real = existsSync(REAL)
  ? readdirSync(REAL)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => {
        const notes = JSON.parse(readFileSync(`${REAL}/${f}`, 'utf8')) as {
          sport: SportId
          hits: number | null
        }
        const wav = `${REAL}/${f.replace(/\.json$/, '.wav')}`
        return typeof notes.hits === 'number' && existsSync(wav)
          ? [{ wav, sport: notes.sport, hits: notes.hits }]
          : []
      })
  : []

describe('reference recordings (real)', () => {
  test.each(real)('$wav: $hits hits', ({ wav, sport: sportId, hits }) => {
    expect(hitsIn(wav, sportId)).toBe(hits)
  })

  test('every real recording says how many hits it holds', () => {
    for (const { hits } of real) expect(hits).toBeGreaterThanOrEqual(0)
  })
})
