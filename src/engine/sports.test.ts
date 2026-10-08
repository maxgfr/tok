import { describe, expect, test } from 'vitest'
import { SPORTS, sport } from './sports.ts'

describe('sport presets', () => {
  test('ids are unique', () => {
    const ids = SPORTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every preset that offers a match has scoring rules', () => {
    for (const s of SPORTS) expect(s.modes.includes('match')).toBe(s.scoring !== null)
  })

  test('the dominant sensor carries the highest weight', () => {
    for (const s of SPORTS) {
      const max = Math.max(s.weights.audio, s.weights.motion, s.weights.vision)
      expect(s.weights[s.dominant]).toBe(max)
    }
  })

  test('volleyball is played to 25, deciding set to 15, best of five', () => {
    expect(sport('volleyball').scoring).toMatchObject({
      kind: 'rally',
      pointsToWin: 25,
      decidingSetPoints: 15,
      setsToWin: 3,
    })
  })

  test('beach volley is played to 21, deciding set to 15, best of three', () => {
    expect(sport('beach-volley').scoring).toMatchObject({
      pointsToWin: 21,
      decidingSetPoints: 15,
      setsToWin: 2,
    })
  })

  test('table tennis counts a paddle hit and a table bounce per hit', () => {
    expect(sport('table-tennis').soundsPerHit).toBe(2)
  })

  test('jump rope counts from motion', () => {
    expect(sport('jump-rope').dominant).toBe('motion')
    expect(sport('jump-rope').unit).toBe('jumps')
  })
})
