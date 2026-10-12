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
    micDevice: '',
    onMicDevice: vi.fn(),
    onManual: vi.fn(),
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

test('Auto is presented as experimental, with a way back to counting by hand', async () => {
  const props = setup()
  expect(screen.getByText(/experimental/i)).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Switch to manual' }))
  expect(props.onManual).toHaveBeenCalled()
})

test('once tok knows the ball, it says how many sounds were not it, and the filter can be turned off', async () => {
  const onToneFilter = vi.fn()
  setup({ onToneFilter, known: 12, notYours: 4 })
  expect(screen.getByText('Not your ball: 4')).toBeTruthy()
  await userEvent.click(screen.getByRole('checkbox', { name: /Only my ball/ }))
  expect(onToneFilter).toHaveBeenCalledWith(false)
})

test('while it is still learning, it says how far along it is', () => {
  setup({ onToneFilter: vi.fn(), known: 3 })
  expect(screen.getByText('Learning your ball: 3 of 8 hits')).toBeTruthy()
})

test('Learn my ball fills a dot per hit heard', () => {
  setup({ onLearn: vi.fn(), lesson: { got: 2, status: 'listening' } })
  const dots = screen.getByRole('list', { name: '2 of 6 hits heard' })
  expect(dots.querySelectorAll('li')).toHaveLength(6)
  expect(screen.getByRole('button', { name: 'Listening…' })).toHaveProperty('disabled', true)
})

test('Learn my ball starts on a tap', async () => {
  const onLearn = vi.fn()
  setup({ onLearn })
  await userEvent.click(screen.getByRole('button', { name: 'Learn' }))
  expect(onLearn).toHaveBeenCalled()
})

test('in Auto, the sensitivity says it is set from your hits', () => {
  setup({ auto: true })
  expect(screen.getByText('Auto')).toBeTruthy()
})

test('the last 20 s can be saved', async () => {
  const onSaveTape = vi.fn()
  setup({ onSaveTape })
  await userEvent.click(screen.getByRole('button', { name: /Save last 20 s/ }))
  expect(onSaveTape).toHaveBeenCalled()
})
