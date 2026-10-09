// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { initialLive, liveStep, matchPoints, type LiveAction, type LiveState } from './live.ts'
import type { RallyConfig } from './rally.ts'

const CFG: RallyConfig = { timeoutMs: 2000, refractoryMs: 100, minHits: 1 }
const tap = (t: number): LiveAction => ({
  type: 'hit',
  hit: { t, sources: ['manual'], confidence: 1 },
})

const run = (actions: LiveAction[]): LiveState =>
  actions.reduce((s, a) => liveStep(s, a, CFG), initialLive())

describe('live session', () => {
  test('a rally that times out is kept', () => {
    const s = run([tap(0), tap(500), { type: 'tick', t: 5000 }])
    expect(s.rallies).toHaveLength(1)
    expect(s.rally.phase).toBe('idle')
  })

  test('awarding a point during a rally closes it with that winner', () => {
    const s = run([tap(0), tap(500), { type: 'point', side: 'B', t: 900 }])
    expect(s.rallies[0]).toMatchObject({ endReason: 'manual', endedAt: 900, winner: 'B' })
    expect(matchPoints(s.rallies)).toEqual(['B'])
  })

  test('awarding a point after a rally ended assigns it to that rally', () => {
    const s = run([tap(0), { type: 'tick', t: 5000 }, { type: 'point', side: 'A', t: 6000 }])
    expect(s.rallies).toHaveLength(1)
    expect(s.rallies[0]?.winner).toBe('A')
  })

  test('awaitingWinner is true while the last rally has no winner', () => {
    expect(run([tap(0), { type: 'tick', t: 5000 }]).awaitingWinner).toBe(true)
    expect(run([tap(0), { type: 'point', side: 'A', t: 10 }]).awaitingWinner).toBe(false)
  })

  test('a point with no rally at all is recorded as an empty rally', () => {
    const s = run([{ type: 'point', side: 'A', t: 10 }])
    expect(s.rallies).toEqual([
      { startedAt: 10, endedAt: 10, hits: [], endReason: 'manual', winner: 'A' },
    ])
  })

  test('undoing a point removes the winner and drops an empty rally', () => {
    const s = run([
      tap(0),
      { type: 'point', side: 'A', t: 10 },
      { type: 'point', side: 'B', t: 20 },
      { type: 'undoPoint' },
    ])
    expect(matchPoints(s.rallies)).toEqual(['A'])
    expect(s.rallies).toHaveLength(1)
    const t = liveStep(s, { type: 'undoPoint' }, CFG)
    expect(t.rallies).toHaveLength(1)
    expect(t.rallies[0]?.winner).toBeUndefined()
  })

  test('lastEnded points at the rally that just finished', () => {
    const s = run([tap(0), tap(400), { type: 'tick', t: 5000 }])
    expect(s.lastEnded?.hits).toHaveLength(2)
    expect(run([tap(0)]).lastEnded).toBeNull()
  })

  test('discard drops the rally in progress without recording it', () => {
    const before = run([tap(0), tap(400), { type: 'tick', t: 5000 }])
    const s = [tap(6000), tap(6400), { type: 'discard' } as const].reduce(
      (acc: LiveState, a: LiveAction) => liveStep(acc, a, CFG),
      before,
    )
    expect(s.rally.phase).toBe('idle')
    expect(s.rallies).toBe(before.rallies)
    expect(s.lastEnded).toBeNull()
  })

  test('discard when idle keeps completed rallies', () => {
    const before = run([tap(0), { type: 'point', side: 'A', t: 10 }])
    const s = liveStep(before, { type: 'discard' }, CFG)
    expect(s.rallies).toEqual(before.rallies)
    expect(s.awaitingWinner).toBe(before.awaitingWinner)
    expect(s.rally.phase).toBe('idle')
  })
})

test('a tick that changes nothing returns the same state, so nothing re-renders', () => {
  const s = run([tap(0)])
  expect(liveStep(s, { type: 'tick', t: 100 }, CFG)).toBe(s)
})
