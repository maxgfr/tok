// Everything tok remembers lives here, in IndexedDB on this device. Rallies are
// stored inside their session: a session is the unit people browse, export and
// delete, and even a long one is a few hundred small records.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Side, ScoringRules } from '../engine/scoring/index.ts'
import { sport, SPORTS, type Mode, type SportId } from '../engine/sports.ts'
import { rallyCount, type SessionLike } from '../engine/stats.ts'
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
  /** Epoch ms of the last frame; absent while recording, and in older sessions. */
  endedAt?: number
  bytes: number
}

/**
 * What History and the verdicts need of a session, without its hits: a few
 * numbers instead of every hit of every rally. Kept beside each session.
 */
export interface SessionSummary {
  id: string
  sportId: SportId
  mode: Mode
  startedAt: number
  /** Each rally's count, as the player counts it (stats.rallyCount). */
  rallyCounts: number[]
  /** Each rally's start, for the day it belongs to. */
  rallyStarts: number[]
  /** Its recordings' files: what the launch-time cleanup must keep. */
  videoFiles: string[]
}

/** A summary as the stats read sessions: each rally is its count. */
export const asSessionLike = (s: SessionSummary): SessionLike => ({
  sportId: s.sportId,
  startedAt: s.startedAt,
  rallies: s.rallyCounts.map((count, i) => ({
    startedAt: s.rallyStarts[i] ?? s.startedAt,
    endedAt: s.rallyStarts[i] ?? s.startedAt,
    hits: [],
    endReason: 'manual',
    count,
  })),
})

/** A piece of a recording streamed into IndexedDB (no writable OPFS: iOS). */
export interface VideoChunkRecord {
  file: string
  seq: number
  /** Byte position in the file, for a muxer that writes at positions. */
  position: number
  data: Blob
  /** Epoch ms it was written: a recording still going is never cleaned up. */
  at: number
}

export function summaryOf(session: SessionRecord): SessionSummary {
  const { soundsPerHit } = sport(session.sportId)
  return {
    id: session.id,
    sportId: session.sportId,
    mode: session.mode,
    startedAt: session.startedAt,
    rallyCounts: session.rallies.map((r) => rallyCount(r, soundsPerHit)),
    rallyStarts: session.rallies.map((r) => r.startedAt),
    videoFiles: (session.videos ?? []).map((v) => v.file),
  }
}

interface TokDB extends DBSchema {
  sessions: { key: string; value: SessionRecord; indexes: { startedAt: number } }
  settings: { key: string; value: unknown }
  /** Recordings saved whole for browsers without a writable OPFS (before chunks). */
  videos: { key: string; value: Blob }
  summaries: { key: string; value: SessionSummary; indexes: { startedAt: number } }
  videoChunks: { key: [string, number]; value: VideoChunkRecord }
}

const DB_NAME = 'tok'

let dbPromise: Promise<IDBPDatabase<TokDB>> | null = null

function db(): Promise<IDBPDatabase<TokDB>> {
  dbPromise ??= openDB<TokDB>(DB_NAME, 3, {
    async upgrade(database, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const sessions = database.createObjectStore('sessions', { keyPath: 'id' })
        sessions.createIndex('startedAt', 'startedAt')
        database.createObjectStore('settings')
      }
      if (oldVersion < 2) database.createObjectStore('videos')
      if (oldVersion < 3) {
        const summaries = database.createObjectStore('summaries', { keyPath: 'id' })
        summaries.createIndex('startedAt', 'startedAt')
        database.createObjectStore('videoChunks', { keyPath: ['file', 'seq'] })
        // Every session already kept gets its summary.
        let cursor = await tx.objectStore('sessions').openCursor()
        while (cursor) {
          await tx.objectStore('summaries').put(summaryOf(cursor.value))
          cursor = await cursor.continue()
        }
      }
    },
    // The browser closed the connection (storage cleared, a crash): open a new one next time.
    terminated() {
      dbPromise = null
    },
  }).catch((error: unknown) => {
    // A failed open is not kept: the next call tries again.
    dbPromise = null
    throw error
  })
  return dbPromise
}

/** Saves the session and its summary together. */
export async function saveSession(session: SessionRecord): Promise<void> {
  const tx = (await db()).transaction(['sessions', 'summaries'], 'readwrite')
  await Promise.all([
    tx.objectStore('sessions').put(session),
    tx.objectStore('summaries').put(summaryOf(session)),
    tx.done,
  ])
}

