import { describe, expect, test } from 'vitest'
import { tallyLayout } from './tally.ts'

describe('tallyLayout', () => {
  test('four uprights then a diagonal close each gate', () => {
    const { strokes } = tallyLayout(5, { gatesPerRow: 10, capacity: 100 })
    expect(strokes.map((s) => s.kind)).toEqual(['up', 'up', 'up', 'up', 'cross'])
  })

  test('strokes flow into the next row after gatesPerRow gates', () => {
    const { strokes, rows } = tallyLayout(11, { gatesPerRow: 2, capacity: 100 })
    expect(rows).toBe(2)
    expect(strokes[10]?.row).toBe(1)
  })

  test('the layout is deterministic', () => {
    expect(tallyLayout(7, { gatesPerRow: 5, capacity: 50 })).toEqual(
      tallyLayout(7, { gatesPerRow: 5, capacity: 50 }),
    )
  })

  test('past capacity, only the current block is drawn and the rest is carried', () => {
    const { strokes, carried } = tallyLayout(123, { gatesPerRow: 10, capacity: 100 })
    expect(carried).toBe(100)
    expect(strokes).toHaveLength(23)
  })

  test('an exact multiple of the capacity shows a full block', () => {
    const { strokes, carried } = tallyLayout(200, { gatesPerRow: 10, capacity: 100 })
    expect(carried).toBe(100)
    expect(strokes).toHaveLength(100)
  })
})
