import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { SensorKind } from '../../engine/types.ts'
import {
  clearAll,
  getSession,
  saveSession,
  setSetting,
  type SessionRecord,
  type VideoRef,
} from '../../store/db.ts'
import { DEFAULT_CONFIG } from '../config.ts'
import { useLiveSession } from './useLiveSession.ts'

test('a match is played by the rules set for its sport', async () => {
  await setSetting('rules:table-tennis', { pointsToWin: 3, setsToWin: 1 })
  const config = { ...DEFAULT_CONFIG, mode: 'match' as const, input: 'manual' as const }
  const { result } = renderHook(() => useLiveSession(config, ['manual']))
  for (let i = 0; i < 3; i += 1) act(() => result.current.point('A'))
  // Official table tennis would still be at 3–0 in the first game.
  await waitFor(() => expect(result.current.match?.winner).toBe('A'))
})

beforeEach(async () => {
  await clearAll()
})

const pastSession = (startedAt: number, hits: number): SessionRecord => ({
  id: `past-${startedAt}`,
  sportId: 'table-tennis',
  mode: 'rally',
  startedAt,
  endedAt: startedAt + 60_000,
  sensors: ['manual'],
  rallies: [
    {
      startedAt,
      endedAt: startedAt + 10_000,
      hits: Array.from({ length: hits }, (_, i) => ({
        t: startedAt + i * 500,
        sources: ['manual' as const],
        confidence: 1,
      })),
      endReason: 'manual',
    },
  ],
  match: null,
})

test('a rally that ends before the history is read is not a false record', async () => {
  await saveSession(pastSession(Date.now() - 86_400_000 * 3, 50))
  const config = { ...DEFAULT_CONFIG, input: 'manual' as const }
  const { result } = renderHook(() => useLiveSession(config, ['manual']))
  act(() => {
    for (let i = 0; i < 3; i += 1) result.current.tap()
    result.current.endRally()
  })
  await waitFor(() => expect(result.current.verdict).not.toBeNull())
  expect(result.current.verdict).toMatchObject({ count: 3, record: false })
  expect(result.current.best).toBe(50)
})

test('once the match is won, no more points are given', async () => {
  await setSetting('rules:table-tennis', { pointsToWin: 3, setsToWin: 1 })
  const config = { ...DEFAULT_CONFIG, mode: 'match' as const, input: 'manual' as const }
  const { result } = renderHook(() => useLiveSession(config, ['manual']))
  await waitFor(() => expect(result.current.match).not.toBeNull())
  for (let i = 0; i < 3; i += 1) act(() => result.current.point('A'))
  await waitFor(() => expect(result.current.match?.winner).toBe('A'))
  act(() => result.current.point('B'))
  expect(result.current.rallies).toHaveLength(3)
})

test('past midnight, a rally is judged against the day it ended in', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: TIMERS })
  try {
    // Earlier that evening, a 20.
    vi.setSystemTime(new Date(2026, 9, 12, 20, 0))
    await saveSession(pastSession(Date.now(), 40))
    vi.setSystemTime(new Date(2026, 9, 12, 23, 59, 50))
    const config = { ...DEFAULT_CONFIG, sportId: 'beach-rackets' as const }
    const session = {
      ...pastSession(Date.now() - 3_600_000, 20),
      sportId: 'beach-rackets' as const,
    }
    await saveSession(session)
    const { result } = renderHook(() => useLiveSession(config, ['manual']))
    await waitFor(() => expect(result.current.todayBest).toBe(20))
    // The session started before midnight; this rally is played after: its 5 is that day's best.
    vi.setSystemTime(new Date(2026, 9, 13, 0, 0, 10))
    act(() => {
      for (let i = 0; i < 5; i += 1) result.current.tap()
      result.current.endRally()
    })
    await waitFor(() => expect(result.current.verdict).toMatchObject({ count: 5, todayBest: true }))
    expect(result.current.todayBest).toBe(5)
  } finally {
    vi.useRealTimers()
  }
})

