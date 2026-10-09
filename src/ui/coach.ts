import { sport, type SportId } from '../engine/sports.ts'
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

/** The sport's own pause between rallies, in seconds; 0 = no limit. */
export const recommendedAutoEnd = (sportId: SportId): number => sport(sportId).rallyTimeoutMs / 1000

/**
 * Seconds without a hit after which a rally of this sport ends on its own;
 * 0 means never — the player ends each rally. Per sport, starting at the
 * sport's recommendation: a table-tennis exchange pauses far less than a
 * volleyball one.
 */
export const loadAutoEnd = (sportId: SportId): Promise<number> =>
  getSetting(`autoEnd:${sportId}`, recommendedAutoEnd(sportId))
export const saveAutoEnd = (sportId: SportId, seconds: number): Promise<void> =>
  setSetting(`autoEnd:${sportId}`, seconds)

export const saveCoach = (patch: Partial<CoachSettings>): Promise<void[]> =>
  Promise.all(Object.entries(patch).map(([k, v]) => setSetting(k, v)))

export const loadGoal = (sportId: SportId): Promise<number> => getSetting(`goal:${sportId}`, 0)
export const saveGoal = (sportId: SportId, goal: number): Promise<void> =>
  setSetting(`goal:${sportId}`, goal)
