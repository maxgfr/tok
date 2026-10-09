// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { OnsetDetector } from './onset.ts'
import { sport, type SportId } from './sports.ts'
import { countHits } from './stats.ts'

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