// IndexedDB keeps its real setImmediate: a save queued on a fake one would
// never run, and every later transaction would wait behind it.
const TIMERS: NonNullable<Parameters<typeof vi.useFakeTimers>[0]>['toFake'] = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'Date',
]

const video: VideoRef = {
  file: 'x-1.webm',
  store: 'opfs',
  mimeType: 'video/webm',
  startedAt: 1,
  bytes: 10,
}

test('a recording is saved with the session from the moment it starts', async () => {
  const config = { ...DEFAULT_CONFIG, input: 'manual' as const }
  const { result } = renderHook(() => useLiveSession(config, ['manual']))
  act(() => result.current.addVideo(video))
  act(() => {
    result.current.tap()
    result.current.endRally()
  })
  // A crash now would still leave the session pointing to its file.
  await waitFor(async () => expect((await getSession(result.current.id))?.videos).toEqual([video]))
})

test('when no recording could be kept, the session points to none', async () => {
  const config = { ...DEFAULT_CONFIG, input: 'manual' as const }
  const { result } = renderHook(() => useLiveSession(config, ['manual']))
  act(() => result.current.addVideo(video))
  act(() => result.current.tap())
  await act(async () => {
    await result.current.finish({ videos: [] })
  })
  expect((await getSession(result.current.id))?.videos).toBeUndefined()
})

test('renders after finish never overwrite the final save', async () => {
  const config = { ...DEFAULT_CONFIG, input: 'manual' as const }
  const { result, rerender } = renderHook(({ sensors }) => useLiveSession(config, sensors), {
    initialProps: { sensors: ['manual'] as SensorKind[] },
  })
  act(() => {
    result.current.tap()
    result.current.tap()
  })
  act(() => result.current.endRally())
  let id: string | null = null
  await act(async () => {
    id = await result.current.finish({ videos: [video] })
  })
  // The live screen keeps rendering until the route changes: new sensor
  // arrays, ticks…
  for (let i = 0; i < 5; i += 1) rerender({ sensors: ['manual'] })
  await new Promise((r) => setTimeout(r, 50))
  await waitFor(async () => {
    const saved = await getSession(id!)
    expect(saved?.endedAt).not.toBeNull()
    expect(saved?.videos).toEqual([video])
  })
})

test('a sensor hit stamped in the future is stored at the present', async () => {
  const config = { ...DEFAULT_CONFIG, input: 'auto' as const }
  const { result } = renderHook(() => useLiveSession(config, ['audio']))
  const before = Date.now()
  act(() => {
    result.current.sense({ t: before - 500, sources: ['audio'], confidence: 1 })
    result.current.sense({ t: before + 60_000, sources: ['audio'], confidence: 1 })
  })
  act(() => result.current.endRally())
  const hits = result.current.rallies[0]?.hits ?? []
  expect(hits).toHaveLength(2)
  expect(hits[1]!.t).toBeLessThanOrEqual(Date.now())
})

test('an idle session does not re-render', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: TIMERS })
  try {
    const config = { ...DEFAULT_CONFIG, input: 'manual' as const }
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useLiveSession(config, ['manual'])
    })
    // Let the stored history and goal load.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    const settled = renders
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(renders).toBe(settled)
    expect(result.current.inRally).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})

test('with No limit, a rally waits for End rally, however long the silence', async () => {
  await setSetting('autoEnd:table-tennis', 0)
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: TIMERS })
  try {
    const config = { ...DEFAULT_CONFIG, input: 'auto' as const }
    const { result } = renderHook(() => useLiveSession(config, ['audio']))
    // Let the setting load.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    // Two hits: a lone sound would not open a rally.
    act(() => {
      result.current.sense({ t: Date.now(), sources: ['audio'], confidence: 1 })
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    act(() => {
      result.current.sense({ t: Date.now(), sources: ['audio'], confidence: 1 })
    })
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.inRally).toBe(true)
    expect(result.current.rallies).toHaveLength(0)
    act(() => result.current.endRally())
    expect(result.current.inRally).toBe(false)
    expect(result.current.rallies).toHaveLength(1)
  } finally {
    vi.useRealTimers()
  }
})

