import { describe, expect, test } from 'vitest'
import { idleRally, rallyStep, type RallyConfig, type RallyState } from './rally.ts'
import type { Hit, SensorKind } from './types.ts'

const CFG: RallyConfig = { timeoutMs: 2000, refractoryMs: 150, minHits: 1 }
const hit = (t: number, source: SensorKind = 'audio'): Hit => ({
  t,
  sources: [source],
  confidence: 1,
})

function run(events: Parameters<typeof rallyStep>[1][], cfg = CFG) {
  let state: RallyState = idleRally()
  const ended = []
  for (const e of events) {
    const r = rallyStep(state, e, cfg)
    state = r.state
    if (r.ended) ended.push(r.ended)
  }
  return { state, ended }
}

describe('rally state machine', () => {
  test('the first hit starts a rally', () => {
    const { state } = run([{ type: 'hit', hit: hit(1000) }])
    expect(state.phase).toBe('rally')
    expect(state.hits).toHaveLength(1)
  })

  test('hits accumulate', () => {
    const { state } = run([500, 1000, 1500].map((t) => ({ type: 'hit', hit: hit(t) })))
    expect(state.hits.map((h) => h.t)).toEqual([500, 1000, 1500])
  })

  test('a sensor hit inside the refractory period is dropped', () => {
    const { state } = run([
      { type: 'hit', hit: hit(1000) },
      { type: 'hit', hit: hit(1100) },
    ])
    expect(state.hits).toHaveLength(1)
  })

  test('manual taps are never dropped by the refractory period', () => {
    const { state } = run([
      { type: 'hit', hit: hit(1000, 'manual') },
      { type: 'hit', hit: hit(1050, 'manual') },
    ])
    expect(state.hits).toHaveLength(2)
  })

  test('silence longer than the timeout ends the rally at its last hit', () => {
    const { state, ended } = run([
      { type: 'hit', hit: hit(1000) },
      { type: 'hit', hit: hit(1800) },
      { type: 'tick', t: 3000 },
      { type: 'tick', t: 3900 },
    ])
    expect(state.phase).toBe('idle')
    expect(ended).toEqual([
      { startedAt: 1000, endedAt: 1800, hits: [hit(1000), hit(1800)], endReason: 'timeout' },
    ])
  })

  test('a tick before the timeout changes nothing', () => {
    const { state, ended } = run([
      { type: 'hit', hit: hit(1000) },
      { type: 'tick', t: 2999 },
    ])
    expect(state.phase).toBe('rally')
    expect(ended).toEqual([])
  })

  test('an explicit end closes the rally with its reason', () => {
    const { ended } = run([
      { type: 'hit', hit: hit(1000) },
      { type: 'end', t: 1500, reason: 'ground' },
    ])
    expect(ended[0]?.endReason).toBe('ground')
    expect(ended[0]?.endedAt).toBe(1500)
  })

  test('ending while idle does nothing', () => {
    expect(run([{ type: 'end', t: 1, reason: 'manual' }]).ended).toEqual([])
  })

  test('undo removes the last hit, and the rally when it was the only one', () => {
    const two = run([
      { type: 'hit', hit: hit(1000) },
      { type: 'hit', hit: hit(1500) },
      { type: 'undo' },
    ])
    expect(two.state.hits).toHaveLength(1)
    const one = run([{ type: 'hit', hit: hit(1000) }, { type: 'undo' }])
    expect(one.state.phase).toBe('idle')
  })

  test('rallies shorter than minHits are discarded when they time out', () => {
    const { ended, state } = run(
      [
        { type: 'hit', hit: hit(1000) },
        { type: 'tick', t: 5000 },
      ],
      { ...CFG, minHits: 2 },
    )
    expect(ended).toEqual([])
    expect(state.phase).toBe('idle')
  })

  test('a manual end keeps a short rally', () => {
    const { ended } = run(
      [
        { type: 'hit', hit: hit(1000) },
        { type: 'end', t: 1200, reason: 'manual' },
      ],
      { ...CFG, minHits: 2 },
    )
    expect(ended).toHaveLength(1)
  })
})
