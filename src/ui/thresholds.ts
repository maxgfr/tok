import { DEFAULT_THRESHOLD } from '../engine/onset.ts'
import type { SportId } from '../engine/sports.ts'
import { deleteSetting, getSetting, setSetting } from '../store/db.ts'

/** Threshold in MADs (2 = twitchy … 40 = deaf) ↔ a 0–100 sensitivity slider. */
export const MIN_THRESHOLD = 2
export const MAX_THRESHOLD = 40

/**
 * Within the slider's range: the old ten-hit calibration could store up to
 * 500, a deaf mic the slider showed as 0 and could not reach.
 */
const inRange = (k: number): number => Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, k))

/** The audio threshold each sport was set to on this device. */
export const loadThreshold = async (sportId: SportId): Promise<number> =>
  inRange(await getSetting(`threshold:${sportId}`, DEFAULT_THRESHOLD))

/**
 * The threshold the player set for a sport, or null when they never touched
 * the slider (or pressed Default): then tok sets it from their hits.
 */
export const loadStoredThreshold = async (sportId: SportId): Promise<number | null> => {
  const k = await getSetting<number | null>(`threshold:${sportId}`, null)
  return k === null ? null : inRange(k)
}

export const saveThreshold = (sportId: SportId, value: number): Promise<void> =>
  setSetting(`threshold:${sportId}`, value)

/** Forget the calibration: the sport counts at `DEFAULT_THRESHOLD` again. */
export const resetThreshold = (sportId: SportId): Promise<void> =>
  deleteSetting(`threshold:${sportId}`)

/** Whether sustained sounds (voices, squeaks) are kept out of the count. On unless turned off. */
export const loadVoiceFilter = (sportId: SportId): Promise<boolean> =>
  getSetting(`voiceFilter:${sportId}`, true)

export const saveVoiceFilter = (sportId: SportId, on: boolean): Promise<void> =>
  setSetting(`voiceFilter:${sportId}`, on)

export function thresholdToSensitivity(threshold: number): number {
  const clamped = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, threshold))
  const ratio = Math.log(clamped / MIN_THRESHOLD) / Math.log(MAX_THRESHOLD / MIN_THRESHOLD)
  return Math.round(100 * (1 - ratio))
}

export function sensitivityToThreshold(sensitivity: number): number {
  const ratio = 1 - Math.min(100, Math.max(0, sensitivity)) / 100
  return MIN_THRESHOLD * (MAX_THRESHOLD / MIN_THRESHOLD) ** ratio
}
