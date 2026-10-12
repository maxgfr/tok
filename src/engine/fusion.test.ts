// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { Fusion } from './fusion.ts'
import type { AutoSensor } from './sports.ts'
import type { HitCandidate, SensorKind } from './types.ts'

const c = (t: number, source: SensorKind, confidence = 0.8): HitCandidate => ({
  t,
  source,
  confidence,
})
const TABLE = { audio: 1, motion: 0.3, vision: 0.1 }
const VOLLEY = { audio: 0.7, motion: 0.2, vision: 1 }

const RACKETS = { audio: 1, motion: 0.4, vision: 0.2 }

function run(
  weights: typeof TABLE,
  candidates: HitCandidate[],
  required: AutoSensor | null = null,
) {
  const f = new Fusion({ weights, required })
  const hits = []
  for (const cand of candidates) {
    const hit = f.push(cand)
    if (hit) hits.push(hit)
  }
  return hits
}

describe('Fusion', () => {
  test('a trusted source alone makes a hit immediately', () => {
    const hits = run(TABLE, [c(1000, 'audio')])
    expect(hits).toEqual([{ t: 1000, sources: ['audio'], confidence: 0.8 }])
  })

  test('a weak source alone is not enough', () => {
    expect(run(TABLE, [c(1000, 'motion')])).toEqual([])
  })

  test('two weak sources agreeing within the window make a hit at the earliest time', () => {
    const weights = { audio: 0.4, motion: 0.4, vision: 0 }
    expect(run(weights, [c(1000, 'motion'), c(1060, 'audio')])).toEqual([
      { t: 1000, sources: ['motion', 'audio'], confidence: 0.8 },
    ])
  })

  test('agreement outside the window does not combine', () => {
    const weights = { audio: 0.4, motion: 0.4, vision: 0 }
    expect(run(weights, [c(1000, 'motion'), c(1300, 'audio')])).toEqual([])
  })

  test('a second source confirming an emitted hit does not count twice', () => {
    expect(run(VOLLEY, [c(1000, 'vision'), c(1050, 'audio')])).toHaveLength(1)
  })

  test('separate hits from the same source each count', () => {
    expect(run(TABLE, [c(1000, 'audio'), c(1400, 'audio')])).toHaveLength(2)
  })

  test('manual taps always count', () => {
    expect(run({ audio: 0, motion: 0, vision: 0 }, [c(1000, 'manual')])).toHaveLength(1)
  })

  describe('while the main sensor runs', () => {
    test('secondary sensors agreeing without it make no hit', () => {
      expect(run(RACKETS, [c(1000, 'motion'), c(1050, 'vision')], 'audio')).toEqual([])
    })

    test('they still count together when it is not running', () => {
      expect(run(RACKETS, [c(1000, 'motion'), c(1050, 'vision')])).toHaveLength(1)
    })

    test('a group that includes it counts once, at the earliest time', () => {
      expect(run(RACKETS, [c(1000, 'motion'), c(1040, 'audio')], 'audio')).toEqual([
        { t: 1000, sources: ['motion', 'audio'], confidence: 0.8 },
      ])
    })

    test('a lone secondary sensor heavy enough on its own still needs it', () => {
      expect(run(VOLLEY, [c(1000, 'audio')], 'vision')).toEqual([])
      expect(run(VOLLEY, [c(1000, 'audio'), c(1060, 'vision')], 'vision')).toHaveLength(1)
    })

    test('manual taps always count', () => {
      expect(run(RACKETS, [c(1000, 'manual')], 'audio')).toHaveLength(1)
    })
  })
})
