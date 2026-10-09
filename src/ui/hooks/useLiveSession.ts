import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { initialLive, liveStep, matchPoints, type LiveAction } from '../../engine/live.ts'
import type { RallyConfig } from '../../engine/rally.ts'
import { replay, type MatchView, type Side } from '../../engine/scoring/index.ts'
import { sport, type SportPreset } from '../../engine/sports.ts'
import { judgeRally } from '../../engine/judge.ts'
import { countHits, rallyCount, summarize, type Summary } from '../../engine/stats.ts'
import type { Hit, Rally, SensorKind } from '../../engine/types.ts'
import { buzz } from '../../device/haptics.ts'
import { listSessions, saveSession, type SessionRecord } from '../../store/db.ts'
import { loadAutoEnd, loadGoal } from '../coach.ts'
import type { LiveConfig } from '../config.ts'

export interface RallyVerdict {
  rally: Rally
  count: number
  /** Beat every rally ever recorded for this sport. */
  record: boolean
  /** Beat today's best (but not the record). */
  todayBest: boolean
  /** The goal this rally reached, if it is the first to reach it today. */
  goal: number | null
}

export interface LiveSession {
  preset: SportPreset
  id: string
  /** Hits in the rally in progress (or the last one, once it ended). */
  count: number
  inRally: boolean
  rallies: Rally[]
  match: MatchView | null
  awaitingWinner: boolean
  best: number
  todayBest: number
  /** The player's goal for this sport, 0 when none. */
  goal: number
  verdict: RallyVerdict | null
  dispatch: (action: LiveAction) => void
  tap: () => void
  /** A hit picked up by the sensors (already fused). */
  sense: (hit: Hit) => void
  undoHit: () => void
  endRally: () => void
  /** Throws the rally in progress away: back to 0, nothing recorded. */
  restartRally: () => void
  point: (side: Side) => void
  undoPoint: () => void
  finish: (extra?: Partial<SessionRecord>) => Promise<string | null>
}

/** Epoch ms. Sensor timestamps are converted to it (device/clock.ts). */
export const now = (): number => Date.now()

