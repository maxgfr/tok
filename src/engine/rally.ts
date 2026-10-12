// The rally state machine: idle → (armed) → rally → (ended) → idle. Pure — the
// clock arrives as `tick` events, so a recorded session replays exactly.
//
// One sound is not a rally: a door, a voice, a paddle put down. A sensor hit
// from idle only arms the machine; a second one within `confirmMs` opens the
// rally with both, otherwise a tick drops it without a trace. A tap is
// deliberate and opens the rally at once.
//
// Rhythm guard: once a rally has found its pace (three hits), a sensor hit
// far quicker than that pace is an echo, a double "tok" or the racket's frame,
// not the next hit. Only for sports with one sound per hit.

import type { Hit, Rally, RallyEndReason } from './types.ts'

export interface RallyConfig {
  /** No hit for this long ends the rally; 0: only the player ends it. */
  timeoutMs: number
  /** Sensor hits closer than this to the previous one are echoes, not hits. */
  refractoryMs: number
  /** Rallies with fewer hits that end on their own are noise, not rallies. */
  minHits: number
  /** How long a lone sensor hit waits for a second one before it is dropped. */
  confirmMs: number
  /** Drop sensor hits under `RHYTHM_FLOOR` of the rally's pace (one sound per hit only). */
  rhythmGuard?: boolean
}

/** A sensor hit quicker than this share of the rally's median interval is dropped. */
export const RHYTHM_FLOOR = 0.4

function medianGap(hits: readonly Hit[]): number {
  const gaps = hits
    .slice(1)
    .map((h, i) => h.t - hits[i]!.t)
    .sort((a, b) => a - b)
  const mid = gaps.length >> 1
  return gaps.length % 2 ? gaps[mid]! : (gaps[mid - 1]! + gaps[mid]!) / 2
}

export interface RallyState {
  /** `armed`: one sensor hit heard, waiting for a second to open the rally. */
  phase: 'idle' | 'armed' | 'rally'
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

const timedOut = (silenceMs: number, cfg: RallyConfig): boolean =>
  cfg.timeoutMs > 0 && silenceMs > cfg.timeoutMs

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
      // The silence already ended this rally, even if the tick that says so is
      // late (a busy or throttled page): close it, then start afresh.
      if (state.phase === 'rally' && last && timedOut(event.hit.t - last.t, cfg)) {
        const closed = close(state, last.t, 'timeout', cfg)
        return { state: rallyStep(closed.state, event, cfg).state, ended: closed.ended }
      }
      const manual = event.hit.sources.includes('manual')
      if (last && !manual && event.hit.t - last.t < cfg.refractoryMs) return unchanged(state)
      if (
        last &&
        !manual &&
        cfg.rhythmGuard &&
        state.phase === 'rally' &&
        state.hits.length >= 3 &&
        event.hit.t - last.t < RHYTHM_FLOOR * medianGap(state.hits)
      ) {
        return unchanged(state)
      }
      if (!manual && state.phase === 'idle') {
        return unchanged({ phase: 'armed', hits: [event.hit] })
      }
      // The armed hit waited too long: this one arms afresh.
      if (!manual && state.phase === 'armed' && last && event.hit.t - last.t > cfg.confirmMs) {
        return unchanged({ phase: 'armed', hits: [event.hit] })
      }
      return { state: { phase: 'rally', hits: [...state.hits, event.hit] }, ended: null }
    }
    case 'tick':
      if (state.phase === 'armed' && last && event.t - last.t > cfg.confirmMs) {
        return unchanged(idleRally())
      }
      if (state.phase !== 'rally' || !last || !timedOut(event.t - last.t, cfg)) {
        return unchanged(state)
      }
      return close(state, last.t, 'timeout', cfg)
    case 'end':
      // An unconfirmed sound is not a rally to keep.
      if (state.phase === 'armed') return unchanged(idleRally())
      if (state.phase !== 'rally') return unchanged(state)
      return close(state, event.t, event.reason, cfg)
    case 'undo': {
      if (state.phase === 'armed') return unchanged(idleRally())
      const hits = state.hits.slice(0, -1)
      return unchanged(hits.length ? { phase: 'rally', hits } : idleRally())
    }
  }
}
