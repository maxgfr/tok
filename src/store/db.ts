// Everything tok remembers lives here, in IndexedDB on this device. Rallies are
// stored inside their session: a session is the unit people browse, export and
// delete, and even a long one is a few hundred small records.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Side, ScoringRules } from '../engine/scoring/index.ts'
import { SPORTS, type Mode, type SportId } from '../engine/sports.ts'
import type { Rally, SensorKind } from '../engine/types.ts'

/** The score itself is derived from the rallies' winners (engine/live.ts). */
export interface MatchRecord {
  rules: ScoringRules
  firstServer: Side
  names: { A: string; B: string }
}

export interface SessionRecord {
  id: string
  sportId: SportId
  mode: Mode
  /** Epoch ms. Hit and rally times are epoch ms too. */
  startedAt: number
  endedAt: number | null
  sensors: SensorKind[]
  rallies: Rally[]
  match: MatchRecord | null
  /** Recordings, one per stretch the camera was on. */
  videos?: VideoRef[]
}

export interface VideoRef {
  /** File name in OPFS `recordings/`, or key in the `videos` store. */
  file: string
  store: 'opfs' | 'idb'
  mimeType: string
  /** Epoch ms of the first frame: chapters are measured from here. */
  startedAt: number
  bytes: number
}

interface TokDB extends DBSchema {
  sessions: { key: string; value: SessionRecord; indexes: { startedAt: number } }
  settings: { key: string; value: unknown }
  /** Recordings for browsers without a writable OPFS (Safari). */
  videos: { key: string; value: Blob }
}

const DB_NAME = 'tok'

let dbPromise: Promise<IDBPDatabase<TokDB>> | null = null

function db(): Promise<IDBPDatabase<TokDB>> {
  dbPromise ??= openDB<TokDB>(DB_NAME, 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const sessions = database.createObjectStore('sessions', { keyPath: 'id' })
        sessions.createIndex('startedAt', 'startedAt')
        database.createObjectStore('settings')
      }
      if (oldVersion < 2) database.createObjectStore('videos')
    },
  })
  return dbPromise
}

export async function saveSession(session: SessionRecord): Promise<void> {
  await (await db()).put('sessions', session)
}

export async function getSession(id: string): Promise<SessionRecord | undefined> {
  return (await db()).get('sessions', id)
}

/** Newest first. */
export async function listSessions(): Promise<SessionRecord[]> {
  const all = await (await db()).getAllFromIndex('sessions', 'startedAt')
  return all.reverse()
}

export async function deleteSession(id: string): Promise<void> {
  await (await db()).delete('sessions', id)
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const value = await (await db()).get('settings', key)
  return value === undefined ? fallback : (value as T)
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', value, key)
}

export async function deleteSetting(key: string): Promise<void> {
  await (await db()).delete('settings', key)
}

export async function clearAll(): Promise<void> {
  const d = await db()
  await Promise.all([d.clear('sessions'), d.clear('settings'), d.clear('videos')])
}

export async function putVideoBlob(key: string, blob: Blob): Promise<void> {
  await (await db()).put('videos', blob, key)
}

export async function getVideoBlob(key: string): Promise<Blob | undefined> {
  return (await db()).get('videos', key)
}

export async function deleteVideoBlob(key: string): Promise<void> {
  await (await db()).delete('videos', key)
}

export interface BackupFile {
  app: 'tok'
  version: 1
  exportedAt: string
  sessions: SessionRecord[]
  settings: Record<string, unknown>
}

export async function exportAll(): Promise<BackupFile> {
  const d = await db()
  const [keys, values] = await Promise.all([d.getAllKeys('settings'), d.getAll('settings')])
  const settings = Object.fromEntries(keys.map((key, i) => [String(key), values[i]]))
  return {
    app: 'tok',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: await listSessions(),
    settings,
  }
}

function isBackup(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<BackupFile>
  return v.app === 'tok' && Array.isArray(v.sessions) && typeof v.settings === 'object'
}

const SPORT_IDS = new Set<string>(SPORTS.map((s) => s.id))

/** Enough shape to be shown and replayed; anything else is skipped. */
function isSession(value: unknown): value is SessionRecord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<SessionRecord>
  return (
    typeof v.id === 'string' &&
    typeof v.sportId === 'string' &&
    SPORT_IDS.has(v.sportId) &&
    (v.mode === 'rally' || v.mode === 'match') &&
    typeof v.startedAt === 'number' &&
    Array.isArray(v.rallies) &&
    Array.isArray(v.sensors)
  )
}

/**
 * Merges a backup into the store; sessions with the same id are replaced.
 * Recordings are not in backups: a local session keeps its own, and video
 * references from another device are dropped.
 */
export async function importAll(value: unknown): Promise<{ sessions: number; skipped: number }> {
  if (!isBackup(value)) throw new Error('This file is not a tok backup.')
  const valid = value.sessions.filter(isSession)
  const d = await db()
  const local = await Promise.all(valid.map((s) => d.get('sessions', s.id)))
  const tx = d.transaction(['sessions', 'settings'], 'readwrite')
  await Promise.all([
    ...valid.map((session, i) => {
      const { videos: _theirs, ...rest } = session
      const mine = local[i]?.videos
      return tx.objectStore('sessions').put(mine ? { ...rest, videos: mine } : rest)
    }),
    ...Object.entries(value.settings).map(([key, setting]) =>
      tx.objectStore('settings').put(setting, key),
    ),
    tx.done,
  ])
  return { sessions: valid.length, skipped: value.sessions.length - valid.length }
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}
