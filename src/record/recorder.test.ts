import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const deleteVideo = vi.fn(async () => {})
const encoder = {
  frame: vi.fn(async () => {}),
  keyFrameNext: vi.fn(),
  finish: vi.fn(async () => {}),
  cancel: vi.fn(async () => {}),
}
vi.mock('./videoStore.ts', () => ({
  deleteVideo,
  openVideoWriter: vi.fn(),
  openVideoSink: vi.fn(async () => ({
    store: 'opfs',
    stream: new WritableStream(),
    saved: Promise.resolve(1234),
  })),
}))
vi.mock('./overlay.ts', () => ({ drawOverlay: vi.fn() }))
vi.mock('./encoder.ts', () => ({
  pickCodecs: vi.fn(async () => ({ video: 'avc', audio: null })),
  startEncoder: vi.fn(async () => encoder),
}))

const { startRecording } = await import('./recorder.ts')

const video = () => {
  const v = document.createElement('video')
  Object.defineProperty(v, 'videoWidth', { value: 1280 })
  Object.defineProperty(v, 'videoHeight', { value: 720 })
  return v
}

beforeEach(() => {
  vi.stubGlobal('VideoEncoder', class {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const options = (v: HTMLVideoElement) => ({
  video: v,
  audioTrack: null,
  overlay: () => ({ title: '', unit: '', count: 0, best: 0, match: null }),
  name: 'session-1',
})

test('a recording stopped before its first frame leaves no file behind', async () => {
  const recording = await startRecording(options(video()))
  expect(await recording!.stop()).toBeNull()
  expect(deleteVideo).toHaveBeenCalledWith(expect.objectContaining({ file: 'session-1.mp4' }))
})

test('a recording whose file cannot be finished leaves no file behind', async () => {
  encoder.finish.mockRejectedValueOnce(new Error('encoder reclaimed'))
  const recording = await startRecording(options(video()))
  // Let a frame or two through.
  await new Promise((r) => setTimeout(r, 60))
  expect(await recording!.stop()).toBeNull()
  expect(deleteVideo).toHaveBeenCalledWith(expect.objectContaining({ file: 'session-1.mp4' }))
})

test('frames up to an encoder failure are kept', async () => {
  encoder.frame.mockRejectedValueOnce(new Error('encoder reclaimed'))
  const recording = await startRecording(options(video()))
  await new Promise((r) => setTimeout(r, 60))
  const ref = await recording!.stop()
  expect(ref).toMatchObject({ file: 'session-1.mp4', mimeType: 'video/mp4', bytes: 1234 })
  expect(deleteVideo).not.toHaveBeenCalled()
})
