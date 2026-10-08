import { describe, expect, test } from 'vitest'
import { replay, type ScoringRules, type Side } from './index.ts'

const VOLLEY: ScoringRules = {
  kind: 'rally',
  pointsToWin: 25,
  decidingSetPoints: 15,
  setsToWin: 3,
  winBy: 2,
  serve: 'winner',
}
const TT: ScoringRules = {
  kind: 'rally',
  pointsToWin: 11,
  setsToWin: 3,
  winBy: 2,
  serve: { every: 2, deuceEvery: 1 },
}
const BADMINTON: ScoringRules = {
  kind: 'rally',
  pointsToWin: 21,
  setsToWin: 2,
  winBy: 2,
  cap: 30,
  serve: 'winner',
}
const TENNIS: ScoringRules = { kind: 'tennis', setsToWin: 2, gamesPerSet: 6, tiebreakPoints: 7 }
const NO_AD: ScoringRules = { ...TENNIS, goldenPoint: true }

const times = (side: Side, n: number): Side[] => Array.from({ length: n }, () => side)

describe('rally-point scoring', () => {
  test('counts points in the current set', () => {
    const v = replay(VOLLEY, ['A', 'A', 'B'], 'A')
    expect(v.current).toEqual({ A: '2', B: '1' })
    expect(v.sets).toEqual([])
  })

  test('a set ends at 25 with a two-point lead', () => {
    const v = replay(VOLLEY, [...times('B', 10), ...times('A', 25)], 'A')
    expect(v.sets).toEqual([{ A: 25, B: 10 }])
    expect(v.setsWon).toEqual({ A: 1, B: 0 })
    expect(v.current).toEqual({ A: '0', B: '0' })
  })

  test('a set goes on past 25 until someone leads by two', () => {
    const v = replay(VOLLEY, [...times('A', 24), ...times('B', 24), 'A', 'B', 'A'], 'A')
    expect(v.sets).toEqual([])
    expect(v.current).toEqual({ A: '26', B: '25' })
    const done = replay(VOLLEY, [...times('A', 24), ...times('B', 24), 'A', 'B', 'A', 'A'], 'A')
    expect(done.sets).toEqual([{ A: 27, B: 25 }])
  })

  test('the deciding set is played to 15', () => {
    const set = (s: Side) => times(s, 25)
    const v = replay(
      VOLLEY,
      [...set('A'), ...set('B'), ...set('A'), ...set('B'), ...times('B', 15)],
      'A',
    )
    expect(v.setsWon).toEqual({ A: 2, B: 3 })
    expect(v.winner).toBe('B')
  })

  test('points after the match is won are ignored', () => {
    const v = replay(BADMINTON, [...times('A', 21), ...times('A', 21), 'B'], 'A')
    expect(v.winner).toBe('A')
    expect(v.sets).toHaveLength(2)
  })

  test('a cap ends the set at 30 even without a two-point lead', () => {
    const alternating = Array.from({ length: 29 }).flatMap((): Side[] => ['A', 'B'])
    const v = replay(BADMINTON, [...alternating, 'A'], 'A')
    expect(v.sets).toEqual([{ A: 30, B: 29 }])
  })

  test('with winner-serves, the rally winner serves next', () => {
    expect(replay(VOLLEY, ['B'], 'A').server).toBe('B')
    expect(replay(VOLLEY, ['B', 'A'], 'A').server).toBe('A')
  })

  test('table tennis serve alternates every two points, then every point at deuce', () => {
    expect(replay(TT, [], 'A').server).toBe('A')
    expect(replay(TT, ['A'], 'A').server).toBe('A')
    expect(replay(TT, ['A', 'B'], 'A').server).toBe('B')
    expect(replay(TT, ['A', 'B', 'A', 'B'], 'A').server).toBe('A')
    const deuce = [...times('A', 10), ...times('B', 10)]
    expect(replay(TT, deuce, 'A').server).toBe('A')
    expect(replay(TT, [...deuce, 'A'], 'A').server).toBe('B')
  })

  test('table tennis: the first server alternates from set to set', () => {
    expect(replay(TT, times('A', 11), 'A').server).toBe('B')
  })

  test('flags set point and match point', () => {
    expect(replay(VOLLEY, times('A', 24), 'A').setPoint).toBe('A')
    expect(replay(BADMINTON, [...times('A', 21), ...times('A', 20)], 'A').matchPoint).toBe('A')
    expect(replay(VOLLEY, ['A'], 'A').setPoint).toBeNull()
  })
})

