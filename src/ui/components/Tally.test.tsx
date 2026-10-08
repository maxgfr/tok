import { act, fireEvent, render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Tally } from './Tally.tsx'

test('an undone hit is struck through in coral before it disappears', () => {
  const { container, rerender } = render(<Tally count={7} />)
  rerender(<Tally count={6} />)
  const strike = container.querySelector('line[stroke="var(--color-side-b)"]')
  expect(strike).not.toBeNull()
  // Once its fade ends, the cancelled stroke is gone. jsdom has no
  // AnimationEvent, so React listens for the WebKit-prefixed name there.
  act(() => {
    const group = strike!.parentElement!
    fireEvent.animationEnd(group)
    fireEvent(group, new Event('webkitAnimationEnd', { bubbles: true }))
  })
  expect(container.querySelector('line[stroke="var(--color-side-b)"]')).toBeNull()
})

test('new strokes draw themselves', () => {
  const { container } = render(<Tally count={3} />)
  const lines = container.querySelectorAll('g[stroke] line')
  expect(lines).toHaveLength(3)
  expect((lines[0] as SVGElement).style.animation).toMatch(/stroke-in/)
})
