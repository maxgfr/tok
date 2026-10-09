import { renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useLatest } from './useLatest.ts'

test('the same ref, always holding the last rendered value', () => {
  const { result, rerender } = renderHook(({ value }) => useLatest(value), {
    initialProps: { value: 1 },
  })
  const ref = result.current
  expect(ref.current).toBe(1)
  rerender({ value: 2 })
  expect(result.current).toBe(ref)
  expect(ref.current).toBe(2)
})
