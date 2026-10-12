import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SportId } from '../../engine/sports.ts'
import type { Rally } from '../../engine/types.ts'
import {
  GUIDED_HITS,
  learn,
  learnable,
  learnGuided,
  steadyRhythm,
  suggestThreshold,
  type Toneprint,
} from '../../engine/toneprint.ts'
import { loadToneFilter, loadToneprint, saveToneFilter, saveToneprint } from '../toneprints.ts'
import type { HeardSound } from './useSensors.ts'

/** "Learn my ball" listens this long for its hits. */
export const LESSON_MS = 10_000

/** How many of the latest sounds keep a steady pace, up to `GUIDED_HITS`. */
function steadyRun(sounds: readonly HeardSound[]): number {
  for (let k = Math.min(GUIDED_HITS, sounds.length); k >= 3; k -= 1) {
    if (steadyRhythm(sounds.slice(-k).map((s) => s.t))) return k
  }
  return Math.min(sounds.length, 2)
}

export interface Lesson {
  /** The latest steady run of hits, out of `GUIDED_HITS`. */
  got: number
  status: 'listening' | 'learned' | 'missed'
}

interface Options {
  /** Different sounds a hit makes: table tennis's paddle and table. */
  soundsPerHit: 1 | 2
  /** Routes the mic's sounds to a lesson instead of the count (useSensors). */
  setLearner: (listen: ((sound: HeardSound) => void) | null) => void
}

/**
 * What tok knows of the player's ball for one sport: learned in passing from
 * surely-real rallies, or on purpose with "Learn my ball", and kept on the
 * device. It also suggests the threshold while the slider is left alone.
 */
export function useToneprint(sportId: SportId, { soundsPerHit, setLearner }: Options) {
  const [loaded, setLoaded] = useState<{
    sportId: SportId
    model: Toneprint | null
    filter: boolean
  } | null>(null)
  const current = loaded?.sportId === sportId ? loaded : null
  const model = current?.model ?? null
  const filter = current?.filter ?? true
  const latest = useRef<Toneprint | null>(null)
  useLayoutEffect(() => {
    latest.current = model
  })

  useEffect(() => {
    let cancelled = false
    void Promise.all([loadToneprint(sportId), loadToneFilter(sportId)]).then(([m, on]) => {
      if (!cancelled) setLoaded({ sportId, model: m, filter: on })
    })
    return () => {
      cancelled = true
    }
  }, [sportId])

  const keep = useCallback(
    (next: Toneprint) => {
      latest.current = next
      setLoaded((l) => ({ sportId, model: next, filter: l?.sportId === sportId ? l.filter : true }))
      void saveToneprint(sportId, next)
    },
    [sportId],
  )

  // The newest rally learned from: an undo can make an older one the last again.
  const taughtUpTo = useRef(-Infinity)

  /**
   * Learns from a rally that just ended, once, if it is surely made of real
   * hits and the mic heard every one of them (`heardAt`: their sounds).
   */
  const learnRally = useCallback(
    (rally: Rally, heardAt: (times: readonly number[]) => HeardSound[]) => {
      if (rally.startedAt <= taughtUpTo.current) return
      taughtUpTo.current = rally.startedAt
      if (!learnable(rally)) return
      const sounds = heardAt(rally.hits.map((h) => h.t))
      // Every hit heard by the mic, or nothing: a hit felt alone has no print.
      if (sounds.length !== rally.hits.length) return
      keep(
        learn(
          latest.current,
          sounds.map((s) => s.print),
          sounds.map((s) => s.score),
          soundsPerHit,
        ),
      )
    },
    [keep, soundsPerHit],
  )

  const setFilter = useCallback(
    (on: boolean) => {
      setLoaded((l) => ({ sportId, model: l?.sportId === sportId ? l.model : null, filter: on }))
      void saveToneFilter(sportId, on)
    },
    [sportId],
  )

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const stopLesson = useRef<(() => void) | null>(null)
  useEffect(() => () => stopLesson.current?.(), [])

  /** "Learn my ball": the next hits, made on purpose, become what tok knows. */
  const startLesson = useCallback(() => {
    stopLesson.current?.()
    const sounds: HeardSound[] = []
    let timer = 0
    const finish = () => {
      window.clearTimeout(timer)
      setLearner(null)
      stopLesson.current = null
      const got = steadyRun(sounds)
      // A stray sound before the hits does not spoil them: the last steady run counts.
      if (got >= GUIDED_HITS) {
        const hits = sounds.slice(-GUIDED_HITS)
        keep(
          learnGuided(
            hits.map((s) => s.print),
            hits.map((s) => s.score),
            soundsPerHit,
          ),
        )
        setLesson({ got, status: 'learned' })
      } else {
        setLesson({ got, status: 'missed' })
      }
    }
    setLesson({ got: 0, status: 'listening' })
    setLearner((sound) => {
      sounds.push(sound)
      const got = steadyRun(sounds)
      if (got >= GUIDED_HITS) finish()
      else setLesson({ got, status: 'listening' })
    })
    timer = window.setTimeout(finish, LESSON_MS)
    stopLesson.current = () => {
      window.clearTimeout(timer)
      setLearner(null)
      stopLesson.current = null
    }
  }, [keep, setLearner, soundsPerHit])

  const cancelLesson = useCallback(() => {
    stopLesson.current?.()
    setLesson(null)
  }, [])

  return {
    model,
    filter,
    setFilter,
    learnRally,
    /** The threshold the player's hits call for; null until enough are known. */
    suggested: suggestThreshold(model),
    lesson,
    startLesson,
    cancelLesson,
  }
}
