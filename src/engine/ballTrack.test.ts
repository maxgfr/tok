// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { rng } from '../test/synth.ts'
import { BallTracker, type BallObservation, type TrackerEvent } from './ballTrack.ts'

const FPS = 30

/**
 * Keepy-uppy seen from the side: the ball falls in from the top, is touched at
 * y = 0.7 `touches` times (each sends it up to y = 0.3), then drops to the ground.
 */
function keepyUppy(touches: number, opts: { jitter?: number; dropout?: number } = {}) {
  const rand = rng(5)
  const frames: { t: number; obs: BallObservation | null }[] = []
  const g = 3.2 // screen-heights per s², tuned so an arc lasts ~0.7 s
  const arc = Math.sqrt((2 * 0.4) / g) // time from contact to apex
  let t = 0
  const push = (y: number, x = 0.5) => {
    const j = opts.jitter ?? 0
    const lost = (opts.dropout ?? 0) > rand()
    frames.push({
      t: t * 1000,
      obs: lost
        ? null
        : { t: t * 1000, x: x + (rand() * 2 - 1) * j, y: y + (rand() * 2 - 1) * j, score: 0.8 },
    })
    t += 1 / FPS
  }
  // Falling in from the top.
  for (let s = 0; s < arc; s += 1 / FPS) push(0.3 + 0.5 * g * s * s)
  for (let k = 0; k < touches; k += 1) {
    for (let s = 0; s < 2 * arc; s += 1 / FPS) push(0.7 - 0.4 + 0.5 * g * (s - arc) ** 2)
  }
  // Last drop to the ground, then rolling.
  for (let s = 0; s < 0.6; s += 1 / FPS) push(Math.min(0.97, 0.7 + 1.2 * s + 0.5 * g * s * s))
  for (let s = 0; s < 0.6; s += 1 / FPS) push(0.97)
  return frames
}

function run(frames: { t: number; obs: BallObservation | null }[], opts = {}) {
  const tracker = new BallTracker({ refractoryMs: 250, ...opts })
  const events: TrackerEvent[] = []
  for (const f of frames) events.push(...tracker.push(f.t, f.obs))
  return events
}

const hits = (events: TrackerEvent[]) => events.filter((e) => e.type === 'hit')

describe('BallTracker', () => {
  test('each touch that sends the ball back up is a hit', () => {
    expect(hits(run(keepyUppy(6)))).toHaveLength(6)
  })

  test('the top of the arc is not a hit', () => {
    expect(hits(run(keepyUppy(1)))).toHaveLength(1)
  })

  test('detection jitter does not invent touches', () => {
    expect(hits(run(keepyUppy(8, { jitter: 0.006 })))).toHaveLength(8)
  })

  test('a few missed frames do not lose touches', () => {
    expect(hits(run(keepyUppy(8, { dropout: 0.15 })))).toHaveLength(8)
  })

  test('the ball coming to rest low in the frame ends the rally', () => {
    const events = run(keepyUppy(3))
    expect(events.at(-1)?.type).toBe('ground')
    expect(events.filter((e) => e.type === 'ground')).toHaveLength(1)
  })

  test('a side-on rally counts each change of direction', () => {
    const frames: { t: number; obs: BallObservation }[] = []
    let x = 0.15
    let dir = 1
    for (let i = 0; i < 6 * FPS; i += 1) {
      x += dir * 0.025
      if (x >= 0.85 || x <= 0.15) dir *= -1
      frames.push({ t: (i * 1000) / FPS, obs: { t: (i * 1000) / FPS, x, y: 0.4, score: 0.9 } })
    }
    // 0.7 wide at 0.75/s → a turn every ~0.93 s → 6 turns in 6 s.
    expect(hits(run(frames)).length).toBeGreaterThanOrEqual(5)
    expect(hits(run(frames)).length).toBeLessThanOrEqual(7)
  })

  test('hits are vision candidates with a confidence in 0..1', () => {
    const [first] = hits(run(keepyUppy(2)))
    expect(first?.type === 'hit' && first.candidate.source).toBe('vision')
    if (first?.type === 'hit') {
      expect(first.candidate.confidence).toBeGreaterThan(0)
      expect(first.candidate.confidence).toBeLessThanOrEqual(1)
    }
  })
})
