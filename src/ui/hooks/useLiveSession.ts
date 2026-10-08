import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { initialLive, liveStep, matchPoints, type LiveAction } from '../../engine/live.ts'
import type { RallyConfig } from '../../engine/rally.ts'
import { replay, type MatchView, type Side } from '../../engine/scoring/index.ts'
import { sport, type SportPreset } from '../../engine/sports.ts'
import { countHits, summarize } from '../../engine/stats.ts'
import type { Hit, Rally, SensorKind } from '../../engine/types.ts'
import { buzz } from '../../device/haptics.ts'
import { listSessions, saveSession, type SessionRecord } from '../../store/db.ts'
import type { LiveConfig } from '../config.ts'

export interface RallyVerdict {
  rally: Rally
  count: number
  /** Beat every rally ever recorded for this sport. */
  record: boolean
  /** Beat today's best (but not the record). */
  todayBest: boolean
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
  verdict: RallyVerdict | null
  sensors: SensorKind[]
  dispatch: (action: LiveAction) => void
  tap: () => void
  /** A hit picked up by the sensors (already fused). */
  sense: (hit: Hit) => void
  undoHit: () => void
  endRally: () => void
  point: (side: Side) => void
  undoPoint: () => void
  finish: (extra?: Partial<SessionRecord>) => Promise<string | null>
}

/** Epoch ms with sub-ms precision; sensor timestamps share this clock. */
export const now = (): number => performance.timeOrigin + performance.now()

export function useLiveSession(config: LiveConfig, sensors: SensorKind[]): LiveSession {
  const preset = sport(config.sportId)
  const rallyConfig = useMemo<RallyConfig>(
    () => ({
      timeoutMs: preset.rallyTimeoutMs,
      refractoryMs: preset.refractoryMs,
      // Taps are deliberate; a lone sensor blip is noise. In a match an ace is real.
      minHits: config.mode === 'match' || config.input === 'manual' ? 1 : 2,
    }),
    [preset, config.mode, config.input],
  )
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof initialLive>, a: LiveAction) => liveStep(s, a, rallyConfig),
    undefined,
    initialLive,
  )
  const [id] = useState(() => crypto.randomUUID())
  const [startedAt] = useState(() => Date.now())
  const [openedAt] = useState(() => Date.now())
  const [history, setHistory] = useState<SessionRecord[]>([])
  const [verdict, setVerdict] = useState<RallyVerdict | null>(null)
  const savedOnce = useRef(false)

  useEffect(() => {
    let alive = true
    void listSessions().then((all) => {
      if (alive) setHistory(all.filter((s) => s.id !== id))
    })
    return () => {
      alive = false
    }
  }, [id])

  // The clock drives rally timeouts.
  useEffect(() => {
    const timer = window.setInterval(() => dispatch({ type: 'tick', t: now() }), 200)
    return () => window.clearInterval(timer)
  }, [])

  const before = useMemo(
    () => summarize(history, config.sportId, preset.soundsPerHit, openedAt),
    [history, config.sportId, preset.soundsPerHit, openedAt],
  )

  const sessionBest = useMemo(() => {
    let best = 0
    for (const r of state.rallies) best = Math.max(best, countHits(r.hits, preset.soundsPerHit))
    return best
  }, [state.rallies, preset.soundsPerHit])

  // Judge each rally as it ends.
  const judged = useRef<Rally | null>(null)
  useEffect(() => {
    const rally = state.lastEnded
    if (!rally || judged.current === rally) return
    judged.current = rally
    const count = countHits(rally.hits, preset.soundsPerHit)
    const earlier = state.rallies.filter((r) => r !== rally)
    let earlierBest = 0
    for (const r of earlier)
      earlierBest = Math.max(earlierBest, countHits(r.hits, preset.soundsPerHit))
    const record = count > Math.max(before.best, earlierBest) && count > 1
    const todayBest = !record && count > Math.max(before.todayBest, earlierBest) && count > 1
    setVerdict({ rally, count, record, todayBest })
    buzz(record ? [40, 60, 40, 60, 120] : [30, 50, 30])
  }, [state.lastEnded, state.rallies, before, preset.soundsPerHit])

  const record = useCallback(
    (endedAt: number | null, rallies: Rally[]): SessionRecord => ({
      id,
      sportId: config.sportId,
      mode: config.mode,
      startedAt,
      endedAt,
      sensors,
      rallies,
      match:
        config.mode === 'match' && preset.scoring
          ? { rules: preset.scoring, firstServer: config.firstServer, names: config.names }
          : null,
    }),
    [id, config, startedAt, sensors, preset.scoring],
  )

  // Persist as rallies complete, so a crash or a closed tab loses at most one rally.
  useEffect(() => {
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
    dispatch({ type: 'hit', hit })
  }, [])

  const finish = useCallback(
    async (extra?: Partial<SessionRecord>): Promise<string | null> => {
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
    verdict: inRally ? null : verdict,
    sensors,
    dispatch,
    tap,
    sense,
    undoHit: () => dispatch({ type: 'undo' }),
    endRally: () => dispatch({ type: 'end', t: now(), reason: 'manual' }),
    point: (side: Side) => {
      setVerdict(null)
      dispatch({ type: 'point', side, t: now() })
      buzz(15)
    },
    undoPoint: () => dispatch({ type: 'undoPoint' }),
    finish,
  }
}
