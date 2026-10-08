// How a finished rally compares: record, best of the day, goal reached.

export interface Standing {
  /** Best rally ever recorded before this session. */
  best: number
  /** Best rally today before this session. */
  todayBest: number
  /** Best rally earlier in this session. */
  sessionBest: number
  /** The player's goal for this sport, 0 when none. */
  goal: number
}

export interface Judgement {
  record: boolean
  todayBest: boolean
  goal: number | null
}

export function judgeRally(count: number, s: Standing): Judgement {
  const today = Math.max(s.todayBest, s.sessionBest)
  const ever = Math.max(s.best, s.sessionBest)
  const worthIt = count > 1
  const record = worthIt && count > ever
  return {
    record,
    todayBest: worthIt && !record && count > today,
    goal: s.goal > 0 && count >= s.goal && today < s.goal ? s.goal : null,
  }
}
