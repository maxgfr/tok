import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SensorChips } from './SensorChips.tsx'

test('with onAudio, the mic chip opens the sensitivity panel', async () => {
  const onAudio = vi.fn()
  render(<SensorChips status={{ audio: 'on', motion: 'on' }} onAudio={onAudio} />)
  await userEvent.click(screen.getByRole('button', { name: 'Microphone sensitivity' }))
  expect(onAudio).toHaveBeenCalledTimes(1)
  expect(screen.getAllByRole('button')).toHaveLength(1)
})

test('without onAudio, the chips are only status', () => {
  render(<SensorChips status={{ audio: 'on' }} />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByText('Listening')).toBeTruthy()
})

test('a failed secondary sensor still gets no chip', () => {
  render(<SensorChips status={{ audio: 'on', motion: 'unavailable' }} onAudio={() => {}} />)
  expect(screen.queryByText('No motion')).toBeNull()
})
