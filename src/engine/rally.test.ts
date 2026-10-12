// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { idleRally, rallyStep, type RallyConfig, type RallyState } from './rally.ts'
import type { Hit, SensorKind } from './types.ts'

const CFG: RallyConfig = { timeoutMs: 2000, refractoryMs: 150, minHits: 1, confirmMs: 1000 }
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
  test('a tap starts a rally at once', () => {
    const { state } = run([{ type: 'hit', hit: hit(1000, 'manual') }])
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

  test('a hit after the silence starts afresh even when the tick is late', () => {
    // The timeout tick never came (a throttled page): the next sound is not the
    // old rally's 4th hit, it ends that rally and arms a new one.
    const { state, ended } = run([500, 1000, 1500, 5000].map((t) => ({ type: 'hit', hit: hit(t) })))
    expect(ended.map((r) => [r.hits.length, r.endedAt, r.endReason])).toEqual([
      [3, 1500, 'timeout'],
    ])
    expect(state).toEqual({ phase: 'armed', hits: [hit(5000)] })
  })

  test('a late tap after the silence opens the next rally at once', () => {
    const { state, ended } = run([
      { type: 'hit', hit: hit(500) },
      { type: 'hit', hit: hit(1000) },
      { type: 'hit', hit: hit(5000, 'manual') },
    ])
    expect(ended).toHaveLength(1)
    expect(state).toEqual({ phase: 'rally', hits: [hit(5000, 'manual')] })
  })

  test('with no timeout, only the player ends a rally: a late hit joins it', () => {
    const cfg = { ...CFG, timeoutMs: 0 }
    const { state, ended } = run(
      [
        ...[500, 1000, 9000].map((t) => ({ type: 'hit' as const, hit: hit(t) })),
        { type: 'tick', t: 60_000 },
      ],
      cfg,
    )
    expect(ended).toEqual([])
    expect(state.hits.map((h) => h.t)).toEqual([500, 1000, 9000])
  })

  test('a tick before the timeout changes nothing', () => {
    const { state, ended } = run([
      { type: 'hit', hit: hit(1000, 'manual') },
      { type: 'tick', t: 2999 },
    ])
    expect(state.phase).toBe('rally')
    expect(ended).toEqual([])
  })

  test('an explicit end closes the rally with its reason', () => {
    const { ended } = run([
      { type: 'hit', hit: hit(1000, 'manual') },
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
        { type: 'hit', hit: hit(1000, 'manual') },
        { type: 'end', t: 1200, reason: 'manual' },
      ],
      { ...CFG, minHits: 2 },
    )
    expect(ended).toHaveLength(1)
  })

  describe('a lone sensor hit is not a rally yet', () => {
    test('it arms the machine without opening a rally', () => {
      const { state } = run([{ type: 'hit', hit: hit(1000) }])
      expect(state.phase).toBe('armed')
      expect(state.hits).toEqual([hit(1000)])
    })

    test('a second sensor hit in time opens the rally with both', () => {
      const { state } = run([
        { type: 'hit', hit: hit(1000) },
        { type: 'hit', hit: hit(1900) },
      ])
      expect(state.phase).toBe('rally')
      expect(state.hits.map((h) => h.t)).toEqual([1000, 1900])
    })

    test('with no second hit, a tick drops it without a trace', () => {
      const early = run([
        { type: 'hit', hit: hit(1000) },
        { type: 'tick', t: 2000 },
      ])
      expect(early.state.phase).toBe('armed')
      const late = run([
        { type: 'hit', hit: hit(1000) },
        { type: 'tick', t: 2001 },
      ])
      expect(late.state).toEqual(idleRally())
      expect(late.ended).toEqual([])
    })

    test('a second hit that comes too late arms afresh instead', () => {
      const { state } = run([
        { type: 'hit', hit: hit(1000) },
        { type: 'hit', hit: hit(2500) },
      ])
      expect(state).toEqual({ phase: 'armed', hits: [hit(2500)] })
    })

    test('ending or undoing drops it', () => {
      for (const event of [
        { type: 'end', t: 1200, reason: 'manual' } as const,
        { type: 'undo' } as const,
      ]) {
        const { state, ended } = run([{ type: 'hit', hit: hit(1000) }, event])
        expect(state).toEqual(idleRally())
        expect(ended).toEqual([])
      }
    })

    test('a tap while armed opens the rally', () => {
      const { state } = run([
        { type: 'hit', hit: hit(1000) },
        { type: 'hit', hit: hit(1300, 'manual') },
      ])
      expect(state.phase).toBe('rally')
      expect(state.hits).toHaveLength(2)
    })
  })

  describe('rhythm guard', () => {
    const GUARD = { ...CFG, rhythmGuard: true }
    const rally = (times: number[], cfg: RallyConfig = GUARD) =>
      run(
        times.map((t) => ({ type: 'hit', hit: hit(t) }) as const),
        cfg,
      ).state

    test('once the pace is set, an echo far quicker than it is dropped', () => {
      // 600 ms apart, then a "tok" 200 ms after the last: an echo.
      expect(rally([0, 600, 1200, 1400, 1800]).hits.map((h) => h.t)).toEqual([0, 600, 1200, 1800])
    })

    test('a hit a little quicker than the pace still counts', () => {
      expect(rally([0, 600, 1200, 1500]).hits).toHaveLength(4)
    })

    test('not before three hits, nor for taps, nor with the guard off', () => {
      expect(rally([0, 600, 800]).hits).toHaveLength(3)
      const tapped = run(
        [
          ...[0, 600, 1200].map((t) => ({ type: 'hit', hit: hit(t) }) as const),
          { type: 'hit', hit: hit(1300, 'manual') },
        ],
        GUARD,
      ).state
      expect(tapped.hits).toHaveLength(4)
      expect(rally([0, 600, 1200, 1400], CFG).hits).toHaveLength(4)
    })
  })
})
