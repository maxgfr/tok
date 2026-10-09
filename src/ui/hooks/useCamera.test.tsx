import { renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const track = { stop: vi.fn() }
let resolveCamera: (s: MediaStream) => void = () => {}
vi.mock('../../sensors/camera.ts', () => ({
  startCamera: () => new Promise<MediaStream>((r) => (resolveCamera = r)),
}))
vi.mock('../../record/recorder.ts', () => ({ startRecording: vi.fn() }))

const { useCamera } = await import('./useCamera.ts')

test('switching the camera off while it starts still releases it', async () => {
  const { rerender } = renderHook(
    ({ enabled }) =>
      useCamera({
        enabled,
        name: 's',
        overlay: { title: '', unit: '', count: 0, best: 0, match: null },
        audioTrack: () => null,
      }),
    { initialProps: { enabled: true } },
  )
  rerender({ enabled: false })
  resolveCamera({ getTracks: () => [track] } as unknown as MediaStream)
  await waitFor(() => expect(track.stop).toHaveBeenCalled())
})
