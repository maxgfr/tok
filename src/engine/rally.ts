// The rally state machine: idle → rally → (ended) → idle. Pure — the clock
// arrives as `tick` events, so a recorded session replays exactly.

import type { Hit, Rally, RallyEndReason } from './types.ts'

export interface RallyConfig {
  /** No hit for this long ends the rally. */
  timeoutMs: number
  /** Sensor hits closer than this to the previous one are echoes, not hits. */
  refractoryMs: number
  /** Rallies with fewer hits that end on their own are noise, not rallies. */
  minHits: number
}

export interface RallyState {
  phase: 'idle' | 'rally'
  hits: Hit[]
}

export type RallyEvent =
  | { type: 'hit'; hit: Hit }
  | { type: 'tick'; t: number }
  | { type: 'end'; t: number; reason: RallyEndReason }
  | { type: 'undo' }

export interface RallyTransition {
  state: RallyState
  /** Set on the transition that closes a rally worth keeping. */
  ended: Rally | null
}

export const idleRally = (): RallyState => ({ phase: 'idle', hits: [] })

const unchanged = (state: RallyState): RallyTransition => ({ state, ended: null })

function close(
  state: RallyState,
  endedAt: number,
  reason: RallyEndReason,
  cfg: RallyConfig,
): RallyTransition {
  const first = state.hits[0]
  if (!first) return unchanged(idleRally())
  if (reason !== 'manual' && state.hits.length < cfg.minHits) return unchanged(idleRally())
  return {
    state: idleRally(),
    ended: { startedAt: first.t, endedAt, hits: state.hits, endReason: reason },
  }
}

export function rallyStep(state: RallyState, event: RallyEvent, cfg: RallyConfig): RallyTransition {
  const last = state.hits.at(-1)
  switch (event.type) {
    case 'hit': {
      const manual = event.hit.sources.includes('manual')
      if (last && !manual && event.hit.t - last.t < cfg.refractoryMs) return unchanged(state)
      return { state: { phase: 'rally', hits: [...state.hits, event.hit] }, ended: null }
    }
    case 'tick':
      if (state.phase !== 'rally' || !last || event.t - last.t <= cfg.timeoutMs) {
        return unchanged(state)
      }
      return close(state, last.t, 'timeout', cfg)
    case 'end':
      if (state.phase !== 'rally') return unchanged(state)
      return close(state, event.t, event.reason, cfg)
    case 'undo': {
      const hits = state.hits.slice(0, -1)
      return unchanged(hits.length ? { phase: 'rally', hits } : idleRally())
    }
  }
}
