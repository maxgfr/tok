import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../config.ts'

// A phone whose storage is full: every save fails.
vi.mock('../../store/db.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../store/db.ts')>()),
  saveSession: vi.fn(() => Promise.reject(new DOMException('full', 'QuotaExceededError'))),
}))

const { useLiveSession } = await import('./useLiveSession.ts')

test('a save that fails is shown, and End does not pretend it worked', async () => {
  const config = { ...DEFAULT_CONFIG, input: 'manual' as const }
  const { result } = renderHook(() => useLiveSession(config, ['manual']))
  expect(result.current.saveFailed).toBe(false)
  act(() => {
    result.current.tap()
    result.current.endRally()
  })
  await waitFor(() => expect(result.current.saveFailed).toBe(true))
  await act(async () => {
    await expect(result.current.finish()).rejects.toThrow()
  })
  expect(result.current.saveFailed).toBe(true)
})
