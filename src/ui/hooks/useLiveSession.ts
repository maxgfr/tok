import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { initialLive, liveStep, matchPoints, type LiveAction } from '../../engine/live.ts'
import type { RallyConfig } from '../../engine/rally.ts'
import { replay, type MatchView, type ScoringRules, type Side } from '../../engine/scoring/index.ts'
import { sport, type SportPreset } from '../../engine/sports.ts'
import { judgeRally } from '../../engine/judge.ts'
import { countHits, rallyCount, summarize, type SessionLike } from '../../engine/stats.ts'
import type { Hit, Rally, SensorKind } from '../../engine/types.ts'
import { buzz } from '../../device/haptics.ts'
import {
  asSessionLike,
  deleteSession,
  listSummaries,
  saveSession,
  type SessionRecord,
  type VideoRef,
} from '../../store/db.ts'
import { loadAutoEnd, loadGoal } from '../coach.ts'
import { loadRules } from '../sportSettings.ts'
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
  /** A sensor heard one hit and waits for a second before opening a rally. */
  armed: boolean
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
  /** Ends the session and forgets it: nothing of it stays in History. */
  discard: () => Promise<void>
  /** A recording started: saved with the session from now on, so a crash keeps it. */
  addVideo: (ref: VideoRef) => void
  /** The last save failed (storage full, private mode): what was played may not be kept. */
  saveFailed: boolean
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
  // The match rules the player set for this sport (Settings), else the official ones.
  // The score is replayed from the points, so rules that load a moment late still apply.
  const [rules, setRules] = useState<ScoringRules | null>(preset.scoring)
  useEffect(() => {
    void loadRules(config.sportId).then(setRules)
  }, [config.sportId])
  const rallyConfig = useMemo<RallyConfig>(
    () => ({
      // 0: rallies end only when the player says so.
      timeoutMs: autoEnd * 1000,
      refractoryMs: preset.refractoryMs,
      // Taps are deliberate; a lone sensor blip is noise. In a match an ace is real.
      minHits: config.mode === 'match' || config.input === 'manual' ? 1 : 2,
      confirmMs: preset.maxGapMs,
      // Table tennis has two sounds per hit, one quick after the other.
      rhythmGuard: preset.soundsPerHit === 1,
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
  // Every earlier session: null until loaded, and no verdict before then (a
  // record judged against nothing is a false "New record").
  const [earlier, setEarlier] = useState<SessionLike[] | null>(null)
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
    // Summaries: a few numbers per session, not every hit of every rally.
    void listSummaries().then((all) => {
      if (alive) setEarlier(all.filter((s) => s.id !== id).map(asSessionLike))
    })
    return () => {
      alive = false
    }
  }, [id])

  // A rally ends when the player says so (End rally, a point, a remote button).
  // Only if they turned on "end rallies on their own" does a timer, set for
  // the moment the silence gets that long, end it for them. A lone sensor hit
  // waiting for a second one always gets a timer: unconfirmed, it is dropped.
  const { phase } = state.rally
  const lastHitAt = state.rally.hits.at(-1)?.t
  const { timeoutMs, confirmMs } = rallyConfig
  const deadline =
    lastHitAt === undefined
      ? undefined
      : phase === 'armed'
        ? lastHitAt + confirmMs
        : phase === 'rally' && autoEnd > 0
          ? lastHitAt + timeoutMs
          : undefined
  useEffect(() => {
    if (deadline === undefined) return
    let timer = 0
    const arm = () => {
      const wait = Math.max(20, deadline - now() + 20)
      timer = window.setTimeout(() => {
        dispatch({ type: 'tick', t: now() })
        // Still open (the clock moved back): look again.
        arm()
      }, wait)
    }
    arm()
    return () => window.clearTimeout(timer)
  }, [deadline])

  // Best ever and best of the day, this session included, with "today" the
  // day the last rally ended: a session can run past midnight.
  const standing = useMemo(() => {
    const session = { sportId: config.sportId, startedAt, rallies: state.rallies }
    const at = state.lastEnded?.endedAt ?? startedAt
    return summarize([...(earlier ?? []), session], config.sportId, preset.soundsPerHit, at)
  }, [earlier, state.rallies, state.lastEnded, config.sportId, startedAt, preset.soundsPerHit])

  // Judge each rally as it ends, against everything before it, once history is in.
  const judged = useRef<Rally | null>(null)
  useEffect(() => {
    const rally = state.lastEnded
    if (!rally || !earlier || judged.current === rally) return
    judged.current = rally
    const count = rallyCount(rally, preset.soundsPerHit)
    const others = state.rallies.filter((r) => r !== rally)
    const session = { sportId: config.sportId, startedAt, rallies: others }
    const prior = summarize(
      [...earlier, session],
      config.sportId,
      preset.soundsPerHit,
      rally.endedAt,
    )
    const judgement = judgeRally(count, {
      best: prior.best,
      todayBest: prior.todayBest,
      // Already in the two above.
      sessionBest: 0,
      goal,
    })
    setVerdict({ rally, count, ...judgement })
    buzz(judgement.record || judgement.goal ? [40, 60, 40, 60, 120] : [30, 50, 30])
  }, [
    state.lastEnded,
    state.rallies,
    earlier,
    config.sportId,
    startedAt,
    preset.soundsPerHit,
    goal,
  ])

  // Recordings being made: the session points to their files while they are written.
  const [videos, setVideos] = useState<VideoRef[]>([])
  const addVideo = useCallback((ref: VideoRef) => setVideos((v) => [...v, ref]), [])
  const [saveFailed, setSaveFailed] = useState(false)

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
        config.mode === 'match' && rules
          ? { rules, firstServer: config.firstServer, names: config.names }
          : null,
      ...(videos.length ? { videos } : {}),
    }),
    [id, config, startedAt, stableSensors, rules, videos],
  )

  // Persist as rallies complete, so a crash or a closed tab loses at most one rally.
  useEffect(() => {
    if (finishing.current) return
    if (state.rallies.length === 0 && !savedOnce.current) return
    savedOnce.current = true
    saveSession(record(null, state.rallies)).then(
      () => setSaveFailed(false),
      () => setSaveFailed(true),
    )
  }, [state.rallies, record])

  const inRally = state.rally.phase === 'rally'
  // The last verdict goes once the next rally opens, not on its first sound:
  // a lone sound may never become a rally. Gone before that rally ends, it
  // cannot be called again in its place.
  if (inRally && verdict) setVerdict(null)
  const current = inRally ? state.rally.hits : (state.lastEnded?.hits ?? [])
  const count = countHits(current, preset.soundsPerHit)

  const match = useMemo(
    () =>
      config.mode === 'match' && rules
        ? replay(rules, matchPoints(state.rallies), config.firstServer)
        : null,
    [config.mode, config.firstServer, rules, state.rallies],
  )

  const tap = useCallback(() => {
    const hit: Hit = { t: now(), sources: ['manual'], confidence: 1 }
    setVerdict(null)
    dispatch({ type: 'hit', hit })
    buzz(8)
  }, [])

  const sense = useCallback((hit: Hit) => {
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
      // The recordings as they ended are the final word: none left means none.
      const { videos: final, ...rest } = extra ?? {}
      const session = { ...record(Date.now(), rallies), ...rest }
      if (final) {
        if (final.length) session.videos = final
        else delete session.videos
      }
      try {
        await saveSession(session)
      } catch (error) {
        // Not saved: the session stays open, so End can be tried again.
        finishing.current = false
        setSaveFailed(true)
        throw error
      }
      return id
    },
    [state, rallyConfig, record, id],
  )

  const discard = useCallback(async () => {
    // From here on nothing is written; what was saved rally by rally goes too.
    finishing.current = true
    await deleteSession(id)
  }, [id])

  return {
    preset,
    id,
    count,
    inRally,
    armed: phase === 'armed',
    rallies: state.rallies,
    match,
    awaitingWinner: config.mode === 'match' && state.awaitingWinner,
    best: standing.best,
    todayBest: standing.todayBest,
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
      // The match is over: a remote button gives no more points.
      if (match?.winner) return
      setVerdict(null)
      dispatch({ type: 'point', side, t: now() })
      buzz(15)
    },
    undoPoint: () => dispatch({ type: 'undoPoint' }),
    finish,
    discard,
    addVideo,
    saveFailed,
  }
}
