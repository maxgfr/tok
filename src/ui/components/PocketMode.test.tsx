import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { PocketMode } from './PocketMode.tsx'

const swipe = (el: Element, from: number, to: number) => {
  fireEvent.pointerDown(el, { clientY: from, pointerId: 1 })
  fireEvent.pointerUp(el, { clientY: to, pointerId: 1 })
}

test('a long swipe up unlocks', () => {
  const onUnlock = vi.fn()
  render(<PocketMode onUnlock={onUnlock} />)
  swipe(screen.getByTestId('pocket'), 700, 400)
  expect(onUnlock).toHaveBeenCalledTimes(1)
})

test('a tap or a short drag does not unlock', () => {
  const onUnlock = vi.fn()
  render(<PocketMode onUnlock={onUnlock} />)
  const el = screen.getByTestId('pocket')
  swipe(el, 700, 690)
  swipe(el, 700, 800)
  expect(onUnlock).not.toHaveBeenCalled()
})

test('Escape unlocks from a keyboard', () => {
  const onUnlock = vi.fn()
  render(<PocketMode onUnlock={onUnlock} />)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onUnlock).toHaveBeenCalled()
})
