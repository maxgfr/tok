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
  /** Match mode: the last rally ended and nobody has been given the point. */
  awaitingWinner: boolean
}

export type LiveAction =
  RallyEvent | { type: 'point'; side: Side; t: number } | { type: 'undoPoint' }

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
    awaitingWinner: !!last && !last.winner,
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
            [...state.rallies, { ...ended, winner: action.side }],
            idleRally(),
          )
        }
      }
      const last = state.rallies.at(-1)
      if (last && !last.winner) {
        return withRallies(
          state,
          [...state.rallies.slice(0, -1), { ...last, winner: action.side }],
          state.rally,
        )
      }
      const empty: Rally = {
        startedAt: action.t,
        endedAt: action.t,
        hits: [],
        endReason: 'manual',
        winner: action.side,
      }
      return withRallies(state, [...state.rallies, empty], state.rally)
    }
    case 'undoPoint': {
      const index = state.rallies.findLastIndex((r) => r.winner)
      const target = state.rallies[index]
      if (!target) return state
      const rallies = [...state.rallies]
      if (target.hits.length === 0) rallies.splice(index, 1)
      else {
        const { winner: _winner, ...rest } = target
        rallies[index] = rest
      }
      return { ...withRallies(state, rallies, state.rally), lastEnded: state.lastEnded }
    }
    default: {
      const { state: rally, ended } = rallyStep(state.rally, action, cfg)
      if (ended) return withRallies(state, [...state.rallies, ended], rally)
      return { ...state, rally }
    }
  }
}
