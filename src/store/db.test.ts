import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  clearAll,
  deleteSession,
  deleteSetting,
  exportAll,
  getSession,
  getSetting,
  importAll,
  listSessions,
  listSummaries,
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

describe('summaries', () => {
  test('each session saved keeps its summary in step, without its hits', async () => {
    await saveSession(session('a', 1000))
    await saveSession({ ...session('b', 2000), rallies: [] })
    expect(await listSummaries()).toEqual([
      {
        id: 'b',
        sportId: 'beach-rackets',
        mode: 'rally',
        startedAt: 2000,
        rallyCounts: [],
        rallyStarts: [],
        videoFiles: [],
      },
      {
        id: 'a',
        sportId: 'beach-rackets',
        mode: 'rally',
        startedAt: 1000,
        rallyCounts: [1],
        rallyStarts: [1000],
        videoFiles: [],
      },
    ])
    await deleteSession('a')
    expect((await listSummaries()).map((s) => s.id)).toEqual(['b'])
  })

  test("a corrected rally counts as the player's count; table tennis counts hits, not sounds", async () => {
    const corrected = session('c', 1000)
    corrected.rallies[0] = { ...corrected.rallies[0]!, count: 12 }
    await saveSession(corrected)
    const tt: SessionRecord = {
      ...session('t', 2000),
      sportId: 'table-tennis',
      rallies: [
        {
          startedAt: 2000,
          endedAt: 4000,
          hits: [0, 210, 420, 630].map((dt) => ({
            t: 2000 + dt,
            sources: ['audio'],
            confidence: 1,
          })),
          endReason: 'timeout',
        },
      ],
    }
    await saveSession(tt)
    const byId = Object.fromEntries((await listSummaries()).map((s) => [s.id, s.rallyCounts]))
    expect(byId).toEqual({ c: [12], t: [2] })
  })

  test('imported sessions get their summaries', async () => {
    await importAll({
      app: 'tok',
      version: 1,
      exportedAt: '',
      sessions: [session('i', 5)],
      settings: {},
    })
    expect((await listSummaries()).map((s) => s.id)).toEqual(['i'])
  })
})

describe('settings', () => {
  test('returns the fallback until a value is set', async () => {
    expect(await getSetting('voice', false)).toBe(false)
    await setSetting('voice', true)
    expect(await getSetting('voice', false)).toBe(true)
  })

  test('a deleted setting falls back again', async () => {
    await setSetting('goal', 100)
    await deleteSetting('goal')
    expect(await getSetting('goal', 0)).toBe(0)
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
        { ...session('bad-rally', 3000), rallies: [{ startedAt: 'yesterday', hits: null }] },
        {
          ...session('bad-hit', 4000),
          rallies: [{ ...session('x', 1).rallies[0], hits: [{ t: 1, sources: ['laser'] }] }],
        },
      ]),
    )
    expect(result).toEqual({ sessions: 1, skipped: 4 })
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
