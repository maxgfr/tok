import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { SensorKind } from '../../engine/types.ts'
import { clearAll, getSession, setSetting, type VideoRef } from '../../store/db.ts'
import { DEFAULT_CONFIG } from '../config.ts'
import { useLiveSession } from './useLiveSession.ts'

beforeEach(async () => {
  await clearAll()
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
    act(() => {
      result.current.sense({ t: Date.now(), sources: ['audio'], confidence: 1 })
      result.current.sense({ t: Date.now() + 300, sources: ['audio'], confidence: 1 })
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
