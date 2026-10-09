// What a player can change for one sport: the match rules (points to win a
// set, sets, win by two…) and how many rallies a rally session lasts. Each
// starts at the sport's default; reset puts every one of them back, with the
// goal and the automatic rally end.

import type { RallyScoring, ScoringRules, TennisScoring } from '../engine/scoring/index.ts'
import { sport, type SportId } from '../engine/sports.ts'
import { deleteSetting, getSetting, setSetting } from '../store/db.ts'

/** The parts of a sport's rules a player can change. */
export type RulesPatch =
  | Partial<Pick<RallyScoring, 'pointsToWin' | 'setsToWin' | 'winBy'>>
  | Partial<Pick<TennisScoring, 'setsToWin' | 'gamesPerSet' | 'goldenPoint'>>

const rulesKey = (sportId: SportId) => `rules:${sportId}`
const rallyLimitKey = (sportId: SportId) => `rallyLimit:${sportId}`

/** The rules a match of this sport is played by: its defaults, then the player's changes. */
export async function loadRules(sportId: SportId): Promise<ScoringRules | null> {
  const defaults = sport(sportId).scoring
  if (!defaults) return null
  const patch = await getSetting<RulesPatch>(rulesKey(sportId), {})
  return { ...defaults, ...patch } as ScoringRules
}

export async function saveRules(sportId: SportId, patch: RulesPatch): Promise<void> {
  const before = await getSetting<RulesPatch>(rulesKey(sportId), {})
  await setSetting(rulesKey(sportId), { ...before, ...patch })
}

/** Rallies after which a rally-mode session ends on its own; 0 = no limit (the default). */
export const loadRallyLimit = (sportId: SportId): Promise<number> =>
  getSetting(rallyLimitKey(sportId), 0)

export const saveRallyLimit = (sportId: SportId, rallies: number): Promise<void> =>
  setSetting(rallyLimitKey(sportId), rallies)

/** Every setting of this sport back to its default. */
export async function resetSport(sportId: SportId): Promise<void> {
  await Promise.all(
    [rulesKey, rallyLimitKey, (id: SportId) => `autoEnd:${id}`, (id: SportId) => `goal:${id}`].map(
      (key) => deleteSetting(key(sportId)),
    ),
  )
}
