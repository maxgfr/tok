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
