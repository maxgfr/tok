import { DEFAULT_THRESHOLD } from '../engine/onset.ts'
import type { SportId } from '../engine/sports.ts'
import { getSetting, setSetting } from '../store/db.ts'

/** The audio threshold each sport was calibrated to on this device. */
export const loadThreshold = (sportId: SportId): Promise<number> =>
  getSetting(`threshold:${sportId}`, DEFAULT_THRESHOLD)

export const saveThreshold = (sportId: SportId, value: number): Promise<void> =>
  setSetting(`threshold:${sportId}`, value)

/** Threshold in MADs (2 = twitchy … 40 = deaf) ↔ a 0–100 sensitivity slider. */
export const MIN_THRESHOLD = 2
export const MAX_THRESHOLD = 40

export function thresholdToSensitivity(threshold: number): number {
  const clamped = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, threshold))
  const ratio = Math.log(clamped / MIN_THRESHOLD) / Math.log(MAX_THRESHOLD / MIN_THRESHOLD)
  return Math.round(100 * (1 - ratio))
}

export function sensitivityToThreshold(sensitivity: number): number {
  const ratio = 1 - Math.min(100, Math.max(0, sensitivity)) / 100
  return MIN_THRESHOLD * (MAX_THRESHOLD / MIN_THRESHOLD) ** ratio
}
