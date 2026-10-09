// Audio onset detection: the "tok" of a ball on a paddle.
//
// Spectral flux restricted to the sport's band (how much new energy appeared
// since the previous frame), against an adaptive threshold: the running median
// plus `threshold` × the median absolute deviation over the last second. That
// keeps it working on a quiet indoor table and next to the waves alike. A peak
// must be a local maximum and respect a refractory period, so a ringing paddle
// is one hit, not three.
//
// Voice filter: a hit is a transient. Its in-band energy jumps from what was
// there before and collapses within tens of milliseconds; a voice (or a
// squeak) holds it for the whole vowel. So a peak must at least triple the
// band energy, and is only reported once that energy has fallen under
// `decayRatio` of its peak, or dropped if that has not happened within `decayMs`.
//
// Pure TS: it runs in the AudioWorklet and in tests, and its per-frame path
// allocates nothing.

import { FFT } from './fft.ts'

export interface OnsetOptions {
  sampleRate: number
  bandHz: [number, number]
  refractoryMs: number
  /** How many MADs above the median a peak must reach. Lower = more sensitive. */
  threshold?: number
  frameSize?: number
  hop?: number
  /** Length of the adaptive-threshold memory. */
  windowMs?: number
  /** Drop peaks whose energy does not decay like a hit's. On by default. */
  voiceFilter?: boolean
  /** How long a peak has to decay. */
  decayMs?: number
  /** The fraction of its peak energy a hit must fall under within `decayMs`. */
  decayRatio?: number
}

export interface Onset {
  /** Seconds since the first sample pushed. */
  t: number
  /** Peak height in MADs above the median: what calibration ranks. */
  score: number
  confidence: number
}

export interface Level {
  flux: number
  /** median + threshold × spread: the bar a peak must clear. */
  threshold: number
  score: number
  median: number
  spread: number
}

export const DEFAULT_THRESHOLD = 8

const NONE: readonly Onset[] = Object.freeze([])

/** Stats are recomputed every this many frames: the median of a second barely moves in 20 ms. */
const STATS_EVERY = 4

/** How long the energy must stay under `decayRatio` to count as a decay. */
const QUIET_MS = 10

/** How many times the band energy must grow over an attack for the voice filter to take it. */
const ATTACK_RISE = 3

/** Band energies kept: the current frame and the five before it. */
const ENERGY_FRAMES = 6

