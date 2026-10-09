import { render, screen } from '@testing-library/react'
import { lazy, Suspense } from 'react'
import { expect, test, vi } from 'vitest'
import { ScreenBoundary } from './ScreenBoundary.tsx'

test('a screen that fails to load offers a reload instead of a blank page', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const Missing = lazy(() =>
    Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
  )
  render(
    <ScreenBoundary>
      <Suspense fallback={null}>
        <Missing />
      </Suspense>
    </ScreenBoundary>,
  )
  expect(await screen.findByRole('heading', { name: 'This screen did not load' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
})
