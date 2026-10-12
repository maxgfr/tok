import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { DayChart } from './DayChart.tsx'
import { RallyBars } from './RallyBars.tsx'

test('a best of 1 gives two scale marks, not 0, 1 and 1 again', () => {
  const { container } = render(
    <DayChart points={[{ day: '2026-10-12', best: 1, average: 1, rallies: 1 }]} />,
  )
  // The scale's labels, beside the drawing.
  const labels = [...container.querySelectorAll('div.w-8[aria-hidden="true"] > span')].map(
    (s) => s.textContent,
  )
  expect(labels).toEqual(['0', '1'])
})

test('rallies of 0 are not drawn as the best', () => {
  const { container } = render(<RallyBars counts={[0, 0]} label="Rallies" />)
  const bars = [...container.querySelectorAll('rect[rx]')]
  expect(bars.map((b) => b.getAttribute('fill'))).toEqual([
    'var(--color-chalk-faint)',
    'var(--color-chalk-faint)',
  ])
})

test('the longest rally is drawn as the best', () => {
  const { container } = render(<RallyBars counts={[3, 7]} label="Rallies" />)
  const bars = [...container.querySelectorAll('rect[rx]')]
  expect(bars.map((b) => b.getAttribute('fill'))).toEqual([
    'var(--color-chalk-faint)',
    'var(--color-best)',
  ])
})
