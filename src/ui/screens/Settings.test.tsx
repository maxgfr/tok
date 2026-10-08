import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { clearAll, getSetting } from '../../store/db.ts'
import { Settings } from './Settings.tsx'

beforeEach(async () => {
  await clearAll()
})

test('a goal is saved for the chosen sport', async () => {
  const user = userEvent.setup()
  render(<Settings />)
  await user.selectOptions(screen.getByLabelText('Sport'), 'beach-rackets')
  await user.type(screen.getByLabelText('Goal in one rally'), '100')
  await expect.poll(() => getSetting('goal:beach-rackets', 0)).toBe(100)
})

test('the earbuds clicker can be switched on', async () => {
  const user = userEvent.setup()
  render(<Settings />)
  const toggle = await screen.findByRole('checkbox', { name: /earbuds as a clicker/i })
  await expect.poll(() => (toggle as HTMLInputElement).disabled).toBe(false)
  await user.click(toggle)
  await expect.poll(() => getSetting('remote', false)).toBe(true)
})

test('without an on-device voice, spoken calls stay off', async () => {
  render(<Settings />)
  const toggle = await screen.findByRole('checkbox', { name: /call it out loud/i })
  expect((toggle as HTMLInputElement).disabled).toBe(true)
})
