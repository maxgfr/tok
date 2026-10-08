// Match scoring as a pure fold over the sequence of rally winners. The whole
// match is replayed from its point list, so undo is "drop the last point" and
// the stored session is the only state that has to survive a reload.

export type Side = 'A' | 'B'

export interface Score {
  A: number
  B: number
}

/** Who serves after a point: the rally winner, or a fixed rotation. */
export type ServeRule = 'winner' | { every: number; deuceEvery: number }

/** Rally-point scoring: volleyball, beach volley, badminton, table tennis… */
export interface RallyScoring {
  kind: 'rally'
  pointsToWin: number
  /** Target of the deciding set, when shorter (volleyball's 15). */
  decidingSetPoints?: number
  setsToWin: number
  winBy: number
  /** Hard ceiling where the next point wins regardless of the lead (badminton's 30). */
  cap?: number
  serve: ServeRule
}

/** 15-30-40 scoring with games, sets and tie-breaks: tennis and padel. */
export interface TennisScoring {
  kind: 'tennis'
  setsToWin: number
  gamesPerSet: number
  tiebreakPoints: number
  /** No-advantage: the point at deuce decides the game. */
  goldenPoint?: boolean
}

export type ScoringRules = RallyScoring | TennisScoring

export interface MatchView {
  /** Finished sets — points for rally scoring, games for tennis. */
  sets: Score[]
  setsWon: Score
  /** What the scoreboard shows for the point in progress. */
  current: { A: string; B: string }
  /** Games of the set in progress (tennis only). */
  games: Score | null
  server: Side
  winner: Side | null
  tiebreak: boolean
  setPoint: Side | null
  matchPoint: Side | null
}

interface State {
  sets: Score[]
  setsWon: Score
  pts: Score
  games: Score
  tiebreak: boolean
  winner: Side | null
  /** Who served first in the current set (rotation anchor). */
  setFirst: Side
  /** Games played in the whole match (tennis server alternation). */
  gamesPlayed: number
  server: Side
}

export const other = (side: Side): Side => (side === 'A' ? 'B' : 'A')

const zero = (): Score => ({ A: 0, B: 0 })

const initial = (firstServer: Side): State => ({
  sets: [],
  setsWon: zero(),
  pts: zero(),
  games: zero(),
  tiebreak: false,
  winner: null,
  setFirst: firstServer,
  gamesPlayed: 0,
  server: firstServer,
})

const clone = (s: State): State => ({
  ...s,
  sets: [...s.sets],
  setsWon: { ...s.setsWon },
  pts: { ...s.pts },
  games: { ...s.games },
})

function closeSet(s: State, final: Score, side: Side, setsToWin: number): void {
  s.sets.push(final)
  s.setsWon[side] += 1
  s.pts = zero()
  s.games = zero()
  s.tiebreak = false
  if (s.setsWon[side] >= setsToWin) s.winner = side
}

function rallyTarget(rules: RallyScoring, s: State): number {
  const deciding = s.setsWon.A === rules.setsToWin - 1 && s.setsWon.B === rules.setsToWin - 1
  return deciding && rules.decidingSetPoints ? rules.decidingSetPoints : rules.pointsToWin
}

function rallyServer(rules: RallyScoring, s: State, lastWinner: Side): Side {
  if (rules.serve === 'winner') return lastWinner
  const { every, deuceEvery } = rules.serve
  const n = s.pts.A + s.pts.B
  const deuceStart = 2 * (rallyTarget(rules, s) - 1)
  const turns =
    n < deuceStart
      ? Math.floor(n / every)
      : Math.floor(deuceStart / every) + Math.floor((n - deuceStart) / deuceEvery)
  return turns % 2 === 0 ? s.setFirst : other(s.setFirst)
}

