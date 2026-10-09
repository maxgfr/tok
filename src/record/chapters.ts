// Pure helpers for recordings: where each rally sits in the video, and which
// container the browser can write.

import { rallyCount } from '../engine/stats.ts'
import type { Rally } from '../engine/types.ts'

export interface Chapter {
  index: number
  /** Seconds from the start of the video. */
  start: number
  end: number
  count: number
  best: boolean
}

const PRE_ROLL_S = 1
const POST_ROLL_S = 0.5

/** Chapters for the rallies a recording covers. `soundsPerHit` as in stats. */
export function chapters(
  rallies: readonly Rally[],
  videoStartedAt: number,
  soundsPerHit: 1 | 2,
): Chapter[] {
  const list = rallies
    .map((r, index) => ({ r, index, count: rallyCount(r, soundsPerHit) }))
    .filter(({ r, count }) => count > 0 && r.endedAt >= videoStartedAt)
    .map(({ r, index, count }) => ({
      index,
      start: Math.max(0, (r.startedAt - videoStartedAt) / 1000 - PRE_ROLL_S),
      end: (r.endedAt - videoStartedAt) / 1000 + POST_ROLL_S,
      count,
      best: false,
    }))
  const top = Math.max(0, ...list.map((c) => c.count))
  const first = list.find((c) => c.count === top)
  if (first) first.best = true
  return list
}

export interface RecordingFormat {
  mimeType: string
  ext: 'mp4' | 'webm'
}

const CANDIDATES: RecordingFormat[] = [
  { mimeType: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { mimeType: 'video/mp4', ext: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
  { mimeType: 'video/webm', ext: 'webm' },
]

export function pickRecordingFormat(
  isSupported: (type: string) => boolean,
): RecordingFormat | null {
  return CANDIDATES.find((c) => isSupported(c.mimeType)) ?? null
}