describe('tennis scoring', () => {
  test('points read 15, 30, 40', () => {
    expect(replay(TENNIS, ['A'], 'A').current).toEqual({ A: '15', B: '0' })
    expect(replay(TENNIS, ['A', 'A', 'B'], 'A').current).toEqual({ A: '30', B: '15' })
    expect(replay(TENNIS, ['A', 'A', 'A'], 'A').current).toEqual({ A: '40', B: '0' })
  })

  test('a game is won from 40 and the games count', () => {
    const v = replay(TENNIS, times('A', 4), 'A')
    expect(v.games).toEqual({ A: 1, B: 0 })
    expect(v.current).toEqual({ A: '0', B: '0' })
  })

  test('deuce and advantage', () => {
    const deuce = ['A', 'A', 'A', 'B', 'B', 'B'] as Side[]
    expect(replay(TENNIS, deuce, 'A').current).toEqual({ A: '40', B: '40' })
    expect(replay(TENNIS, [...deuce, 'B'], 'A').current).toEqual({ A: '40', B: 'AD' })
    expect(replay(TENNIS, [...deuce, 'B', 'A'], 'A').current).toEqual({ A: '40', B: '40' })
    expect(replay(TENNIS, [...deuce, 'B', 'B'], 'A').games).toEqual({ A: 0, B: 1 })
  })

  test('golden point: the point at deuce decides the game', () => {
    const deuce = ['A', 'A', 'A', 'B', 'B', 'B'] as Side[]
    expect(replay(NO_AD, [...deuce, 'B'], 'A').games).toEqual({ A: 0, B: 1 })
  })

  test('the server changes every game', () => {
    expect(replay(TENNIS, times('A', 4), 'A').server).toBe('B')
    expect(replay(TENNIS, times('A', 8), 'A').server).toBe('A')
  })

  test('a set is won 6-4 but not 6-5', () => {
    const game = (s: Side) => times(s, 4)
    const g64 = Array.from({ length: 4 }).flatMap(() => [...game('A'), ...game('B')])
    const v = replay(TENNIS, [...g64, ...game('A'), ...game('A')], 'A')
    expect(v.sets).toEqual([{ A: 6, B: 4 }])
    const g55 = Array.from({ length: 5 }).flatMap(() => [...game('A'), ...game('B')])
    expect(replay(TENNIS, [...g55, ...game('A')], 'A').games).toEqual({ A: 6, B: 5 })
    expect(replay(TENNIS, [...g55, ...game('A'), ...game('A')], 'A').sets).toEqual([{ A: 7, B: 5 }])
  })

  test('6-6 starts a tie-break to 7 by two', () => {
    const game = (s: Side) => times(s, 4)
    const g66 = Array.from({ length: 6 }).flatMap(() => [...game('A'), ...game('B')])
    const tb = replay(TENNIS, g66, 'A')
    expect(tb.tiebreak).toBe(true)
    expect(replay(TENNIS, [...g66, 'A', 'A'], 'A').current).toEqual({ A: '2', B: '0' })
    const v = replay(TENNIS, [...g66, ...times('A', 6), ...times('B', 6), 'A', 'A'], 'A')
    expect(v.sets).toEqual([{ A: 7, B: 6 }])
    expect(v.tiebreak).toBe(false)
  })

  test('tie-break serve: one point, then alternate every two', () => {
    const game = (s: Side) => times(s, 4)
    // 12 games played, A served first, so A serves the tie-break first.
    const g66 = Array.from({ length: 6 }).flatMap(() => [...game('A'), ...game('B')])
    expect(replay(TENNIS, g66, 'A').server).toBe('A')
    expect(replay(TENNIS, [...g66, 'A'], 'A').server).toBe('B')
    expect(replay(TENNIS, [...g66, 'A', 'B'], 'A').server).toBe('B')
    expect(replay(TENNIS, [...g66, 'A', 'B', 'A'], 'A').server).toBe('A')
    // After the tie-break, the other player serves the first game of the next set.
    expect(replay(TENNIS, [...g66, ...times('A', 7)], 'A').server).toBe('B')
  })

  test('the match ends when a player wins the required sets', () => {
    const set = (s: Side) => times(s, 24)
    const v = replay(TENNIS, [...set('A'), ...set('A')], 'A')
    expect(v.winner).toBe('A')
    expect(v.setsWon).toEqual({ A: 2, B: 0 })
  })

  test('flags match point at 40-0 in the last game', () => {
    const v = replay(TENNIS, [...times('A', 24), ...times('A', 20), ...times('A', 3)], 'A')
    expect(v.matchPoint).toBe('A')
  })
})
