// Ball tracking from per-frame detections. A touch is the moment the ball's
// motion turns around: falling then rising (a volleyball pass, a keepy-uppy
// touch), or reversing sideways (a racket rally filmed side-on). The top of an
// arc is gravity, not a touch, so only down→up turns count vertically. A turn
// low in the frame is the ground, and a ball resting there ends the rally.

import type { HitCandidate } from './types.ts'

export interface BallObservation {
  /** Epoch ms. */
  t: number
  /** Centre, normalised 0..1, y pointing down. */
  x: number
  y: number
  score: number
}

export type TrackerEvent = { type: 'hit'; candidate: HitCandidate } | { type: 'ground'; t: number }

export interface TrackerOptions {
  refractoryMs: number
  /** Screen heights per second a ball must move to have a direction. */
  minSpeed?: number
  /** Below this line (0..1 from the top) is the floor. */
  groundY?: number
  /** A ball resting on the floor this long ends the rally. */
  restMs?: number
  /** Longer gaps between detections reset the track. */
  maxGapMs?: number
}

type Dir = -1 | 0 | 1

interface Axis {
  dir: Dir
  /** Consecutive samples agreeing on a new direction. */
  pending: Dir
  streak: number
  /** Extreme point of the current direction: where a turn happened. */
  extreme: { t: number; value: number; speed: number }
}

const axis = (): Axis => ({ dir: 0, pending: 0, streak: 0, extreme: { t: 0, value: 0, speed: 0 } })

export class BallTracker {
  private readonly refractory: number
  private readonly minSpeed: number
  private readonly groundY: number
  private readonly restMs: number
  private readonly maxGap: number
  private last: { t: number; x: number; y: number } | null = null
  private vertical = axis()
  private horizontal = axis()
  private lastHit = -Infinity
  private groundSent = false
  private restingSince: number | null = null

  constructor(opts: TrackerOptions) {
    this.refractory = opts.refractoryMs
    this.minSpeed = opts.minSpeed ?? 0.25
    this.groundY = opts.groundY ?? 0.88
    this.restMs = opts.restMs ?? 300
    this.maxGap = opts.maxGapMs ?? 300
  }

  push(t: number, obs: BallObservation | null): TrackerEvent[] {
    if (!obs) return []
    const prev = this.last
    if (!prev || t - prev.t > this.maxGap) {
      this.last = { t, x: obs.x, y: obs.y }
      this.vertical = axis()
      this.horizontal = axis()
      return []
    }
    // Light smoothing against detector jitter.
    const x = prev.x + 0.6 * (obs.x - prev.x)
    const y = prev.y + 0.6 * (obs.y - prev.y)
    const dt = (t - prev.t) / 1000
    const vx = (x - prev.x) / dt
    const vy = (y - prev.y) / dt
    this.last = { t, x, y }

    const events: TrackerEvent[] = []
    const turnY = this.step(this.vertical, vy, this.minSpeed, t, y)
    // Sideways needs more speed: jitter alone wanders a little horizontally.
    const turnX = this.step(this.horizontal, vx, this.minSpeed * 1.6, t, x)

    if (turnY && turnY.from === 1) {
      // Falling, then rising: a touch, or a bounce on the floor.
      if (turnY.value >= this.groundY) this.ground(turnY.t, events)
      else this.hit(turnY.t, turnY.speed + Math.abs(vy), events)
    } else if (turnX) {
      this.hit(turnX.t, turnX.speed + Math.abs(vx), events)
    }

    // At rest on the floor.
    const still = Math.hypot(vx, vy) < this.minSpeed
    if (y >= this.groundY && still) {
      this.restingSince ??= t
      if (t - this.restingSince >= this.restMs) this.ground(t, events)
    } else {
      this.restingSince = null
    }
    return events
  }

  private step(a: Axis, v: number, min: number, t: number, value: number) {
    const sign: Dir = v > min ? 1 : v < -min ? -1 : 0
    // Track the extreme of the current direction (largest value going +, smallest going −).
    if (a.dir === 1 && value >= a.extreme.value) a.extreme = { t, value, speed: Math.abs(v) }
    if (a.dir === -1 && value <= a.extreme.value) a.extreme = { t, value, speed: Math.abs(v) }
    if (sign === 0 || sign === a.dir) {
      a.pending = 0
      a.streak = 0
      return null
    }
    if (sign === a.pending) a.streak += 1
    else {
      a.pending = sign
      a.streak = 1
    }
    if (a.streak < 2) return null
    const from = a.dir
    const turn = { from, t: a.extreme.t, value: a.extreme.value, speed: a.extreme.speed }
    a.dir = sign
    a.pending = 0
    a.streak = 0
    a.extreme = { t, value, speed: Math.abs(v) }
    return from === 0 ? null : turn
  }

  private hit(t: number, speed: number, events: TrackerEvent[]) {
    if (t - this.lastHit < this.refractory) return
    this.lastHit = t
    this.groundSent = false
    const confidence = Math.min(1, Math.max(0.1, speed / (6 * this.minSpeed)))
    events.push({ type: 'hit', candidate: { t, source: 'vision', confidence } })
  }

  private ground(t: number, events: TrackerEvent[]) {
    if (this.groundSent) return
    this.groundSent = true
    events.push({ type: 'ground', t })
  }
}
