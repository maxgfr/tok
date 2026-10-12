import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { expect, test } from 'vitest'

test('opening an older store gives every session already kept its summary', async () => {
  // The store as version 2 left it: sessions, settings, videos.
  const old = await openDB('tok', 2, {
    upgrade(database) {
      const sessions = database.createObjectStore('sessions', { keyPath: 'id' })
      sessions.createIndex('startedAt', 'startedAt')
      database.createObjectStore('settings')
      database.createObjectStore('videos')
    },
  })
  await old.put('sessions', {
    id: 'kept',
    sportId: 'beach-rackets',
    mode: 'rally',
    startedAt: 1000,
    endedAt: 9000,
    sensors: ['manual'],
    rallies: [
      {
        startedAt: 1000,
        endedAt: 3000,
        hits: [1000, 2000, 3000].map((t) => ({ t, sources: ['manual'], confidence: 1 })),
        endReason: 'manual',
      },
    ],
    match: null,
  })
  old.close()

  const { listSummaries, getSession } = await import('./db.ts')
  expect(await listSummaries()).toEqual([
    {
      id: 'kept',
      sportId: 'beach-rackets',
      mode: 'rally',
      startedAt: 1000,
      rallyCounts: [3],
      rallyStarts: [1000],
      videoFiles: [],
    },
  ])
  expect((await getSession('kept'))?.rallies).toHaveLength(1)
})
