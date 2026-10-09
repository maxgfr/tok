import { useEffect, useState } from 'react'
import type { ScoringRules } from '../../engine/scoring/index.ts'
import { SPORTS, sport, type SportId } from '../../engine/sports.ts'
import { loadAutoEnd, loadGoal, recommendedAutoEnd, saveAutoEnd, saveGoal } from '../coach.ts'
import {
  loadRallyLimit,
  loadRules,
  resetSport,
  saveRallyLimit,
  saveRules,
  type RulesPatch,
} from '../sportSettings.ts'
import { Toggle } from './Toggle.tsx'

/** Seconds of silence that can end a rally; every sport's recommendation is one of them. */
const AUTO_END_CHOICES = [0, 1.5, 2, 2.5, 3, 3.5, 4, 5, 8]
const RALLY_LIMITS = [0, 5, 10, 20, 50]
const POINTS = [5, 7, 11, 15, 21, 25]
const SETS = [1, 2, 3, 4]
const GAMES = [4, 6]

const SELECT = 'min-h-12 rounded-lg border border-rule bg-slate-2 px-3 text-chalk'

/** "Best of 3" for 2 sets to win. */
const setsLabel = (n: number) => (n === 1 ? 'One set' : `${n} — best of ${2 * n - 1}`)

/** Choices, with the sport's default among them and marked. */
function choices(values: number[], fallback: number, label: (n: number) => string) {
  const all = values.includes(fallback) ? values : [...values, fallback].sort((a, b) => a - b)
  return all.map((n) => (
    <option key={n} value={n}>
      {label(n)}
      {n === fallback ? ' · default' : ''}
    </option>
  ))
}

interface Values {
  goal: number
  autoEnd: number
  rallyLimit: number
  rules: ScoringRules | null
}

/**
 * Everything that is set per sport, behind one sport picker: the goal, when a
 * rally ends on its own, how many rallies a session lasts, the match rules —
 * and a reset to the sport's defaults.
 */
