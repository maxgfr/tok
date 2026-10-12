// A session in progress: the rally machine plus the completed rallies and,
// in match mode, who won each one. The match score is derived from rallies,
// so there is exactly one list to persist and to undo.

import {
  idleRally,
  rallyStep,
  type RallyConfig,
  type RallyEvent,
  type RallyState,
} from './rally.ts'
import type { Side } from './scoring/index.ts'
import type { Rally } from './types.ts'

export interface LiveState {
  rally: RallyState
  rallies: Rally[]
  /** The most recently completed rally, for the end-of-rally flash. */
  lastEnded: Rally | null
  /** Match mode: a rally ended and nobody has been given its point yet. */
  awaitingWinner: boolean
}

export type LiveAction =
  | RallyEvent
  | { type: 'point'; side: Side; t: number }
  | { type: 'undoPoint' }
  /** Throw away the rally in progress: the count goes back to 0, nothing is kept. */
  | { type: 'discard' }

export const initialLive = (): LiveState => ({
  rally: idleRally(),
  rallies: [],
  lastEnded: null,
  awaitingWinner: false,
})

export const matchPoints = (rallies: readonly Rally[]): Side[] =>
  rallies.flatMap((r) => (r.winner ? [r.winner] : []))

function withRallies(state: LiveState, rallies: Rally[], rally: RallyState): LiveState {
  const last = rallies.at(-1)
  return {
    rally,
    rallies,
    lastEnded: state.rallies === rallies ? state.lastEnded : (last ?? null),
    awaitingWinner: rallies.some((r) => !r.winner),
  }
}

export function liveStep(state: LiveState, action: LiveAction, cfg: RallyConfig): LiveState {
  switch (action.type) {
    case 'point': {
      if (state.rally.phase === 'rally') {
        const { ended } = rallyStep(
          state.rally,
          { type: 'end', t: action.t, reason: 'manual' },
          cfg,
        )
        if (ended) {
          return withRallies(
            state,
            [...state.rallies, { ...ended, winner: action.side, wonAt: action.t }],
            idleRally(),
          )
        }
      }
      // A lone unconfirmed sound is not part of the point.
      const rally = state.rally.phase === 'armed' ? idleRally() : state.rally
      // The oldest rally still waiting for its point gets it: after an undo
      // that can be an earlier one, then the next tap goes to the later one.
      const waiting = state.rallies.findIndex((r) => !r.winner)
      if (waiting >= 0) {
        const rallies = [...state.rallies]
        rallies[waiting] = { ...rallies[waiting]!, winner: action.side, wonAt: action.t }
        return withRallies(state, rallies, rally)
      }
      const empty: Rally = {
        startedAt: action.t,
        endedAt: action.t,
        hits: [],
        endReason: 'manual',
        winner: action.side,
        wonAt: action.t,
      }
      return withRallies(state, [...state.rallies, empty], rally)
    }
    case 'undoPoint': {
      // The point given last, which is not always the last rally's: after an
      // undo, an earlier rally can get its point after a later one.
      let index = -1
      state.rallies.forEach((r, i) => {
        if (!r.winner) return
        const latest = state.rallies[index]
        if (!latest || (r.wonAt ?? -Infinity) >= (latest.wonAt ?? -Infinity)) index = i
      })
      const target = state.rallies[index]
      if (!target) return state
      const rallies = [...state.rallies]
      if (target.hits.length === 0) rallies.splice(index, 1)
      else {
        const { winner: _winner, wonAt: _wonAt, ...rest } = target
        rallies[index] = rest
      }
      return { ...withRallies(state, rallies, state.rally), lastEnded: state.lastEnded }
    }
    case 'discard':
      return { ...state, rally: idleRally(), lastEnded: null }
    default: {
      const { state: rally, ended } = rallyStep(state.rally, action, cfg)
      if (ended) return withRallies(state, [...state.rallies, ended], rally)
      // Ticks mostly change nothing; keep the identity so React skips the render.
      return rally === state.rally ? state : { ...state, rally }
    }
  }
}
