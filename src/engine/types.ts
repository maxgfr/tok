import type { Side } from './scoring/index.ts'

/** Where a hit was picked up. `manual` is a tap or a remote button. */
export type SensorKind = 'audio' | 'motion' | 'vision' | 'manual'

/** One sensor's opinion that a hit happened at time `t` (ms, monotonic clock). */
export interface HitCandidate {
  t: number
  source: SensorKind
  /** 0..1 — how far above its adaptive threshold the detector fired. */
  confidence: number
}

/** A hit after fusion: one or more sources agreed. */
export interface Hit {
  t: number
  sources: SensorKind[]
  confidence: number
}

export type RallyEndReason = 'timeout' | 'ground' | 'manual'

export interface Rally {
  startedAt: number
  endedAt: number
  hits: Hit[]
  endReason: RallyEndReason
  /** Match mode: who won the point. */
  winner?: Side
  /** The player's own count, set when they corrected the rally afterwards. */
  count?: number
}
