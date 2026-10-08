import type { SportId } from '../engine/sports.ts'
import { getSetting, setSetting } from '../store/db.ts'

/** Coach preferences: spoken calls, the remote, and a goal per sport. */
export interface CoachSettings {
  voice: boolean
  remote: boolean
}

export const loadCoach = async (): Promise<CoachSettings> => ({
  voice: await getSetting('voice', false),
  remote: await getSetting('remote', false),
})

export const saveCoach = (patch: Partial<CoachSettings>): Promise<void[]> =>
  Promise.all(Object.entries(patch).map(([k, v]) => setSetting(k, v)))

export const loadGoal = (sportId: SportId): Promise<number> => getSetting(`goal:${sportId}`, 0)
export const saveGoal = (sportId: SportId, goal: number): Promise<void> =>
  setSetting(`goal:${sportId}`, goal)
