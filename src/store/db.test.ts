import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  clearAll,
  deleteSession,
  exportAll,
  getSession,
  getSetting,
  importAll,
  listSessions,
  saveSession,
  setSetting,
  type SessionRecord,
} from './db.ts'

const session = (id: string, startedAt: number): SessionRecord => ({
  id,
  sportId: 'beach-rackets',
  mode: 'rally',
  startedAt,
  endedAt: startedAt + 60_000,
  sensors: ['manual'],
  rallies: [
    {
      startedAt,
      endedAt: startedAt + 1000,
      hits: [{ t: startedAt, sources: ['manual'], confidence: 1 }],
      endReason: 'manual',
    },
  ],
  match: null,
})

beforeEach(async () => {
  await clearAll()
})

describe('session store', () => {
  test('saves and reads back a session', async () => {
    await saveSession(session('a', 1000))
    expect(await getSession('a')).toEqual(session('a', 1000))
  })

  test('lists sessions newest first', async () => {
    await saveSession(session('old', 1000))
    await saveSession(session('new', 5000))
    expect((await listSessions()).map((s) => s.id)).toEqual(['new', 'old'])
  })

  test('saving the same id again updates it', async () => {
    await saveSession(session('a', 1000))
    await saveSession({ ...session('a', 1000), endedAt: 99 })
    expect((await listSessions()).length).toBe(1)
    expect((await getSession('a'))?.endedAt).toBe(99)
  })

  test('deletes a session', async () => {
    await saveSession(session('a', 1000))
    await deleteSession('a')
    expect(await getSession('a')).toBeUndefined()
  })
})

describe('settings', () => {
  test('returns the fallback until a value is set', async () => {
    expect(await getSetting('voice', false)).toBe(false)
    await setSetting('voice', true)
    expect(await getSetting('voice', false)).toBe(true)
  })
})

describe('backup', () => {
  test('export then import restores sessions and settings', async () => {
    await saveSession(session('a', 1000))
    await setSetting('goal', 100)
    const file = await exportAll()
    expect(file.app).toBe('tok')
    await clearAll()
    const result = await importAll(JSON.parse(JSON.stringify(file)))
    expect(result.sessions).toBe(1)
    expect(await getSession('a')).toEqual(session('a', 1000))
    expect(await getSetting('goal', 0)).toBe(100)
  })

  test('import rejects a file that is not a tok backup', async () => {
    await expect(importAll({ app: 'other' })).rejects.toThrow(/not a tok backup/i)
  })
})

describe('video blobs', () => {
  test('a recording saved in IndexedDB can be read back and deleted', async () => {
    const { putVideoBlob, getVideoBlob, deleteVideoBlob } = await import('./db.ts')
    await putVideoBlob('s1.webm', new Blob(['abc'], { type: 'video/webm' }))
    // jsdom's Blob does not survive fake-indexeddb's structured clone byte for
    // byte, so this checks the record round-trip; real bytes are covered in E2E.
    expect(await getVideoBlob('s1.webm')).toBeDefined()
    await deleteVideoBlob('s1.webm')
    expect(await getVideoBlob('s1.webm')).toBeUndefined()
  })
})

describe('import safety', () => {
  const file = (sessions: unknown[]) => ({
    app: 'tok',
    version: 1,
    exportedAt: '',
    sessions,
    settings: {},
  })

  test('sessions of unknown sports or broken shape are skipped, not imported', async () => {
    const result = await importAll(
      file([
        session('ok', 1000),
        { ...session('curling', 2000), sportId: 'curling' },
        { id: 'broken' },
      ]),
    )
    expect(result).toEqual({ sessions: 1, skipped: 2 })
    expect((await listSessions()).map((s) => s.id)).toEqual(['ok'])
  })

  test('a local session keeps its recordings when a backup replaces it', async () => {
    const videos = [
      { file: 'a-1.mp4', store: 'opfs' as const, mimeType: 'video/mp4', startedAt: 1, bytes: 5 },
    ]
    await saveSession({ ...session('a', 1000), videos })
    await importAll(file([{ ...session('a', 1000), endedAt: 5 }]))
    expect((await getSession('a'))?.videos).toEqual(videos)
  })

  test('recordings named in a backup are not trusted: they live on another device', async () => {
    const videos = [
      { file: 'b-1.mp4', store: 'opfs' as const, mimeType: 'video/mp4', startedAt: 1, bytes: 5 },
    ]
    await importAll(file([{ ...session('b', 1000), videos }]))
    expect((await getSession('b'))?.videos).toBeUndefined()
  })
})
