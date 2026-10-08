import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { SensorKind } from '../../engine/types.ts'
import { clearAll, getSession, type VideoRef } from '../../store/db.ts'
import { DEFAULT_CONFIG } from '../config.ts'
import { useLiveSession } from './useLiveSession.ts'

beforeEach(async () => {
  await clearAll()
})

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

test('a sensor hit stamped in the future cannot keep a rally open forever', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    const config = { ...DEFAULT_CONFIG, input: 'auto' as const }
    const { result } = renderHook(() => useLiveSession(config, ['audio']))
    const future = Date.now() + 60_000
    act(() => {
      result.current.sense({ t: Date.now(), sources: ['audio'], confidence: 1 })
      result.current.sense({ t: future, sources: ['audio'], confidence: 1 })
    })
    // Table tennis times out after 1.5 s of silence.
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.inRally).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})
