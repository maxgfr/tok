import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { drawOverlay, type OverlayState } from './overlay.ts'

// jsdom has no canvas: a context that only counts what is asked of it.
const fakeContext = () =>
  ({
    fillText: vi.fn(),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
  }) as unknown as CanvasRenderingContext2D & {
    fillText: ReturnType<typeof vi.fn>
    drawImage: ReturnType<typeof vi.fn>
  }

// Every plate context ever made: the overlay keeps its plate across frames.
const plates: ReturnType<typeof fakeContext>[] = []
const painted = () => plates.reduce((n, p) => n + p.fillText.mock.calls.length, 0)

beforeEach(() => {
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      width: number
      height: number
      constructor(width: number, height: number) {
        this.width = width
        this.height = height
      }
      getContext() {
        const ctx = fakeContext()
        plates.push(ctx)
        return ctx
      }
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const state = (count: number): OverlayState => ({
  title: 'Beach rackets',
  unit: 'hits',
  count,
  best: 12,
  match: null,
})

test('the same state is painted once, then only copied each frame', () => {
  const frame = fakeContext()
  const s = state(4)
  const before = painted()
  drawOverlay(frame, 1280, 720, s)
  const once = painted()
  drawOverlay(frame, 1280, 720, s)
  expect(painted()).toBe(once)
  expect(once).toBeGreaterThan(before)
  expect(frame.drawImage).toHaveBeenCalledTimes(2)
  expect(frame.fillText).not.toHaveBeenCalled()
})

test('a new state repaints the plate', () => {
  const frame = fakeContext()
  drawOverlay(frame, 1280, 720, state(4))
  const once = painted()
  drawOverlay(frame, 1280, 720, state(5))
  expect(painted()).toBeGreaterThan(once)
})
