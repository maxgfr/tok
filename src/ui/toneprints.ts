import type { SportId } from '../engine/sports.ts'
import type { Toneprint } from '../engine/toneprint.ts'
import { deleteSetting, getSetting, setSetting } from '../store/db.ts'

/** What tok learned of the player's ball for a sport (engine/toneprint.ts). */
export const loadToneprint = (sportId: SportId): Promise<Toneprint | null> =>
  getSetting<Toneprint | null>(`toneprint:${sportId}`, null)

export const saveToneprint = (sportId: SportId, model: Toneprint): Promise<void> =>
  setSetting(`toneprint:${sportId}`, model)

export const resetToneprint = (sportId: SportId): Promise<void> =>
  deleteSetting(`toneprint:${sportId}`)

/** Whether sounds unlike the player's ball are set aside. On unless turned off. */
export const loadToneFilter = (sportId: SportId): Promise<boolean> =>
  getSetting(`toneFilter:${sportId}`, true)

export const saveToneFilter = (sportId: SportId, on: boolean): Promise<void> =>
  setSetting(`toneFilter:${sportId}`, on)
