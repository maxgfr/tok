// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { rng } from '../test/synth.ts'
import { MotionPeakDetector, type MotionSample } from './motionPeaks.ts'

const RATE = 60

/** Phone at rest (gravity on z) plus noise, with sharp impacts at `hits` (seconds). */
function accel(
  seconds: number,
  hits: number[],
  opts: { noise?: number; impact?: number; sway?: number } = {},
) {
  const { noise = 0.15, impact = 14, sway = 0 } = opts
  const rand = rng(3)
  const samples: MotionSample[] = []
  for (let i = 0; i < seconds * RATE; i += 1) {
    const t = i / RATE
    let z = 9.81 + (rand() * 2 - 1) * noise + sway * Math.sin(2 * Math.PI * 1.2 * t)
    for (const h of hits) {
      const dt = t - h
      if (dt >= 0 && dt < 0.06) z += impact * Math.exp(-dt / 0.015)
    }
    samples.push({ t: t * 1000, x: (rand() * 2 - 1) * noise, y: (rand() * 2 - 1) * noise, z })
  }
  return samples
}

function run(samples: MotionSample[], refractoryMs = 180) {
  const det = new MotionPeakDetector({ refractoryMs })
  return samples.flatMap((s) => {
    const c = det.push(s)
    return c ? [c] : []
  })
}

describe('MotionPeakDetector', () => {
  test('finds every impact (jump landings, racket hits)', () => {
    const hits = Array.from({ length: 15 }, (_, i) => 1 + i * 0.45)
    expect(run(accel(9, hits))).toHaveLength(15)
  })

  test('impact times land within one sample period', () => {
    const hits = [1, 2, 3]
    const found = run(accel(4, hits))
    found.forEach((c, i) =>
      expect(Math.abs(c.t - hits[i]! * 1000)).toBeLessThanOrEqual(1000 / RATE + 1),
    )
  })

  test('a phone at rest triggers nothing', () => {
    expect(run(accel(6, []))).toEqual([])
  })

  test('slow swaying (walking to the court) triggers nothing', () => {
    expect(run(accel(6, [], { sway: 2 }))).toEqual([])
  })

  test('impacts closer than the refractory period count once', () => {
    expect(run(accel(3, [1, 1.08]), 180)).toHaveLength(1)
  })

  test('candidates are tagged as motion with a confidence in 0..1', () => {
    const [c] = run(accel(3, [1.5]))
    expect(c?.source).toBe('motion')
    expect(c?.confidence).toBeGreaterThan(0)
    expect(c?.confidence).toBeLessThanOrEqual(1)
  })
})
