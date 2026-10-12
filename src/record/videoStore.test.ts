// @vitest-environment node
// Node's Blobs survive IndexedDB byte for byte; jsdom's do not.
import 'fake-indexeddb/auto'
import { beforeEach, expect, test, vi } from 'vitest'
import { clearAll, getVideoChunks, listVideoKeys, saveSession } from '../store/db.ts'
import {
  deleteVideo,
  openVideoSink,
  openVideoWriter,
  pruneOrphanRecordings,
  pruneRecordings,
  readVideo,
} from './videoStore.ts'

beforeEach(async () => {
  await clearAll()
})

const ref = (file: string, mimeType = 'video/webm') => ({
  file,
  store: 'idb' as const,
  mimeType,
  startedAt: 0,
  bytes: 0,
})

test('without a writable OPFS, each chunk is saved as it comes, and read back whole', async () => {
  const writer = await openVideoWriter('a.webm')
  expect(writer.store).toBe('idb')
  writer.write(new Blob(['one-']))
  writer.write(new Blob(['two-']))
  // Already on disk before the end: a crash keeps what was filmed.
  await new Promise((r) => setTimeout(r, 0))
  expect((await getVideoChunks('a.webm')).length).toBeGreaterThan(0)
  writer.write(new Blob(['three']))
  expect(await writer.close()).toBe(13)
  const blob = await readVideo(ref('a.webm'))
  expect(await blob?.text()).toBe('one-two-three')
  expect(blob?.type).toBe('video/webm')
})

test("a muxer's positioned writes, one going back to patch the start, read back right", async () => {
  const sink = await openVideoSink('b.mp4')
  const writer = sink.stream.getWriter()
  const bytes = (s: string) => new TextEncoder().encode(s)
  await writer.write({ type: 'write', data: bytes('xxxx'), position: 0 })
  await writer.write({ type: 'write', data: bytes('body'), position: 4 })
  await writer.write({ type: 'write', data: bytes('head'), position: 0 })
  await writer.close()
  expect(await sink.saved).toBe(8)
  expect(await (await readVideo(ref('b.mp4', 'video/mp4')))?.text()).toBe('headbody')
})

test('deleting a recording removes its chunks', async () => {
  const writer = await openVideoWriter('c.webm')
  writer.write(new Blob(['x']))
  await writer.close()
  await deleteVideo(ref('c.webm'))
  expect(await getVideoChunks('c.webm')).toEqual([])
  expect(await readVideo(ref('c.webm'))).toBeNull()
})

/** Recordings written an hour ago: none of them still going. */
async function recordedLongAgo(names: string[]) {
  const now = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(now - 3_600_000)
  for (const name of names) {
    const writer = await openVideoWriter(name)
    writer.write(new Blob(['x']))
    await writer.close()
  }
  vi.restoreAllMocks()
}

test('the cleanup removes recordings no session points to, and keeps the others', async () => {
  await recordedLongAgo(['kept.webm', 'lost.webm'])
  expect(await pruneRecordings(new Set(['kept.webm']))).toBe(1)
  expect(await listVideoKeys()).toEqual(['kept.webm'])
})

test('a recording written to a moment ago may still be going: the cleanup leaves it', async () => {
  const writer = await openVideoWriter('live.webm')
  writer.write(new Blob(['x']))
  await writer.close()
  expect(await pruneRecordings(new Set())).toBe(0)
  expect(await listVideoKeys()).toEqual(['live.webm'])
})

test('at launch, a recording kept by a session survives and a lost one goes', async () => {
  await recordedLongAgo(['s-1.webm', 'crash.webm'])
  await saveSession({
    id: 's',
    sportId: 'beach-rackets',
    mode: 'rally',
    startedAt: 1,
    endedAt: 2,
    sensors: ['manual'],
    rallies: [],
    match: null,
    videos: [{ ...ref('s-1.webm'), bytes: 1 }],
  })
  expect(await pruneOrphanRecordings()).toBe(1)
  expect(await listVideoKeys()).toEqual(['s-1.webm'])
})
