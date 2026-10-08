import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import { state, updateServiceWorker } from '../../test/pwa-register-stub.ts'
import { UpdatePrompt } from './UpdatePrompt.tsx'

afterEach(() => {
  state.needRefresh = false
  state.offlineReady = false
})

test('says nothing when there is nothing new', () => {
  const { container } = render(<UpdatePrompt />)
  expect(container.textContent).toBe('')
})

test('offers to reload into a new version', async () => {
  state.needRefresh = true
  render(<UpdatePrompt />)
  await userEvent.click(screen.getByRole('button', { name: /reload/i }))
  expect(updateServiceWorker).toHaveBeenCalledWith(true)
})

test('tells once that tok now works offline', async () => {
  state.offlineReady = true
  render(<UpdatePrompt />)
  expect(screen.getByText(/works offline/i)).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: /got it/i }))
  expect(screen.queryByText(/works offline/i)).toBeNull()
})
