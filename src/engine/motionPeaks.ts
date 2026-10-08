// Accelerometer impacts: a jump landing, a racket hit felt through the arm or
// the pocket. Gravity and slow movement are removed with a moving baseline;
// what is left must stand out from the last two seconds (median + k·MAD) and
// clear an absolute floor, so a phone lying still never "hears" anything.

import type { HitCandidate } from './types.ts'

export interface MotionSample {
  /** Epoch ms. */
  t: number
  /** Acceleration including gravity, m/s². */
  x: number
  y: number
  z: number
}

export interface MotionOptions {
  refractoryMs: number
  threshold?: number
  /** Smallest impact that can count, m/s² above the baseline. */
  floor?: number
  windowMs?: number
}

export interface MotionCandidate extends HitCandidate {
  score: number
}

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

export class MotionPeakDetector {
  threshold: number
  private readonly floor: number
  private readonly refractory: number
  private readonly windowMs: number
  private baseline: number | null = null
  private history: { t: number; v: number }[] = []
  private prev: { t: number; v: number; bar: number } | null = null
  private prevPrev = 0
  private lastPeak = -Infinity

  constructor(opts: MotionOptions) {
    this.refractory = opts.refractoryMs
    this.threshold = opts.threshold ?? 6
    this.floor = opts.floor ?? 2.5
    this.windowMs = opts.windowMs ?? 2000
  }

  push(sample: MotionSample): MotionCandidate | null {
    const magnitude = Math.hypot(sample.x, sample.y, sample.z)
    this.baseline ??= magnitude
    const v = Math.abs(magnitude - this.baseline)
    // Slow baseline (~0.3 s): follows gravity and posture, not impacts.
    this.baseline += 0.05 * (magnitude - this.baseline)

    const recent = this.history.map((h) => h.v)
    const med = recent.length ? median(recent) : 0
    const mad = recent.length ? median(recent.map((r) => Math.abs(r - med))) : 0
    const bar = Math.max(this.floor, med + this.threshold * Math.max(mad, 0.05))

    this.history.push({ t: sample.t, v })
    while (this.history.length && this.history[0]!.t < sample.t - this.windowMs)
      this.history.shift()

    let out: MotionCandidate | null = null
    const p = this.prev
    if (
      p &&
      p.v > p.bar &&
      p.v >= this.prevPrev &&
      p.v > v &&
      p.t - this.lastPeak >= this.refractory
    ) {
      this.lastPeak = p.t
      out = {
        t: p.t,
        source: 'motion',
        confidence: Math.min(1, 1 - p.bar / p.v + 0.05),
        score: p.v / p.bar,
      }
    }
    this.prevPrev = p?.v ?? 0
    this.prev = { t: sample.t, v, bar }
    return out
  }
}