/** Every session's summary, newest first: what History and the verdicts read. */
export async function listSummaries(): Promise<SessionSummary[]> {
  const all = await (await db()).getAllFromIndex('summaries', 'startedAt')
  return all.reverse()
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
  const tx = (await db()).transaction(['sessions', 'summaries'], 'readwrite')
  await Promise.all([
    tx.objectStore('sessions').delete(id),
    tx.objectStore('summaries').delete(id),
    tx.done,
  ])
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const value = await (await db()).get('settings', key)
  return value === undefined ? fallback : (value as T)
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', value, key)
}

/**
 * Reads, changes and writes a setting in one transaction: two changes made at
 * once (two fields of the same rules) both land.
 */
export async function updateSetting<T>(
  key: string,
  fallback: T,
  update: (value: T) => T,
): Promise<void> {
  const tx = (await db()).transaction('settings', 'readwrite')
  const store = tx.objectStore('settings')
  const value = await store.get(key)
  await Promise.all([
    store.put(update(value === undefined ? fallback : (value as T)), key),
    tx.done,
  ])
}

/** Several settings written together, in one transaction. */
export async function setSettings(values: Record<string, unknown>): Promise<void> {
  const tx = (await db()).transaction('settings', 'readwrite')
  await Promise.all([
    ...Object.entries(values).map(([key, value]) => tx.objectStore('settings').put(value, key)),
    tx.done,
  ])
}

export async function deleteSetting(key: string): Promise<void> {
  await (await db()).delete('settings', key)
}

export async function clearAll(): Promise<void> {
  const d = await db()
  await Promise.all([
    d.clear('sessions'),
    d.clear('summaries'),
    d.clear('settings'),
    d.clear('videos'),
    d.clear('videoChunks'),
  ])
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

const chunksOf = (file: string) => IDBKeyRange.bound([file, 0], [file, Infinity])

export async function putVideoChunk(chunk: VideoChunkRecord): Promise<void> {
  await (await db()).put('videoChunks', chunk)
}

/** A recording's chunks, in the order they were written. */
export async function getVideoChunks(file: string): Promise<VideoChunkRecord[]> {
  return (await db()).getAll('videoChunks', chunksOf(file))
}

export async function deleteVideoChunks(file: string): Promise<void> {
  await (await db()).delete('videoChunks', chunksOf(file))
}

/** Names of every recording kept in IndexedDB, whole or in chunks. */
export async function listVideoKeys(): Promise<string[]> {
  const d = await db()
  const [whole, chunks] = await Promise.all([d.getAllKeys('videos'), d.getAllKeys('videoChunks')])
  return [...new Set([...whole, ...chunks.map(([file]) => file)])]
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

const SOURCES = new Set<unknown>(['audio', 'motion', 'vision', 'manual'])
const END_REASONS = new Set<unknown>(['timeout', 'ground', 'manual'])
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isHit(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const h = value as Record<string, unknown>
  return (
    isNumber(h.t) &&
    isNumber(h.confidence) &&
    Array.isArray(h.sources) &&
    h.sources.every((s) => SOURCES.has(s))
  )
}

/** A rally the screens can count and replay: a broken one would crash them. */
function isRally(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    isNumber(r.startedAt) &&
    isNumber(r.endedAt) &&
    END_REASONS.has(r.endReason) &&
    Array.isArray(r.hits) &&
    r.hits.every(isHit) &&
    (r.winner === undefined || r.winner === 'A' || r.winner === 'B') &&
    (r.count === undefined || (isNumber(r.count) && r.count >= 0)) &&
    (r.wonAt === undefined || isNumber(r.wonAt))
  )
}

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
    v.rallies.every(isRally) &&
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
  const tx = d.transaction(['sessions', 'summaries', 'settings'], 'readwrite')
  await Promise.all([
    ...valid.flatMap((session, i) => {
      const { videos: _theirs, ...rest } = session
      const mine = local[i]?.videos
      const kept = mine ? { ...rest, videos: mine } : rest
      return [
        tx.objectStore('sessions').put(kept),
        tx.objectStore('summaries').put(summaryOf(kept)),
      ]
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
