// Numbers people care about: how long the rallies were, how fast, and whether
// today beat the record.

import type { SportId } from './sports.ts'
import type { Hit, Rally } from './types.ts'

export interface SessionLike {
  sportId: SportId
  startedAt: number
  rallies: Rally[]
}

/** Hits as the player counts them: some sports make two sounds per hit. */
export function countHits(hits: readonly Hit[], soundsPerHit: 1 | 2): number {
  let manual = 0
  let sensed = 0
  for (const hit of hits) {
    if (hit.sources.includes('manual')) manual += 1
    else sensed += 1
  }
  return manual + Math.ceil(sensed / soundsPerHit)
}

/** A rally's count: the player's correction if they made one, else its hits. */
export const rallyCount = (rally: Rally, soundsPerHit: 1 | 2): number =>
  rally.count ?? countHits(rally.hits, soundsPerHit)

/** Hits per minute across a rally; null under two seconds, where it would be noise. */
export function tempo(rally: Rally): number | null {
  const first = rally.hits[0]
  const last = rally.hits.at(-1)
  if (!first || !last || rally.hits.length < 2 || last.t - first.t < 2000) return null
  return ((rally.hits.length - 1) * 60_000) / (last.t - first.t)
}

const dayKey = (t: number): string => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface Summary {
  best: number
  todayBest: number
  average: number
  rallies: number
}

export function summarize(
  sessions: readonly SessionLike[],
  sportId: SportId,
  soundsPerHit: 1 | 2,
  now: number,
): Summary {
  const today = dayKey(now)
  let best = 0
  let todayBest = 0
  let total = 0
  let rallies = 0
  for (const session of sessions) {
    if (session.sportId !== sportId) continue
    for (const rally of session.rallies) {
      const n = rallyCount(rally, soundsPerHit)
      best = Math.max(best, n)
      if (dayKey(rally.startedAt) === today) todayBest = Math.max(todayBest, n)
      total += n
      rallies += 1
    }
  }
  return { best, todayBest, average: rallies ? total / rallies : 0, rallies }
}

export interface DayPoint {
  day: string
  best: number
  average: number
  rallies: number
}

export function dailySeries(
  sessions: readonly SessionLike[],
  sportId: SportId,
  soundsPerHit: 1 | 2,
): DayPoint[] {
  const days = new Map<string, number[]>()
  for (const session of sessions) {
    if (session.sportId !== sportId) continue
    for (const rally of session.rallies) {
      const key = dayKey(rally.startedAt)
      const list = days.get(key) ?? []
      list.push(rallyCount(rally, soundsPerHit))
      days.set(key, list)
    }
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, counts]) => ({
      day,
      best: Math.max(...counts),
      average: counts.reduce((a, b) => a + b, 0) / counts.length,
      rallies: counts.length,
    }))
}
