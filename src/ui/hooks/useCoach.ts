import { useEffect, useRef, useState } from 'react'
import { matchPhrase, rallyPhrase } from '../../device/phrases.ts'
import { startRemote } from '../../device/remote.ts'
import { hitSound, rallyEndSound } from '../../device/sounds.ts'
import { speak } from '../../device/speech.ts'
import { matchPoints } from '../../engine/live.ts'
import { loadCoach, type CoachSettings } from '../coach.ts'
import type { LiveConfig } from '../config.ts'
import { useLatest } from './useLatest.ts'
import type { LiveSession } from './useLiveSession.ts'

/** The coach's voice and the optional Bluetooth remote, for one live session. */
export function useCoach(config: LiveConfig, session: LiveSession): void {
  const [coach, setCoach] = useState<CoachSettings | null>(null)
  useEffect(() => {
    void loadCoach().then(setCoach)
  }, [])

  const latest = useLatest(session)

  // Rally mode: call each finished rally.
  const { verdict, count, inRally } = session

  // Sounds: a click for each hit counted, a chime when a rally ends.
  const heard = useRef({ count, inRally })
  useEffect(() => {
    const before = heard.current
    heard.current = { count, inRally }
    if (coach?.sounds && inRally && (!before.inRally || count > before.count)) hitSound()
  }, [count, inRally, coach?.sounds])
  useEffect(() => {
    if (!coach?.sounds || !verdict) return
    rallyEndSound(verdict.record || verdict.todayBest || !!verdict.goal)
  }, [verdict, coach?.sounds])

  useEffect(() => {
    if (!coach?.voice || !verdict || config.mode !== 'rally') return
    speak(rallyPhrase(verdict, latest.current.todayBest))
  }, [verdict, coach?.voice, config.mode, latest])

  // Match mode: call the score after every point.
  const points = matchPoints(session.rallies).length
  useEffect(() => {
    const { match, preset } = latest.current
    if (!coach?.voice || !match || !preset.scoring || points === 0) return
    speak(matchPhrase(match, config.names, preset.scoring))
  }, [points, coach?.voice, config.names, latest])

  // Earbuds / remote: play-pause, next, previous.
  useEffect(() => {
    if (!coach?.remote) return
    const match = config.mode === 'match'
    const remote = startRemote(
      {
        playPause: () => (match ? latest.current.undoPoint() : latest.current.tap()),
        next: () => (match ? latest.current.point('A') : latest.current.endRally()),
        previous: () => (match ? latest.current.point('B') : latest.current.undoHit()),
      },
      `tok — ${latest.current.preset.name}`,
    )
    return remote.stop
  }, [coach?.remote, config.mode, latest])
}
