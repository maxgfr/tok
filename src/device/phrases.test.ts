import { describe, expect, test } from 'vitest'
import { replay, type ScoringRules, type Side } from '../engine/scoring/index.ts'
import { matchPhrase, rallyPhrase } from './phrases.ts'

const NAMES = { A: 'Max', B: 'Léa' }
const TT: ScoringRules = {
  kind: 'rally',
  pointsToWin: 11,
  setsToWin: 3,
  winBy: 2,
  serve: { every: 2, deuceEvery: 1 },
}
const TENNIS: ScoringRules = { kind: 'tennis', setsToWin: 2, gamesPerSet: 6, tiebreakPoints: 7 }
const times = (s: Side, n: number): Side[] => Array.from({ length: n }, () => s)

describe('rallyPhrase', () => {
  test('a plain rally reads its count and today’s best', () => {
    expect(rallyPhrase({ count: 23, record: false, todayBest: false, goal: null }, 41)).toBe(
      '23. Best today, 41.',
    )
  })

  test('a record is cheered', () => {
    expect(rallyPhrase({ count: 142, record: true, todayBest: false, goal: null }, 142)).toBe(
      'New record! 142.',
    )
  })

  test('a best of the day is cheered', () => {
    expect(rallyPhrase({ count: 50, record: false, todayBest: true, goal: null }, 50)).toBe(
      'Best today! 50.',
    )
  })

  test('reaching the goal wins over everything else', () => {
    expect(rallyPhrase({ count: 100, record: true, todayBest: false, goal: 100 }, 100)).toBe(
      'Goal! 100.',
    )
  })
})

describe('matchPhrase', () => {
  test('rally scoring calls the server’s score first', () => {
    // A served first; after 3 points (A, A, B) the serve passed to B at point 2.
    const view = replay(TT, ['A', 'A', 'B'], 'A')
    expect(matchPhrase(view, NAMES, TT)).toBe('1, 2. Léa serves.')
  })

  test('set point and match point are announced', () => {
    expect(matchPhrase(replay(TT, times('A', 10), 'A'), NAMES, TT)).toMatch(/Set point\.$/)
    const matchPoint = replay(TT, [...times('A', 22), ...times('A', 10)], 'A')
    expect(matchPhrase(matchPoint, NAMES, TT)).toMatch(/Match point\.$/)
  })

  test('the winner is announced', () => {
    expect(matchPhrase(replay(TT, times('B', 33), 'A'), NAMES, TT)).toBe(
      'Game, set and match, Léa!',
    )
  })

  test('tennis speaks love, deuce and advantage', () => {
    expect(matchPhrase(replay(TENNIS, ['A'], 'A'), NAMES, TENNIS)).toBe('Fifteen, love.')
    const deuce: Side[] = ['A', 'A', 'A', 'B', 'B', 'B']
    expect(matchPhrase(replay(TENNIS, deuce, 'A'), NAMES, TENNIS)).toBe('Deuce.')
    expect(matchPhrase(replay(TENNIS, [...deuce, 'B'], 'A'), NAMES, TENNIS)).toBe('Advantage, Léa.')
  })

  test('tennis calls the games at the start of a game', () => {
    expect(matchPhrase(replay(TENNIS, times('A', 4), 'A'), NAMES, TENNIS)).toBe(
      'Games: Max 1, Léa 0.',
    )
  })
})