export function useLiveSession(config: LiveConfig, sensors: SensorKind[]): LiveSession {
  const preset = sport(config.sportId)
  // Seconds of silence that end a rally, if the player asked for it (Settings).
  const [autoEnd, setAutoEnd] = useState(0)
  useEffect(() => {
    void loadAutoEnd(config.sportId).then(setAutoEnd)
  }, [config.sportId])
  const rallyConfig = useMemo<RallyConfig>(
    () => ({
      timeoutMs: autoEnd > 0 ? autoEnd * 1000 : preset.rallyTimeoutMs,
      refractoryMs: preset.refractoryMs,
      // Taps are deliberate; a lone sensor blip is noise. In a match an ace is real.
      minHits: config.mode === 'match' || config.input === 'manual' ? 1 : 2,
    }),
    [preset, config.mode, config.input, autoEnd],
  )
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof initialLive>, a: LiveAction) => liveStep(s, a, rallyConfig),
    undefined,
    initialLive,
  )
  const [id] = useState(() => crypto.randomUUID())
  const [startedAt] = useState(() => Date.now())
  // Every earlier session, boiled down to the numbers a verdict needs.
  const [before, setBefore] = useState<Summary>({ best: 0, todayBest: 0, average: 0, rallies: 0 })
  const [verdict, setVerdict] = useState<RallyVerdict | null>(null)
  const savedOnce = useRef(false)
  // Once finish() has started, it owns the last write.
  const finishing = useRef(false)
  // A new array with the same sensors must not look like a change.
  const sensorsKey = sensors.join(',')
  const stableSensors = useMemo(
    () => (sensorsKey ? (sensorsKey.split(',') as SensorKind[]) : []),
    [sensorsKey],
  )
  const [goal, setGoal] = useState(0)
  useEffect(() => {
    void loadGoal(config.sportId).then(setGoal)
  }, [config.sportId])

  useEffect(() => {
    let alive = true
    void listSessions().then((all) => {
      if (!alive) return
      const earlier = all.filter((s) => s.id !== id)
      setBefore(summarize(earlier, config.sportId, preset.soundsPerHit, startedAt))
    })
    return () => {
      alive = false
    }
  }, [id, config.sportId, preset.soundsPerHit, startedAt])

  // A rally ends when the player says so (End rally, a point, a remote button).
  // Only if they turned on "end rallies on their own" does a timer, armed for
  // the moment the silence gets that long, end it for them.
  const lastHitAt =
    autoEnd > 0 && state.rally.phase === 'rally' ? state.rally.hits.at(-1)?.t : undefined
  const { timeoutMs } = rallyConfig
  useEffect(() => {
    if (lastHitAt === undefined) return
    let timer = 0
    const arm = () => {
      const wait = Math.max(20, lastHitAt + timeoutMs - now() + 20)
      timer = window.setTimeout(() => {
        dispatch({ type: 'tick', t: now() })
        // Still open (the clock moved back): look again.
        arm()
      }, wait)
    }
    arm()
    return () => window.clearTimeout(timer)
  }, [lastHitAt, timeoutMs])

  // The session's best, and its best before the rally that just ended (what
  // that rally is judged against): one pass over the rallies.
  const { sessionBest, earlierBest } = useMemo(() => {
    let earlier = 0
    let last = 0
    for (const r of state.rallies) {
      const n = rallyCount(r, preset.soundsPerHit)
      if (r === state.lastEnded) last = n
      else earlier = Math.max(earlier, n)
    }
    return { sessionBest: Math.max(earlier, last), earlierBest: earlier }
  }, [state.rallies, state.lastEnded, preset.soundsPerHit])

  // Judge each rally as it ends.
  const judged = useRef<Rally | null>(null)
  useEffect(() => {
    const rally = state.lastEnded
    if (!rally || judged.current === rally) return
    judged.current = rally
    const count = rallyCount(rally, preset.soundsPerHit)
    const judgement = judgeRally(count, {
      best: before.best,
      todayBest: before.todayBest,
      sessionBest: earlierBest,
      goal,
    })
    setVerdict({ rally, count, ...judgement })
    buzz(judgement.record || judgement.goal ? [40, 60, 40, 60, 120] : [30, 50, 30])
  }, [state.lastEnded, earlierBest, before, preset.soundsPerHit, goal])

  const record = useCallback(
    (endedAt: number | null, rallies: Rally[]): SessionRecord => ({
      id,
      sportId: config.sportId,
      mode: config.mode,
      startedAt,
      endedAt,
      sensors: stableSensors,
      rallies,
      match:
        config.mode === 'match' && preset.scoring
          ? { rules: preset.scoring, firstServer: config.firstServer, names: config.names }
          : null,
    }),
    [id, config, startedAt, stableSensors, preset.scoring],
  )

  // Persist as rallies complete, so a crash or a closed tab loses at most one rally.
  useEffect(() => {
    if (finishing.current) return
    if (state.rallies.length === 0 && !savedOnce.current) return
    savedOnce.current = true
    void saveSession(record(null, state.rallies))
  }, [state.rallies, record])

  const inRally = state.rally.phase === 'rally'
  const current = inRally ? state.rally.hits : (state.lastEnded?.hits ?? [])
  const count = countHits(current, preset.soundsPerHit)

  const match = useMemo(
    () =>
      config.mode === 'match' && preset.scoring
        ? replay(preset.scoring, matchPoints(state.rallies), config.firstServer)
        : null,
    [config.mode, config.firstServer, preset.scoring, state.rallies],
  )

  const tap = useCallback(() => {
    const hit: Hit = { t: now(), sources: ['manual'], confidence: 1 }
    setVerdict(null)
    dispatch({ type: 'hit', hit })
    buzz(8)
  }, [])

  const sense = useCallback((hit: Hit) => {
    setVerdict(null)
    // A clock glitch must never stamp a hit in the future: the rally would
    // wait for it and never time out.
    dispatch({ type: 'hit', hit: { ...hit, t: Math.min(hit.t, now()) } })
  }, [])

  const finish = useCallback(
    async (extra?: Partial<SessionRecord>): Promise<string | null> => {
      finishing.current = true
      let rallies = state.rallies
      if (state.rally.phase === 'rally') {
        rallies = liveStep(state, { type: 'end', t: now(), reason: 'manual' }, rallyConfig).rallies
      }
      if (rallies.length === 0) return null
      await saveSession({ ...record(Date.now(), rallies), ...extra })
      return id
    },
    [state, rallyConfig, record, id],
  )

  return {
    preset,
    id,
    count,
    inRally,
    rallies: state.rallies,
    match,
    awaitingWinner: config.mode === 'match' && state.awaitingWinner,
    best: Math.max(before.best, sessionBest),
    todayBest: Math.max(before.todayBest, sessionBest),
    goal,
    verdict: inRally ? null : verdict,
    dispatch,
    tap,
    sense,
    undoHit: () => dispatch({ type: 'undo' }),
    endRally: () => dispatch({ type: 'end', t: now(), reason: 'manual' }),
    restartRally: () => {
      setVerdict(null)
      dispatch({ type: 'discard' })
    },
    point: (side: Side) => {
      setVerdict(null)
      dispatch({ type: 'point', side, t: now() })
      buzz(15)
    },
    undoPoint: () => dispatch({ type: 'undoPoint' }),
    finish,
  }
}
