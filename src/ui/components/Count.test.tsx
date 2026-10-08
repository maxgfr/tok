import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Count } from './Count.tsx'

const cells = (el: HTMLElement) => [...el.querySelectorAll('span[aria-hidden="true"]')]

test('only the digit that changed is a new element (and so the only one that rolls)', () => {
  const { container, rerender } = render(<Count value={129} />)
  const [hundreds, tens] = cells(container)
  rerender(<Count value={130} />)
  const after = cells(container)
  expect(after[0]).toBe(hundreds) // 1 stayed
  expect(after[1]).not.toBe(tens) // 2 → 3 rolled
  expect(after.map((c) => c.textContent).join('')).toBe('130')
})

test('screen readers get the whole number once', () => {
  const { container } = render(<Count value={42} />)
  expect(container.querySelector('.sr-only')?.textContent).toBe('42')
})
