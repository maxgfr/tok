import { act, renderHook, waitFor } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Recording } from '../../record/recorder.ts'
import type { VideoRef } from '../../store/db.ts'

const track = { stop: vi.fn() }
let resolveCamera: (s: MediaStream) => void = () => {}
vi.mock('../../sensors/camera.ts', () => ({
  startCamera: () => new Promise<MediaStream>((r) => (resolveCamera = r)),
}))
const startRecording = vi.fn<() => Promise<Recording | null>>()
vi.mock('../../record/recorder.ts', () => ({ startRecording }))

const { useCamera } = await import('./useCamera.ts')

const OVERLAY = { title: '', unit: '', count: 0, best: 0, match: null }
const stream = { getTracks: () => [track] } as unknown as MediaStream
const ref = (file: string): VideoRef => ({
  file,
  store: 'opfs',
  mimeType: 'video/mp4',
  startedAt: 1,
  bytes: 10,
})
const recording = (file: string, stop: () => Promise<VideoRef | null>): Recording => ({
  ref: { ...ref(file), bytes: 0 },
  stop,
  markRally: () => {},
})

beforeEach(() => {
  vi.clearAllMocks()
  HTMLMediaElement.prototype.play = vi.fn(async () => {})
})

/** The hook on a <video> element, attached before its effect runs, as the live screen does. */
function mount(onRecording = vi.fn()) {
  const el = document.createElement('video')
  const { result, rerender } = renderHook(
    ({ enabled }) => {
      const camera = useCamera({
        enabled,
        name: 's',
        overlay: OVERLAY,
        audioTrack: () => null,
        onRecording,
      })
      useLayoutEffect(() => {
        camera.video.current = el
      })
      return camera
    },
    { initialProps: { enabled: true } },
  )
  return { api: result, toggle: (enabled: boolean) => rerender({ enabled }) }
}

test('switching the camera off while it starts still releases it', async () => {
  const { rerender } = renderHook(
    ({ enabled }) => useCamera({ enabled, name: 's', overlay: OVERLAY, audioTrack: () => null }),
    { initialProps: { enabled: true } },
  )
  rerender({ enabled: false })
  resolveCamera(stream)
  await waitFor(() => expect(track.stop).toHaveBeenCalled())
})

test('ending while the camera is still starting waits for it, and keeps its recording', async () => {
  startRecording.mockResolvedValue(recording('s-1.mp4', async () => ref('s-1.mp4')))
  const onRecording = vi.fn()
  const { api } = mount(onRecording)
  const stopped = api.current!.stop()
  await act(async () => resolveCamera(stream))
  expect(await stopped).toEqual([ref('s-1.mp4')])
  // The session heard of the file as soon as it was being written.
  expect(onRecording).toHaveBeenCalledWith(expect.objectContaining({ file: 's-1.mp4' }))
})

test('a part that fails to save loses only itself: End still gets the others', async () => {
  startRecording.mockResolvedValueOnce(
    recording('s-1.mp4', () => Promise.reject(new Error('disk full'))),
  )
  startRecording.mockResolvedValueOnce(recording('s-2.mp4', async () => ref('s-2.mp4')))
  const { api, toggle } = mount()
  await act(async () => resolveCamera(stream))
  await waitFor(() => expect(api.current!.status).toBe('recording'))
  toggle(false)
  toggle(true)
  await act(async () => resolveCamera(stream))
  await waitFor(() => expect(api.current!.status).toBe('recording'))
  expect(await api.current!.stop()).toEqual([ref('s-2.mp4')])
})

test('when only the recording fails, the camera is not reported as broken', async () => {
  startRecording.mockRejectedValue(new Error('no encoder'))
  const { api } = mount()
  await act(async () => resolveCamera(stream))
  await waitFor(() => expect(api.current!.status).toBe('not-recording'))
})