export function SportSettings() {
  const [sportId, setSportId] = useState<SportId>('table-tennis')
  const [values, setValues] = useState<(Values & { sportId: SportId }) | null>(null)
  // Bumped by Reset: the values are read again.
  const [loads, setLoads] = useState(0)

  useEffect(() => {
    let alive = true
    void Promise.all([
      loadGoal(sportId),
      loadAutoEnd(sportId),
      loadRallyLimit(sportId),
      loadRules(sportId),
    ]).then(([goal, autoEnd, rallyLimit, rules]) => {
      if (alive) setValues({ sportId, goal, autoEnd, rallyLimit, rules })
    })
    return () => {
      alive = false
    }
  }, [sportId, loads])

  const preset = sport(sportId)
  const current = values?.sportId === sportId ? values : null
  const defaults = preset.scoring
  const update = (patch: Partial<Values>) => {
    if (current) setValues({ ...current, ...patch })
  }
  const changeRules = (patch: RulesPatch) => {
    if (!current?.rules) return
    update({ rules: { ...current.rules, ...patch } as ScoringRules })
    void saveRules(sportId, patch)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="sport-settings" className="font-semibold">
          Sport
        </label>
        <select
          id="sport-settings"
          value={sportId}
          onChange={(e) => setSportId(e.target.value as SportId)}
          className={`${SELECT} text-lg`}
        >
          {SPORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {current && (
        <>
          <div className="grid grid-cols-[1fr_7rem] items-center gap-2">
            <div className="flex flex-col">
              <label htmlFor="goal-value" className="font-semibold">
                Goal in one rally
              </label>
              <span id="goal-hint" className="text-sm text-chalk-dim">
                The board cheers the first time each day.
              </span>
            </div>
            <input
              id="goal-value"
              aria-describedby="goal-hint"
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              placeholder="None"
              value={current.goal || ''}
              onChange={(e) => {
                const goal = Math.max(0, Math.min(9999, Math.round(Number(e.target.value) || 0)))
                update({ goal })
                void saveGoal(sportId, goal)
              }}
              className="figures min-h-12 rounded-lg border border-rule bg-slate-2 px-3 text-right text-2xl text-chalk placeholder:text-chalk-faint"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="auto-end" className="font-semibold">
              End a rally on its own
            </label>
            <select
              id="auto-end"
              value={current.autoEnd}
              onChange={(e) => {
                const autoEnd = Number(e.target.value)
                update({ autoEnd })
                void saveAutoEnd(sportId, autoEnd)
              }}
              className={SELECT}
            >
              {AUTO_END_CHOICES.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds === 0 ? 'No limit' : `After ${seconds} s without a hit`}
                  {seconds === recommendedAutoEnd(sportId) ? ' · recommended' : ''}
                </option>
              ))}
            </select>
            <span className="text-sm text-chalk-dim">
              No limit: you end each rally. End rally, a point or the earbuds always can.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="rally-limit" className="font-semibold">
              Rallies per session
            </label>
            <select
              id="rally-limit"
              value={current.rallyLimit}
              onChange={(e) => {
                const rallyLimit = Number(e.target.value)
                update({ rallyLimit })
                void saveRallyLimit(sportId, rallyLimit)
              }}
              className={SELECT}
            >
              {choices(RALLY_LIMITS, 0, (n) => (n === 0 ? 'No limit' : `${n} rallies`))}
            </select>
            <span className="text-sm text-chalk-dim">
              Counting rallies: the session ends on its own after that many.
            </span>
          </div>

          {current.rules?.kind === 'rally' && defaults?.kind === 'rally' && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 font-semibold">Match rules</legend>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="rules-points" className="text-sm text-chalk-dim">
                    Points to win a set
                  </label>
                  <select
                    id="rules-points"
                    value={current.rules.pointsToWin}
                    onChange={(e) => changeRules({ pointsToWin: Number(e.target.value) })}
                    className={`${SELECT} text-base`}
                  >
                    {choices(POINTS, defaults.pointsToWin, String)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="rules-sets" className="text-sm text-chalk-dim">
                    Sets to win the match
                  </label>
                  <select
                    id="rules-sets"
                    value={current.rules.setsToWin}
                    onChange={(e) => changeRules({ setsToWin: Number(e.target.value) })}
                    className={`${SELECT} text-base`}
                  >
                    {choices(SETS, defaults.setsToWin, setsLabel)}
                  </select>
                </div>
              </div>
              <Toggle
                label="Win by 2"
                hint={`At ${current.rules.pointsToWin - 1}–${current.rules.pointsToWin - 1}, play on until one side leads by two.`}
                checked={current.rules.winBy >= 2}
                onChange={(on) => changeRules({ winBy: on ? 2 : 1 })}
              />
            </fieldset>
          )}

          {current.rules?.kind === 'tennis' && defaults?.kind === 'tennis' && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 font-semibold">Match rules</legend>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="rules-games" className="text-sm text-chalk-dim">
                    Games per set
                  </label>
                  <select
                    id="rules-games"
                    value={current.rules.gamesPerSet}
                    onChange={(e) => changeRules({ gamesPerSet: Number(e.target.value) })}
                    className={`${SELECT} text-base`}
                  >
                    {choices(GAMES, defaults.gamesPerSet, String)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="rules-tennis-sets" className="text-sm text-chalk-dim">
                    Sets to win the match
                  </label>
                  <select
                    id="rules-tennis-sets"
                    value={current.rules.setsToWin}
                    onChange={(e) => changeRules({ setsToWin: Number(e.target.value) })}
                    className={`${SELECT} text-base`}
                  >
                    {choices(SETS.slice(0, 3), defaults.setsToWin, setsLabel)}
                  </select>
                </div>
              </div>
              <Toggle
                label="Golden point"
                hint="At deuce, the next point wins the game: no advantage."
                checked={!!current.rules.goldenPoint}
                onChange={(goldenPoint) => changeRules({ goldenPoint })}
              />
            </fieldset>
          )}

          <button
            type="button"
            onClick={() => void resetSport(sportId).then(() => setLoads((n) => n + 1))}
            className="min-h-11 self-start rounded-lg px-3 font-semibold text-chalk-dim hover:text-chalk"
          >
            Reset {preset.name} to defaults
          </button>
        </>
      )}
    </div>
  )
}
