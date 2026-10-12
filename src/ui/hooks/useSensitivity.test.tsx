import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DEFAULT_THRESHOLD } from '../../engine/onset.ts'
import { clearAll } from '../../store/db.ts'
import { sensitivityToThreshold, thresholdToSensitivity } from '../thresholds.ts'
import { useSensitivity } from './useSensitivity.ts'

beforeEach(async () => {
  await clearAll()
})

const loaded = async () => {
  const hook = renderHook(() => useSensitivity('beach-rackets'))
  await waitFor(() => expect(hook.result.current.threshold).not.toBeNull())
  return hook
}

test('starts at the default, keeps a new sensitivity for the sport', async () => {
  const first = await loaded()
  expect(first.result.current.threshold).toBe(DEFAULT_THRESHOLD)
  await act(() => first.result.current.setSensitivity(80))
  expect(first.result.current.sensitivity).toBe(80)
  first.unmount()

  const again = await loaded()
  expect(again.result.current.threshold).toBeCloseTo(sensitivityToThreshold(80))
  expect(again.result.current.sensitivity).toBe(80)
})

test('reset brings the default back', async () => {
  const { result } = await loaded()
  await act(() => result.current.setSensitivity(10))
  await act(() => result.current.reset())
  expect(result.current.threshold).toBe(DEFAULT_THRESHOLD)
  expect(result.current.sensitivity).toBe(thresholdToSensitivity(DEFAULT_THRESHOLD))
})

test('the voice filter is on by default and remembered', async () => {
  const first = await loaded()
  expect(first.result.current.voiceFilter).toBe(true)
  await act(() => first.result.current.setVoiceFilter(false))
  first.unmount()
  const again = await loaded()
  expect(again.result.current.voiceFilter).toBe(false)
})

test('every change is handed to onChange, to be pushed to the running mic', async () => {
  const onChange = vi.fn()
  const { result } = renderHook(() => useSensitivity('beach-rackets', { onChange }))
  await waitFor(() => expect(result.current.threshold).not.toBeNull())
  await act(() => result.current.setVoiceFilter(false))
  expect(onChange).toHaveBeenLastCalledWith({ threshold: DEFAULT_THRESHOLD, voiceFilter: false })
  await act(() => result.current.setSensitivity(100))
  expect(onChange).toHaveBeenLastCalledWith({
    threshold: sensitivityToThreshold(100),
    voiceFilter: false,
  })
})

describe('Auto', () => {
  test("until the slider is touched, the threshold follows the player's hits", async () => {
    const onChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ suggested }: { suggested: number | null }) =>
        useSensitivity('beach-rackets', { onChange, suggested }),
      { initialProps: { suggested: null as number | null } },
    )
    await waitFor(() => expect(result.current.threshold).toBe(DEFAULT_THRESHOLD))
    expect(result.current.auto).toBe(true)
    rerender({ suggested: 14 })
    expect(result.current.threshold).toBe(14)
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ threshold: 14, voiceFilter: true }),
    )
  })

  test('moving the slider takes over; Default goes back to Auto', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useSensitivity('beach-rackets', { onChange, suggested: 14 }),
    )
    await waitFor(() => expect(result.current.threshold).toBe(14))
    await act(() => result.current.setSensitivity(90))
    expect(result.current.auto).toBe(false)
    expect(result.current.threshold).toBeCloseTo(sensitivityToThreshold(90))
    await act(() => result.current.reset())
    expect(result.current.auto).toBe(true)
    expect(result.current.threshold).toBe(14)
    expect(onChange).toHaveBeenLastCalledWith({ threshold: 14, voiceFilter: true })
  })
})
