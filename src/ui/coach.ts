import type { SportId } from '../engine/sports.ts'
import { getSetting, setSetting } from '../store/db.ts'

/** Coach preferences: spoken calls, sounds, the remote, and a goal per sport. */
export interface CoachSettings {
  voice: boolean
  remote: boolean
  /** A click for each hit, a chime when a rally ends. On unless turned off. */
  sounds: boolean
}

export const loadCoach = async (): Promise<CoachSettings> => ({
  voice: await getSetting('voice', false),
  remote: await getSetting('remote', false),
  sounds: await getSetting('sounds', true),
})

/**
 * Seconds without a hit after which a rally ends on its own; 0 (the default)
 * means never — the player ends each rally.
 */
export const loadAutoEnd = (): Promise<number> => getSetting('autoEnd', 0)
export const saveAutoEnd = (seconds: number): Promise<void> => setSetting('autoEnd', seconds)

export const saveCoach = (patch: Partial<CoachSettings>): Promise<void[]> =>
  Promise.all(Object.entries(patch).map(([k, v]) => setSetting(k, v)))

export const loadGoal = (sportId: SportId): Promise<number> => getSetting(`goal:${sportId}`, 0)
export const saveGoal = (sportId: SportId, goal: number): Promise<void> =>
  setSetting(`goal:${sportId}`, goal)
