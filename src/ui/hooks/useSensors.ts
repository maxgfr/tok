import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Fusion } from '../../engine/fusion.ts'
import type { AutoSensor, SportPreset } from '../../engine/sports.ts'
import type { Hit, HitCandidate, SensorKind } from '../../engine/types.ts'
import { startAudio, type AudioSensor, type TimedLevel } from '../../sensors/audio.ts'
import { startMotion } from '../../sensors/motion.ts'
import { isSpeaking } from '../../device/speech.ts'
import { loadThreshold } from '../thresholds.ts'

export type SensorStatus = 'off' | 'starting' | 'on' | 'blocked' | 'unavailable'

export interface Sensors {
  status: Partial<Record<AutoSensor, SensorStatus>>
  /** Sources currently feeding hits, `manual` always included. */
  active: SensorKind[]
}

export type ScoredCandidate = HitCandidate & { score?: number }

interface Options {
  enabled: boolean
  preset: SportPreset
  /** Fused hits — what a session counts. */
  onHit?: (hit: Hit) => void
  /** Raw candidates before fusion (Lab). */
  onCandidate?: (candidate: ScoredCandidate) => void
  onLevel?: (level: TimedLevel) => void
  /** Overrides the stored per-sport audio threshold (Lab). */
  threshold?: number
  /** Which sensors to try; defaults to every sensor the sport trusts. */
  use?: AutoSensor[]
}

const failure = (error: unknown): SensorStatus => {
  const name = (error as DOMException | undefined)?.name
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : 'unavailable'
}

/** Starts the sensors a session uses, fuses their candidates, reports what runs. */
export function useSensors({
  enabled,
  preset,
  onHit,
  onCandidate,
  onLevel,
  threshold,
  use,
}: Options) {
  const [audio, setAudio] = useState<SensorStatus>('off')
  const [motion, setMotion] = useState<SensorStatus>('off')
  const handlers = useRef({ onHit, onCandidate, onLevel })
  useLayoutEffect(() => {
    handlers.current = { onHit, onCandidate, onLevel }
  })
  const audioSensor = useRef<AudioSensor | null>(null)
  const wanted = use ?? (['audio', 'motion'] as AutoSensor[])
  const wantAudio = enabled && wanted.includes('audio') && preset.weights.audio > 0
  const wantMotion = enabled && wanted.includes('motion') && preset.weights.motion > 0

  const fusion = useRef<Fusion | null>(null)
  useEffect(() => {
    fusion.current = new Fusion({ weights: preset.weights })
  }, [preset])

  const feed = (candidate: ScoredCandidate) => {
    // tok's own voice is not a hit.
    if (candidate.source === 'audio' && isSpeaking()) return
    handlers.current.onCandidate?.(candidate)
    const hit = fusion.current?.push(candidate)
    if (hit) handlers.current.onHit?.(hit)
  }
  const feedRef = useRef(feed)
  useLayoutEffect(() => {
    feedRef.current = feed
  })

  useEffect(() => {
    if (!wantAudio) return
    let cancelled = false
    setAudio('starting')
    void (async () => {
      try {
        const k = threshold ?? (await loadThreshold(preset.id))
        const started = await startAudio({
          bandHz: preset.bandHz,
          refractoryMs: preset.refractoryMs,
          threshold: k,
          onCandidate: (c) => feedRef.current(c),
          onLevel: (l) => handlers.current.onLevel?.(l),
        })
        if (cancelled) started.stop()
        else {
          audioSensor.current = started
          setAudio('on')
        }
      } catch (error) {
        if (!cancelled) setAudio(failure(error))
      }
    })()
    return () => {
      cancelled = true
      audioSensor.current?.stop()
      audioSensor.current = null
      setAudio('off')
    }
    // The threshold is pushed live through setThreshold, not by restarting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAudio, preset])

  useEffect(() => {
    if (!wantMotion) return
    let cancelled = false
    let sensor: { stop: () => void } | null = null
    setMotion('starting')
    void startMotion({
      refractoryMs: preset.refractoryMs,
      onCandidate: (c) => {
        if (!cancelled) {
          setMotion('on')
          feedRef.current(c)
        }
      },
      onSilent: () => {
        if (!cancelled) setMotion('unavailable')
      },
    }).then(
      (s) => {
        if (cancelled) s.stop()
        else {
          sensor = s
          setMotion((m) => (m === 'starting' ? 'on' : m))
        }
      },
      (error: unknown) => {
        if (!cancelled) setMotion(failure(error))
      },
    )
    return () => {
      cancelled = true
      sensor?.stop()
      setMotion('off')
    }
  }, [wantMotion, preset])

  const active: SensorKind[] = ['manual']
  if (audio === 'on') active.push('audio')
  if (motion === 'on') active.push('motion')
  const status: Sensors['status'] = {}
  if (wantAudio) status.audio = audio
  if (wantMotion) status.motion = motion
  return {
    status,
    active,
    setThreshold: (value: number) => audioSensor.current?.setThreshold(value),
    audioTrack: () => audioSensor.current?.track ?? null,
    /** Feeds a candidate from another sensor (vision) into the same fusion. */
    feed: (candidate: ScoredCandidate) => feedRef.current(candidate),
  }
}
