// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { countHits, dailySeries, summarize, tempo, type SessionLike } from './stats.ts'
import type { Hit, Rally, SensorKind } from './types.ts'

const hits = (n: number, source: SensorKind = 'audio', start = 0, gap = 1000): Hit[] =>
  Array.from({ length: n }, (_, i) => ({ t: start + i * gap, sources: [source], confidence: 1 }))

const rally = (n: number, start = 0): Rally => ({
  startedAt: start,
  endedAt: start + (n - 1) * 1000,
  hits: hits(n, 'audio', start),
  endReason: 'timeout',
})

const DAY = 86_400_000
const T0 = Date.UTC(2026, 9, 1, 10)

const session = (startedAt: number, lengths: number[]): SessionLike => ({
  sportId: 'beach-rackets',
  startedAt,
  rallies: lengths.map((n, i) => rally(n, startedAt + i * 60_000)),
})

describe('countHits', () => {
  test('one hit per detected hit by default', () => {
    expect(countHits(hits(5), 1)).toBe(5)
  })

  test('two sounds per hit halves sensor hits, rounding up', () => {
    expect(countHits(hits(5), 2)).toBe(3)
  })

  test('manual taps always count one', () => {
    expect(countHits([...hits(4), ...hits(2, 'manual')], 2)).toBe(4)
  })
})

describe('tempo', () => {
  test('hits per minute across a rally', () => {
    expect(tempo(rally(11))).toBe(60)
  })

  test('a rally shorter than two seconds has no meaningful tempo', () => {
    const quick: Rally = {
      startedAt: 0,
      endedAt: 900,
      hits: hits(4, 'audio', 0, 300),
      endReason: 'timeout',
    }
    expect(tempo(quick)).toBeNull()
  })

  test('a single hit has no tempo', () => {
    expect(tempo(rally(1))).toBeNull()
  })
})

describe('summarize', () => {
  test('best, average and count of rallies for a sport', () => {
    const s = summarize([session(T0, [3, 10, 5])], 'beach-rackets', 1, T0)
    expect(s.best).toBe(10)
    expect(s.rallies).toBe(3)
    expect(s.average).toBeCloseTo(6)
  })

  test('today best only looks at rallies from the same local day', () => {
    const s = summarize([session(T0 - 2 * DAY, [50]), session(T0, [7])], 'beach-rackets', 1, T0)
    expect(s.best).toBe(50)
    expect(s.todayBest).toBe(7)
  })

  test('other sports are ignored', () => {
    const s = summarize([{ ...session(T0, [9]), sportId: 'volleyball' }], 'beach-rackets', 1, T0)
    expect(s.best).toBe(0)
  })
})

describe('dailySeries', () => {
  test('one point per day with best and average, oldest first', () => {
    const series = dailySeries(
      [session(T0 + DAY, [4, 8]), session(T0, [2]), session(T0 + 60_000, [6])],
      'beach-rackets',
      1,
    )
    expect(series.map((d) => [d.best, d.average])).toEqual([
      [6, 4],
      [8, 6],
    ])
  })
})