function rallyPoint(rules: RallyScoring, s: State, side: Side): void {
  s.pts[side] += 1
  const target = rallyTarget(rules, s)
  const lead = s.pts[side] - s.pts[other(side)]
  const reachedCap = rules.cap !== undefined && s.pts[side] >= rules.cap
  if ((s.pts[side] >= target && lead >= rules.winBy) || reachedCap) {
    closeSet(s, { ...s.pts }, side, rules.setsToWin)
    if (rules.serve !== 'winner') s.setFirst = other(s.setFirst)
  }
  s.server = rallyServer(rules, s, side)
}

function tennisServer(firstServer: Side, s: State): Side {
  const gameServer = s.gamesPlayed % 2 === 0 ? firstServer : other(firstServer)
  if (!s.tiebreak) return gameServer
  // Tie-break: one point, then two each.
  const n = s.pts.A + s.pts.B
  return Math.floor((n + 1) / 2) % 2 === 0 ? gameServer : other(gameServer)
}

function winGame(rules: TennisScoring, s: State, side: Side): void {
  s.games[side] += 1
  s.gamesPlayed += 1
  s.pts = zero()
  const wasTiebreak = s.tiebreak
  s.tiebreak = false
  const lead = s.games[side] - s.games[other(side)]
  if (wasTiebreak || (s.games[side] >= rules.gamesPerSet && lead >= 2)) {
    closeSet(s, { ...s.games }, side, rules.setsToWin)
  } else if (s.games.A === rules.gamesPerSet && s.games.B === rules.gamesPerSet) {
    s.tiebreak = true
  }
}

function tennisPoint(rules: TennisScoring, firstServer: Side, s: State, side: Side): void {
  const opp = other(side)
  if (s.tiebreak) {
    s.pts[side] += 1
    if (s.pts[side] >= rules.tiebreakPoints && s.pts[side] - s.pts[opp] >= 2) {
      winGame(rules, s, side)
    }
  } else if (rules.goldenPoint && s.pts.A === 3 && s.pts.B === 3) {
    winGame(rules, s, side)
  } else {
    s.pts[side] += 1
    if (s.pts[side] >= 4 && s.pts[side] - s.pts[opp] >= 2) winGame(rules, s, side)
    // Back to deuce: keep the numbers small.
    else if (s.pts.A === s.pts.B && s.pts.A > 3) s.pts = { A: 3, B: 3 }
  }
  s.server = tennisServer(firstServer, s)
}

function step(rules: ScoringRules, firstServer: Side, state: State, side: Side): State {
  if (state.winner) return state
  const next = clone(state)
  if (rules.kind === 'rally') rallyPoint(rules, next, side)
  else tennisPoint(rules, firstServer, next, side)
  return next
}

const TENNIS_CALLS = ['0', '15', '30', '40']

function display(rules: ScoringRules, s: State): { A: string; B: string } {
  if (rules.kind === 'rally' || s.tiebreak) return { A: String(s.pts.A), B: String(s.pts.B) }
  const { A, B } = s.pts
  if (A >= 3 && B >= 3) {
    if (A === B) return { A: '40', B: '40' }
    return A > B ? { A: 'AD', B: '40' } : { A: '40', B: 'AD' }
  }
  return { A: TENNIS_CALLS[A] ?? '40', B: TENNIS_CALLS[B] ?? '40' }
}

/** Replays a match from the ordered list of rally winners. */
export function replay(rules: ScoringRules, points: readonly Side[], firstServer: Side): MatchView {
  let state = initial(firstServer)
  for (const side of points) state = step(rules, firstServer, state, side)

  let setPoint: Side | null = null
  let matchPoint: Side | null = null
  if (!state.winner) {
    for (const side of ['A', 'B'] as const) {
      const after = step(rules, firstServer, state, side)
      if (after.sets.length > state.sets.length) {
        setPoint ??= side
        if (after.winner) matchPoint ??= side
      }
    }
  }

  return {
    sets: state.sets,
    setsWon: state.setsWon,
    current: display(rules, state),
    games: rules.kind === 'tennis' ? state.games : null,
    server: state.server,
    winner: state.winner,
    tiebreak: state.tiebreak,
    setPoint,
    matchPoint,
  }
}