const median = (sorted: Float32Array): number => {
  const n = sorted.length
  const mid = n >> 1
  return n % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export class OnsetDetector {
  threshold: number
  voiceFilter: boolean
  /** Peaks set aside because their energy held, like a voice's. */
  rejected = 0
  private readonly sr: number
  private readonly n: number
  private readonly hop: number
  private readonly refractory: number
  private readonly fft: FFT
  private readonly window: Float32Array
  private readonly ring: Float32Array
  private ringPos = 0
  private filled = 0
  private sinceHop = 0
  private samples = 0
  private readonly re: Float32Array
  private readonly im: Float32Array
  private readonly prevMag: Float32Array
  private readonly lo: number
  private readonly hi: number
  private readonly history: Float32Array
  private readonly scratch: Float32Array
  private historyPos = 0
  private historyCount = 0
  private frames = 0
  private med = 0
  private mad = 0
  private readonly prev = { flux: 0, score: 0, t: 0 }
  private readonly energies = new Float64Array(ENERGY_FRAMES)
  private energyPos = 0
  private prevPrevFlux = 0
  private lastOnset = -Infinity
  private readonly last: Level = { flux: 0, threshold: 0, score: 0, median: 0, spread: 0 }
  private readonly decayFrames: number
  private readonly decayRatio: number
  private readonly quietFrames: number
  /** A peak waiting for its energy to decay; `framesLeft === 0` when there is none. */
  private readonly pending = { t: 0, score: 0, peakEnergy: 0, quiet: 0, framesLeft: 0 }

  constructor(opts: OnsetOptions) {
    this.sr = opts.sampleRate
    this.n = opts.frameSize ?? 512
    this.hop = opts.hop ?? this.n / 2
    this.threshold = opts.threshold ?? DEFAULT_THRESHOLD
    this.voiceFilter = opts.voiceFilter ?? true
    this.decayRatio = opts.decayRatio ?? 0.3
    this.decayFrames = Math.ceil((((opts.decayMs ?? 80) / 1000) * this.sr) / this.hop)
    this.quietFrames = Math.ceil(((QUIET_MS / 1000) * this.sr) / this.hop)
    this.refractory = opts.refractoryMs / 1000
    this.fft = new FFT(this.n)
    this.window = new Float32Array(this.n)
    for (let i = 0; i < this.n; i += 1) {
      this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (this.n - 1))
    }
    this.ring = new Float32Array(this.n)
    this.re = new Float32Array(this.n)
    this.im = new Float32Array(this.n)
    this.prevMag = new Float32Array(this.n / 2)
    const binHz = this.sr / this.n
    this.lo = Math.max(1, Math.floor(opts.bandHz[0] / binHz))
    this.hi = Math.min(this.n / 2 - 1, Math.ceil(opts.bandHz[1] / binHz))
    const frames = Math.max(16, Math.round(((opts.windowMs ?? 1000) / 1000) * (this.sr / this.hop)))
    this.history = new Float32Array(frames)
    this.scratch = new Float32Array(frames)
  }

  level(): Level {
    return this.last
  }

  /** Onsets confirmed in this chunk; the same frozen empty array when there are none. */
  push(chunk: Float32Array): readonly Onset[] {
    let out: Onset[] | null = null
    for (let i = 0; i < chunk.length; i += 1) {
      this.ring[this.ringPos] = chunk[i]!
      this.ringPos = (this.ringPos + 1) % this.n
      this.samples += 1
      if (this.filled < this.n) this.filled += 1
      this.sinceHop += 1
      if (this.sinceHop >= this.hop && this.filled === this.n) {
        this.sinceHop = 0
        const onset = this.frame()
        if (onset) (out ??= []).push(onset)
      }
    }
    return out ?? NONE
  }

  private frame(): Onset | null {
    for (let i = 0; i < this.n; i += 1) {
      this.re[i] = this.ring[(this.ringPos + i) % this.n]! * this.window[i]!
      this.im[i] = 0
    }
    this.fft.transform(this.re, this.im)

    // Log-compressed magnitudes: quiet hits matter as much as loud ones.
    let flux = 0
    let energy = 0
    for (let k = this.lo; k <= this.hi; k += 1) {
      const re = this.re[k]!
      const im = this.im[k]!
      const power = re * re + im * im
      energy += power
      const mag = Math.log1p(1000 * Math.sqrt(power))
      const diff = mag - this.prevMag[k]!
      if (diff > 0) flux += diff
      this.prevMag[k] = mag
    }
    flux /= this.hi - this.lo + 1

    // Adaptive threshold from the recent past (this frame excluded).
    const count = this.historyCount
    if (count > 0 && this.frames % STATS_EVERY === 0) {
      const view = this.scratch.subarray(0, count)
      view.set(this.history.subarray(0, count))
      view.sort()
      this.med = median(view)
      for (let i = 0; i < count; i += 1) view[i] = Math.abs(view[i]! - this.med)
      view.sort()
      this.mad = median(view)
    }
    this.frames += 1
    this.history[this.historyPos] = flux
    this.historyPos = (this.historyPos + 1) % this.history.length
    this.historyCount = Math.min(this.historyCount + 1, this.history.length)

    const med = this.med
    const spread = Math.max(this.mad, 1e-3)
    const score = count < 8 ? 0 : (flux - med) / spread
    // The frame's centre is where its energy sits.
    const t = (this.samples - this.n / 2) / this.sr
    const { last } = this
    last.flux = flux
    last.threshold = med + this.threshold * spread
    last.score = score
    last.median = med
    last.spread = spread

    // A voice's energy flickers with its pitch period; two frames always hold a pulse.
    const { energies } = this
    const at = (back: number) => energies[(this.energyPos + ENERGY_FRAMES - back) % ENERGY_FRAMES]!
    energies[this.energyPos] = energy
    const envelope = energy + at(1)
    // What the band held before the attack: a hit rises well above it, a pulse inside a vowel does not.
    const before = at(4) + at(5)
    this.energyPos = (this.energyPos + 1) % ENERGY_FRAMES
    let onset: Onset | null = null
    const { pending } = this
    if (pending.framesLeft > 0) {
      if (envelope > pending.peakEnergy) pending.peakEnergy = envelope
      pending.quiet = envelope <= this.decayRatio * pending.peakEnergy ? pending.quiet + 1 : 0
      if (pending.quiet >= this.quietFrames) {
        pending.framesLeft = 0
        onset = this.onset(pending.t, pending.score)
      } else if (--pending.framesLeft === 0) {
        this.rejected += 1
      }
    }

    // A peak is confirmed one frame late, once the flux starts falling.
    const { prev } = this
    if (
      prev.score > this.threshold &&
      prev.flux >= this.prevPrevFlux &&
      prev.flux > flux &&
      prev.t - this.lastOnset >= this.refractory &&
      (!this.voiceFilter || envelope >= ATTACK_RISE * before)
    ) {
      this.lastOnset = prev.t
      if (!this.voiceFilter) onset = this.onset(prev.t, prev.score)
      else {
        // A new attack while the last one still rings: the last one never decayed.
        if (pending.framesLeft > 0) this.rejected += 1
        pending.t = prev.t
        pending.score = prev.score
        pending.peakEnergy = envelope
        pending.quiet = 0
        pending.framesLeft = this.decayFrames
      }
    }
    this.prevPrevFlux = prev.flux
    prev.flux = flux
    prev.score = score
    prev.t = t
    return onset
  }

  private onset(t: number, score: number): Onset {
    return { t, score, confidence: 1 - this.threshold / score }
  }
}

/**
 * From the peak scores recorded while the player made `expected` hits, the
 * threshold that keeps exactly those hits: halfway between the weakest hit and
 * the strongest non-hit, or 30% under the weakest hit when nothing else fired.
 */
export function calibrateThreshold(scores: readonly number[], expected: number): number | null {
  if (scores.length === 0 || expected < 1) return null
  const sorted = [...scores].sort((a, b) => b - a)
  const weakestHit = sorted[Math.min(expected, sorted.length) - 1]!
  const strongestMiss = sorted[expected]
  const value = strongestMiss === undefined ? weakestHit * 0.7 : (weakestHit + strongestMiss) / 2
  return Math.min(500, Math.max(2, value))
}
