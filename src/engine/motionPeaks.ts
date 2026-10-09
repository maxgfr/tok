// Accelerometer impacts: a jump landing, a racket hit felt through the arm or
// the pocket. Gravity and slow movement are removed with a moving baseline;
// what is left must stand out from the last two seconds (median + k·MAD) and
// clear an absolute floor, so a phone lying still never "hears" anything.
// It runs on every sensor event, so its per-sample path allocates nothing.

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

/** Samples kept: two seconds at 200 Hz, more than any phone reports. */
const CAPACITY = 512

/** Stats are recomputed every this many samples: two seconds of history barely move in four. */
const STATS_EVERY = 4

const median = (sorted: Float64Array): number => {
  const n = sorted.length
  const mid = n >> 1
  return n % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export class MotionPeakDetector {
  threshold: number
  private readonly floor: number
  private readonly refractory: number
  private readonly windowMs: number
  private baseline: number | null = null
  // Ring buffer of the last `windowMs` of samples.
  private readonly times = new Float64Array(CAPACITY)
  private readonly values = new Float64Array(CAPACITY)
  private readonly scratch = new Float64Array(CAPACITY)
  private start = 0
  private count = 0
  private samples = 0
  private med = 0
  private mad = 0
  private hasPrev = false
  private readonly prev = { t: 0, v: 0, bar: 0 }
  private prevPrev = 0
  private lastPeak = -Infinity

  constructor(opts: MotionOptions) {
    this.refractory = opts.refractoryMs
    this.threshold = opts.threshold ?? 6
    this.floor = opts.floor ?? 2.5
    this.windowMs = opts.windowMs ?? 2000
  }

  push(sample: MotionSample): MotionCandidate | null {
    const { x, y, z } = sample
    const magnitude = Math.sqrt(x * x + y * y + z * z)
    this.baseline ??= magnitude
    const v = Math.abs(magnitude - this.baseline)
    // Slow baseline (~0.3 s): follows gravity and posture, not impacts.
    this.baseline += 0.05 * (magnitude - this.baseline)

    // Median and MAD of the recent past, this sample excluded.
    if (this.samples % STATS_EVERY === 0) this.stats()
    this.samples += 1
    const bar = Math.max(this.floor, this.med + this.threshold * Math.max(this.mad, 0.05))

    if (this.count === CAPACITY) this.drop()
    const end = (this.start + this.count) % CAPACITY
    this.times[end] = sample.t
    this.values[end] = v
    this.count += 1
    while (this.count && this.times[this.start]! < sample.t - this.windowMs) this.drop()

    let out: MotionCandidate | null = null
    const p = this.prev
    if (
      this.hasPrev &&
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
    this.prevPrev = this.hasPrev ? p.v : 0
    this.hasPrev = true
    p.t = sample.t
    p.v = v
    p.bar = bar
    return out
  }

  private drop(): void {
    this.start = (this.start + 1) % CAPACITY
    this.count -= 1
  }

  private stats(): void {
    const n = this.count
    if (n === 0) {
      this.med = 0
      this.mad = 0
      return
    }
    const view = this.scratch.subarray(0, n)
    for (let i = 0; i < n; i += 1) view[i] = this.values[(this.start + i) % CAPACITY]!
    view.sort()
    this.med = median(view)
    for (let i = 0; i < n; i += 1) view[i] = Math.abs(view[i]! - this.med)
    view.sort()
    this.mad = median(view)
  }
}
