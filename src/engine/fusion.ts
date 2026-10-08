// Several sensors, one count. Each candidate votes with its sensor's weight for
// this sport; votes from different sensors within ±windowMs add up, and the
// first moment the total reaches `accept` the hit is emitted (at the earliest
// agreeing time). Later confirmations of an emitted hit are absorbed, so a hit
// heard by the mic and felt by the accelerometer still counts once.

import type { AutoSensor } from './sports.ts'
import type { Hit, HitCandidate, SensorKind } from './types.ts'

export interface FusionOptions {
  weights: Record<AutoSensor, number>
  windowMs?: number
  accept?: number
}

interface Pending {
  candidates: HitCandidate[]
  emitted: boolean
}

export class Fusion {
  private readonly weights: Record<AutoSensor, number>
  private readonly window: number
  private readonly accept: number
  private groups: Pending[] = []

  constructor(opts: FusionOptions) {
    this.weights = opts.weights
    this.window = opts.windowMs ?? 120
    this.accept = opts.accept ?? 0.6
  }

  private weight(source: SensorKind): number {
    return source === 'manual' ? Infinity : this.weights[source]
  }

  push(candidate: HitCandidate): Hit | null {
    // Forget groups that can no longer gain a vote.
    this.groups = this.groups.filter((g) => candidate.t - g.candidates[0]!.t <= this.window)

    const group = this.groups.find(
      (g) =>
        Math.abs(candidate.t - g.candidates[0]!.t) <= this.window &&
        !g.candidates.some((c) => c.source === candidate.source),
    )
    if (!group) {
      const fresh: Pending = { candidates: [candidate], emitted: false }
      this.groups.push(fresh)
      return this.decide(fresh)
    }
    group.candidates.push(candidate)
    return group.emitted ? null : this.decide(group)
  }

  private decide(group: Pending): Hit | null {
    const votes = group.candidates.reduce((sum, c) => sum + this.weight(c.source), 0)
    if (votes < this.accept) return null
    group.emitted = true
    const t = Math.min(...group.candidates.map((c) => c.t))
    const confidence = Math.max(...group.candidates.map((c) => c.confidence))
    return { t, sources: group.candidates.map((c) => c.source), confidence }
  }
}
