import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { GUIDED_HITS, MIN_EXAMPLES, ready } from '../../engine/toneprint.ts'
import type { Rally } from '../../engine/types.ts'
import { clearAll } from '../../store/db.ts'
import { loadToneprint } from '../toneprints.ts'
import type { HeardSound } from './useSensors.ts'
import { LESSON_MS, useToneprint } from './useToneprint.ts'

beforeEach(async () => {
  await clearAll()
})

const sound = (t: number, score = 20): HeardSound => ({ t, score, print: [0, 1, 4, 1, 0] })

function setup() {
  let listen: ((s: HeardSound) => void) | null = null
  const setLearner = vi.fn((fn: ((s: HeardSound) => void) | null) => {
    listen = fn
  })
  const hook = renderHook(() => useToneprint('beach-rackets', { soundsPerHit: 1, setLearner }))
  return { ...hook, hear: (s: HeardSound) => act(() => listen?.(s)), listening: () => !!listen }
}

const rallyAt = (times: number[]): Rally => ({
  startedAt: times[0]!,
  endedAt: times.at(-1)!,
  hits: times.map((t) => ({ t, sources: ['audio'], confidence: 1 })),
  endReason: 'timeout',
})
const heardAll = (times: readonly number[]) => times.map((t) => sound(t))

test('what a rally teaches is kept for the sport', async () => {
  const { result } = setup()
  await waitFor(() => expect(result.current.filter).toBe(true))
  act(() => result.current.learnRally(rallyAt([0, 600, 1200, 1800]), heardAll))
  expect(result.current.model?.count).toBe(4)
  await waitFor(async () => expect((await loadToneprint('beach-rackets'))?.count).toBe(4))
})

test('a rally teaches once, even when an undo makes it the last again', () => {
  const { result } = setup()
  const a = rallyAt([0, 600, 1200, 1800])
  act(() => result.current.learnRally(a, heardAll))
  act(() => result.current.learnRally(rallyAt([5000]), heardAll))
  act(() => result.current.learnRally(a, heardAll))
  expect(result.current.model?.count).toBe(4)
})

test('a rally the mic did not hear in full teaches nothing', () => {
  const { result } = setup()
  act(() => result.current.learnRally(rallyAt([0, 600, 1200, 1800]), (t) => heardAll(t.slice(1))))
  expect(result.current.model).toBeNull()
})

test(`"Learn my ball": ${GUIDED_HITS} steady hits and tok knows the ball, threshold included`, async () => {
  const { result, hear, listening } = setup()
  act(() => result.current.startLesson())
  expect(result.current.lesson).toEqual({ got: 0, status: 'listening' })
  for (let i = 0; i < GUIDED_HITS; i += 1) hear(sound(i * 700, 25))
  expect(result.current.lesson).toEqual({ got: GUIDED_HITS, status: 'learned' })
  expect(listening()).toBe(false)
  expect(ready(result.current.model)).toBe(true)
  expect(result.current.model!.count).toBeGreaterThanOrEqual(MIN_EXAMPLES)
  expect(result.current.suggested).toBeCloseTo(15)
})

test('too few hits in time, or no steady pace: nothing is learned', async () => {
  vi.useFakeTimers()
  try {
    const { result, hear, listening } = setup()
    act(() => result.current.startLesson())
    hear(sound(0))
    hear(sound(700))
    act(() => vi.advanceTimersByTime(LESSON_MS))
    expect(result.current.lesson).toEqual({ got: 2, status: 'missed' })
    expect(listening()).toBe(false)
    expect(result.current.model).toBeNull()

    act(() => result.current.startLesson())
    for (const t of [0, 100, 1500, 1600, 4000, 4100]) hear(sound(t))
    act(() => vi.advanceTimersByTime(LESSON_MS))
    expect(result.current.lesson?.status).toBe('missed')
    expect(result.current.model).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('a stray sound before the hits does not spoil the lesson', () => {
  const { result, hear } = setup()
  act(() => result.current.startLesson())
  hear(sound(0))
  for (let i = 0; i < GUIDED_HITS; i += 1) hear(sound(3000 + i * 550))
  expect(result.current.lesson).toEqual({ got: GUIDED_HITS, status: 'learned' })
})

test('cancelling a lesson gives the mic back to the count', () => {
  const { result, listening } = setup()
  act(() => result.current.startLesson())
  expect(listening()).toBe(true)
  act(() => result.current.cancelLesson())
  expect(listening()).toBe(false)
  expect(result.current.lesson).toBeNull()
})
