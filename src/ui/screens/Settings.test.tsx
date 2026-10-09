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

test('the microphone can be chosen, once its name is known', async () => {
  let allowed = false
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: async () => [
        { kind: 'audioinput', deviceId: 'built-in', label: allowed ? 'iPhone Microphone' : '' },
        { kind: 'audioinput', deviceId: 'headset', label: allowed ? 'AirPods' : '' },
      ],
      getUserMedia: async () => {
        allowed = true
        return { getTracks: () => [] }
      },
    },
  })
  const user = userEvent.setup()
  render(<Settings />)
  await user.click(await screen.findByRole('button', { name: 'Show microphone names' }))
  await user.selectOptions(await screen.findByLabelText('Microphone'), 'AirPods')
  await expect.poll(() => getSetting('micDevice', '')).toBe('headset')
})

test('sounds are on until turned off', async () => {
  const user = userEvent.setup()
  render(<Settings />)
  const toggle = await screen.findByRole('checkbox', { name: /^sounds/i })
  await expect.poll(() => (toggle as HTMLInputElement).checked).toBe(true)
  await user.click(toggle)
  await expect.poll(() => getSetting('sounds', true)).toBe(false)
})

test('each sport ends its rallies by hand until an automatic end is chosen for it', async () => {
  const user = userEvent.setup()
  render(<Settings />)
  await user.selectOptions(
    await screen.findByLabelText('Sport for the automatic end'),
    'beach-rackets',
  )
  const select = screen.getByLabelText('End a rally on its own')
  expect((select as HTMLSelectElement).value).toBe('0')
  await user.selectOptions(select, '5')
  await expect.poll(() => getSetting('autoEnd:beach-rackets', 0)).toBe(5)
  expect(await getSetting('autoEnd:table-tennis', 0)).toBe(0)
})
