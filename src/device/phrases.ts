// What the coach says out loud. Short, so it is over before the next serve.

import { other, type MatchView, type ScoringRules } from '../engine/scoring/index.ts'

export interface RallyCall {
  count: number
  record: boolean
  todayBest: boolean
  /** The goal this rally reached, if any. */
  goal: number | null
}

export function rallyPhrase(call: RallyCall, todayBest: number): string {
  if (call.goal !== null) return `Goal! ${call.count}.`
  if (call.record) return `New record! ${call.count}.`
  if (call.todayBest) return `Best today! ${call.count}.`
  return `${call.count}. Best today, ${todayBest}.`
}

const TENNIS_WORDS: Record<string, string> = {
  '0': 'love',
  '15': 'fifteen',
  '30': 'thirty',
  '40': 'forty',
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function matchPhrase(
  view: MatchView,
  names: { A: string; B: string },
  rules: ScoringRules,
): string {
  if (view.winner) return `Game, set and match, ${names[view.winner]}!`
  const server = view.server
  const receiver = other(server)
  const suffix = view.matchPoint ? ' Match point.' : view.setPoint ? ' Set point.' : ''

  if (rules.kind === 'tennis' && !view.tiebreak && view.games) {
    const { current } = view
    if (current.A === '0' && current.B === '0') {
      return `Games: ${names.A} ${view.games.A}, ${names.B} ${view.games.B}.`
    }
    if (current.A === '40' && current.B === '40') return `Deuce.${suffix}`
    if (current.A === 'AD' || current.B === 'AD') {
      return `Advantage, ${names[current.A === 'AD' ? 'A' : 'B']}.${suffix}`
    }
    const s = TENNIS_WORDS[current[server]] ?? current[server]
    const r = TENNIS_WORDS[current[receiver]] ?? current[receiver]
    return `${capital(s)}, ${r}.${suffix}`
  }

  const serves = rules.kind === 'rally' ? ` ${names[server]} serves.` : ''
  return `${view.current[server]}, ${view.current[receiver]}.${serves}${suffix}`
}
