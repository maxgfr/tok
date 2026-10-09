import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { clearAll, listSessions } from '../store/db.ts'
import { App } from './App.tsx'

beforeEach(async () => {
  await clearAll()
  window.location.hash = ''
})

test('home offers table tennis and beach rackets first', async () => {
  render(<App />)
  const buttons = await screen.findAllByRole('button', { pressed: false })
  const names = buttons.map((b) => b.textContent)
  expect(names.slice(0, 1)).toEqual(['Beach rackets'])
  expect(screen.getByRole('button', { pressed: true }).textContent).toBe('Table tennis')
})

test('taps count hits in a rally and the session is saved when it ends', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /start table tennis/i }))
  const tapZone = await screen.findByRole('button', { name: /add a hit/i })
  await user.click(tapZone)
  await user.click(tapZone)
  await user.click(tapZone)
  expect(screen.getByRole('button', { name: /current rally: 3/i })).toBeTruthy()

  await user.click(screen.getByRole('button', { name: /end rally/i }))
  await user.click(screen.getByRole('button', { name: /end session/i }))
  await user.click(
    within(screen.getByRole('group', { name: /end session/i })).getByRole('button', {
      name: 'End',
    }),
  )

  await screen.findByRole('heading', { name: 'Table tennis' })
  const sessions = await listSessions()
  expect(sessions).toHaveLength(1)
  expect(sessions[0]?.rallies[0]?.hits).toHaveLength(3)
})

test('restart puts the rally back at 0 and records nothing', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('radio', { name: /taps only/i }))
  await user.click(await screen.findByRole('button', { name: /start table tennis/i }))
  const tapZone = await screen.findByRole('button', { name: /add a hit/i })
  await user.click(tapZone)
  await user.click(tapZone)
  await user.click(tapZone)
  await user.click(screen.getByRole('button', { name: /restart/i }))
  expect(screen.getByRole('button', { name: /current rally: 0/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /restart/i })).toHaveProperty('disabled', true)

  act(() => {
    window.location.hash = '#/history'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  await screen.findByRole('heading', { name: 'Nothing on the board yet' })
  expect(await listSessions()).toEqual([])
})

test('match mode gives points to the tapped side', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('radio', { name: /keep score/i }))
  await user.click(screen.getByRole('button', { name: /start table tennis/i }))
  await user.click(await screen.findByRole('button', { name: /point to me/i }))
  await user.click(screen.getByRole('button', { name: /point to me/i }))
  await user.click(screen.getByRole('button', { name: /point to you/i }))
  expect(screen.getByRole('button', { name: /point to me\. score 2/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /point to you\. score 1/i })).toBeTruthy()
})

test('leaving the live screen without ending still closes the session', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('radio', { name: /taps only/i }))
  await user.click(await screen.findByRole('button', { name: /start table tennis/i }))
  const tapZone = await screen.findByRole('button', { name: /add a hit/i })
  await user.click(tapZone)
  await user.click(tapZone)
  await user.click(screen.getByRole('button', { name: /end rally/i }))
  // Back gesture / another tab: the route simply changes.
  act(() => {
    window.location.hash = '#/history'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  await waitFor(async () => {
    const [session] = await listSessions()
    expect(session?.endedAt).not.toBeNull()
  })
})

test('after ending, Back does not reopen the live screen', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('radio', { name: /taps only/i }))
  await user.click(await screen.findByRole('button', { name: /start table tennis/i }))
  await user.click(await screen.findByRole('button', { name: /add a hit/i }))
  await user.click(screen.getByRole('button', { name: /end rally/i }))
  await user.click(screen.getByRole('button', { name: /end session/i }))
  const before = window.history.length
  await user.click(
    within(screen.getByRole('group', { name: /end session/i })).getByRole('button', {
      name: 'End',
    }),
  )
  await screen.findByRole('heading', { name: 'Table tennis' })
  expect(window.history.length).toBe(before)
})
