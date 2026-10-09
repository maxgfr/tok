import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearAll, saveSession, type SessionRecord } from '../../store/db.ts'

vi.mock('../../record/videoStore.ts', () => ({
  readVideo: vi.fn(async () => new Blob(['video'], { type: 'video/mp4' })),
}))
vi.mock('../../record/clip.ts', () => ({
  exportClip: vi.fn(async () => new Blob(['clip'], { type: 'video/mp4' })),
}))

const { Replay } = await import('./Replay.tsx')

const hit = (t: number) => ({ t, sources: ['audio' as const], confidence: 1 })
const session: SessionRecord = {
  id: 's1',
  sportId: 'beach-rackets',
  mode: 'rally',
  startedAt: 1000,
  endedAt: 20_000,
  sensors: ['audio'],
  rallies: [
    {
      startedAt: 3000,
      endedAt: 6000,
      hits: [hit(3000), hit(4000), hit(5000)],
      endReason: 'timeout',
    },
  ],
  match: null,
  videos: [{ file: 's1-1.mp4', store: 'opfs', mimeType: 'video/mp4', startedAt: 1000, bytes: 5 }],
}

const share = vi.fn(async () => {})

beforeEach(async () => {
  await clearAll()
  await saveSession(session)
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
  )
  Object.assign(navigator, { share, canShare: () => true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  share.mockClear()
})

test('a rally clip is shared from its own tap, once it is cut', async () => {
  const user = userEvent.setup()
  render(<Replay id="s1" />)
  await user.click(await screen.findByRole('button', { name: 'Share this rally' }))
  // Cutting takes long enough for the first tap's permission to share to expire.
  const ready = await screen.findByRole('button', { name: 'Share the clip' })
  expect(share).not.toHaveBeenCalled()
  await user.click(ready)
  expect(share).toHaveBeenCalledWith(
    expect.objectContaining({ files: [expect.objectContaining({ type: 'video/mp4' })] }),
  )
})