test('a lone sound never shows as 1, and is dropped even with No limit', async () => {
  await setSetting('autoEnd:beach-rackets', 0)
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: TIMERS })
  try {
    const config = { ...DEFAULT_CONFIG, sportId: 'beach-rackets' as const, input: 'auto' as const }
    const { result } = renderHook(() => useLiveSession(config, ['audio']))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    act(() => result.current.sense({ t: Date.now(), sources: ['audio'], confidence: 1 }))
    expect(result.current.count).toBe(0)
    expect(result.current.armed).toBe(true)
    expect(result.current.inRally).toBe(false)
    // Beach rackets: nothing within 2 s, nothing to keep.
    await act(async () => {
      vi.advanceTimersByTime(2_100)
    })
    expect(result.current.armed).toBe(false)
    expect(result.current.count).toBe(0)
    expect(result.current.rallies).toHaveLength(0)
  } finally {
    vi.useRealTimers()
  }
})

test('a second sound in time opens the rally straight at 2', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: TIMERS })
  try {
    const config = { ...DEFAULT_CONFIG, sportId: 'beach-rackets' as const, input: 'auto' as const }
    const { result } = renderHook(() => useLiveSession(config, ['audio']))
    act(() => result.current.sense({ t: Date.now(), sources: ['audio'], confidence: 1 }))
    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    act(() => result.current.sense({ t: Date.now(), sources: ['audio'], confidence: 1 }))
    expect(result.current.inRally).toBe(true)
    expect(result.current.count).toBe(2)
  } finally {
    vi.useRealTimers()
  }
})

test("when a sensed rally ends, the previous rally's verdict never shows in its place", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: TIMERS })
  try {
    const config = { ...DEFAULT_CONFIG, sportId: 'beach-rackets' as const, input: 'auto' as const }
    const shown: { inRally: boolean; rally: unknown }[] = []
    const { result } = renderHook(() => {
      const session = useLiveSession(config, ['audio'])
      shown.push({ inRally: session.inRally, rally: session.verdict?.rally })
      return session
    })
    const rally = async (hits: number) => {
      for (let i = 0; i < hits; i += 1) {
        act(() => result.current.sense({ t: Date.now(), sources: ['audio'], confidence: 1 }))
        await act(async () => {
          vi.advanceTimersByTime(500)
        })
      }
      act(() => result.current.endRally())
      await act(async () => {
        vi.advanceTimersByTime(50)
      })
    }
    await rally(3)
    const first = result.current.rallies[0]
    expect(result.current.verdict?.rally).toBe(first)
    shown.length = 0
    await rally(4)
    expect(result.current.verdict?.rally).toBe(result.current.rallies[1])
    // Up while the first sound waits for a second; gone for good once the rally opens.
    const opened = shown.findIndex((s) => s.inRally)
    expect(opened).toBeGreaterThan(0)
    expect(shown.slice(opened).map((s) => s.rally)).not.toContain(first)
  } finally {
    vi.useRealTimers()
  }
})

test("with the sport's automatic end set, a silence that long ends the rally", async () => {
  // Another sport's setting does not apply.
  await setSetting('autoEnd:beach-rackets', 1)
  await setSetting('autoEnd:table-tennis', 3)
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: TIMERS })
  try {
    const config = { ...DEFAULT_CONFIG, input: 'manual' as const }
    const { result } = renderHook(() => useLiveSession(config, ['manual']))
    // Let the setting load.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    act(() => {
      result.current.tap()
      result.current.tap()
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.inRally).toBe(true)
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.inRally).toBe(false)
    expect(result.current.rallies).toHaveLength(1)
  } finally {
    vi.useRealTimers()
  }
})

test("untouched, a rally ends after the sport's recommended silence", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: TIMERS })
  try {
    // Table tennis: 1.5 s without a hit.
    const config = { ...DEFAULT_CONFIG, input: 'manual' as const }
    const { result } = renderHook(() => useLiveSession(config, ['manual']))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    act(() => {
      result.current.tap()
      result.current.tap()
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.inRally).toBe(true)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.inRally).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})
