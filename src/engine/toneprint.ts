// "tok learns your tok". Every sound has a spectral shape: the new energy of a
// ball on a paddle sits in other bands than a voice, a clap, a footstep or a
// wave. The detector hands over that shape with each onset (engine/onset.ts,
// `print`); this model keeps the average shape of the player's own ball, and
// the scores of real hits, per sport. Learned on the device, from rallies that
// are surely real: noise cannot teach itself.
//
// Table tennis makes two sounds per hit, paddle and table, unlike each other:
// the model then keeps one shape for each, and a sound is the ball when it is
// like either.
//
// Pure: the session feeds it, the store keeps it.

import type { Rally } from './types.ts'

export interface Toneprint {
  /** Average print of each kind of sound a hit makes: mean-centred, unit length. */
  means: number[][]
  /** Running variance of each band of each kind, for a sense of how steady it is. */
  spreads: number[][]
  /** Sounds learned of each kind. */
  counts: number[]
  /** Sounds learned so far, all kinds. */
  count: number
  /** Peak scores of the latest real hits, newest last. */
  scores: number[]
}

/** Hits learned before the model may set a sound aside. */
export const MIN_EXAMPLES = 8

/** Under this similarity a sound is not the player's ball. */
export const MIN_SIMILARITY = 0.75

/** Sensor hits a rally needs before it teaches anything. */
export const MIN_LEARN_HITS = 4

/** Hits asked for by "Learn my ball"; also what a threshold needs. */
export const GUIDED_HITS = 6

/** Intervals steadier than this (coefficient of variation) are a real exchange. */
const MAX_RHYTHM_CV = 0.5

/** Real hit scores kept for the threshold. */
const MAX_SCORES = 64

/** The newest examples weigh at least this much: the place and the ball change. */
const MIN_RATE = 0.05

/** Mean-centred and scaled to unit length: the shape, whatever the loudness. */
export function normalize(print: readonly number[]): number[] {
  const n = print.length
  if (n === 0) return []
  const avg = print.reduce((a, b) => a + b, 0) / n
  const centred = print.map((v) => v - avg)
  const norm = Math.hypot(...centred)
  return norm > 0 ? centred.map((v) => v / norm) : centred.map(() => 0)
}

function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  for (let i = 0; i < a.length; i += 1) dot += a[i]! * b[i]!
  const norm = Math.hypot(...b)
  return norm > 0 ? dot / norm : 0
}

/** Cosine similarity of a print to the nearest of the model's shapes, −1..1. */
export function similarity(print: readonly number[], model: Toneprint): number {
  const a = normalize(print)
  return model.means.reduce((best, m) => Math.max(best, cosine(a, m)), -1)
}

/** Whether the model knows the ball well enough to set other sounds aside. */
export const ready = (model: Toneprint | null): model is Toneprint =>
  !!model && model.count >= MIN_EXAMPLES

/**
 * The model with these real hits added: running averages that keep adapting.
 * `kinds`: how many different sounds a hit makes (the sport's sounds per hit).
 * Each sound goes to the shape it is nearest; while there is room for another
 * kind, a sound unlike the first starts it.
 */
export function learn(
  model: Toneprint | null,
  prints: readonly (readonly number[])[],
  scores: readonly number[],
  kinds: 1 | 2 = 1,
): Toneprint {
  let means = model?.means.map((m) => m.slice()) ?? []
  let spreads = model?.spreads.map((s) => s.slice()) ?? []
  let counts = model?.counts.slice() ?? []
  let count = model?.count ?? 0
  for (const raw of prints) {
    const p = normalize(raw)
    if (p.length === 0) continue
    // Another detector's prints: start over.
    if (means[0] && means[0].length !== p.length) {
      means = []
      spreads = []
      counts = []
      count = 0
    }
    count += 1
    let k = 0
    for (let i = 1; i < means.length; i += 1) {
      if (cosine(p, means[i]!) > cosine(p, means[k]!)) k = i
    }
    if (!means[k] || (means.length < kinds && cosine(p, means[k]!) < MIN_SIMILARITY)) {
      means.push(p)
      spreads.push(p.map(() => 0))
      counts.push(1)
      continue
    }
    counts[k] = counts[k]! + 1
    const rate = Math.max(1 / counts[k]!, MIN_RATE)
    const mean = means[k]!
    const spread = spreads[k]!
    for (let i = 0; i < p.length; i += 1) {
      const d = p[i]! - mean[i]!
      mean[i] = mean[i]! + rate * d
      spread[i] = (1 - rate) * (spread[i]! + rate * d * d)
    }
    means[k] = normalize(mean)
  }
  return {
    means,
    spreads,
    counts,
    count,
    scores: [...(model?.scores ?? []), ...scores].slice(-MAX_SCORES),
  }
}

/**
 * "Learn my ball": the hits the player made on purpose replace what was
 * learned, and are enough on their own to judge.
 */
export function learnGuided(
  prints: readonly (readonly number[])[],
  scores: readonly number[],
  kinds: 1 | 2 = 1,
): Toneprint {
  const model = learn(null, prints, scores, kinds)
  return { ...model, count: Math.max(model.count, MIN_EXAMPLES) }
}

/**
 * The threshold that keeps the player's hits with room to spare: 0.6 × the
 * 10th percentile of real hit scores, within 3..40. Null until enough hits.
 */
export function suggestThreshold(model: Toneprint | null): number | null {
  if (!model || model.scores.length < GUIDED_HITS) return null
  const sorted = [...model.scores].sort((a, b) => a - b)
  const p10 = sorted[Math.floor(0.1 * (sorted.length - 1))]!
  return Math.min(40, Math.max(3, 0.6 * p10))
}

/** Hit times at a steady pace: intervals whose spread is under half their mean. */
export function steadyRhythm(times: readonly number[]): boolean {
  if (times.length < 3) return false
  const gaps = times.slice(1).map((t, i) => t - times[i]!)
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  if (avg <= 0) return false
  const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - avg) ** 2, 0) / gaps.length)
  return sd / avg < MAX_RHYTHM_CV
}

/**
 * A rally surely made of real hits: all picked up by the sensors (no tap, no
 * correction), at least four, at a steady pace. Only these teach the model.
 */
export function learnable(rally: Rally): boolean {
  if (rally.count !== undefined) return false
  if (rally.hits.some((h) => h.sources.includes('manual'))) return false
  if (rally.hits.length < MIN_LEARN_HITS) return false
  return steadyRhythm(rally.hits.map((h) => h.t))
}
