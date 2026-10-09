import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SensitivityPanel } from './SensitivityPanel.tsx'

const setup = (overrides: Partial<Parameters<typeof SensitivityPanel>[0]> = {}) => {
  const props = {
    sportName: 'Beach rackets',
    sensitivity: 50,
    voiceFilter: true,
    levels: { current: [] },
    onsets: { current: [] },
    rejected: 3,
    onSensitivity: vi.fn(),
    onVoiceFilter: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<SensitivityPanel {...props} />)
  return props
}

test('names the sport it applies to and what it set aside', () => {
  setup()
  expect(screen.getByRole('heading', { name: 'Sensitivity · Beach rackets' })).toBeTruthy()
  expect(screen.getByText('3 sounds ignored as voice')).toBeTruthy()
})

test('moving the slider sets the sensitivity', () => {
  const props = setup()
  fireEvent.change(screen.getByRole('slider', { name: 'Sensitivity' }), { target: { value: '72' } })
  expect(props.onSensitivity).toHaveBeenCalledWith(72)
})

test('Default resets the sensitivity', async () => {
  const props = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Default' }))
  expect(props.onReset).toHaveBeenCalled()
})

test('the voice filter can be turned off', async () => {
  const props = setup()
  await userEvent.click(screen.getByRole('checkbox', { name: /Ignore voices/ }))
  expect(props.onVoiceFilter).toHaveBeenCalledWith(false)
})

test('Done closes it', async () => {
  const props = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(props.onClose).toHaveBeenCalled()
})
