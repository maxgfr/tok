import { useEffect, useMemo, useRef, useState } from 'react'
import { Fusion } from '../../engine/fusion.ts'
import type { AutoSensor, SportPreset } from '../../engine/sports.ts'
import type { Hit, HitCandidate, SensorKind } from '../../engine/types.ts'
import { startAudio, type AudioSensor, type TimedLevel } from '../../sensors/audio.ts'
import { startMotion } from '../../sensors/motion.ts'
import { isSelfNoise, maskNoise } from '../../device/selfNoise.ts'
import { loadMicDevice, saveMicDevice } from '../micDevice.ts'
import { loadThreshold, loadVoiceFilter } from '../thresholds.ts'
import { failure } from './sensorStatus.ts'
import { useLatest } from './useLatest.ts'

export type SensorStatus = 'off' | 'starting' | 'on' | 'blocked' | 'unavailable'

/** How long the mic is ignored as it opens or comes back. */
const MIC_SETTLE_MS = 1000

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
  /** The mic level trace, while `setLevels(true)`. */
  onLevel?: (level: TimedLevel) => void
}

/** Starts the sensors a session uses, fuses their candidates, reports what runs. */
export function useSensors({ enabled, preset, onHit, onLevel }: Options) {
  const [audio, setAudio] = useState<SensorStatus>('off')
  const [motion, setMotion] = useState<SensorStatus>('off')
  const handlers = useLatest({ onHit, onLevel })
  const audioSensor = useRef<AudioSensor | null>(null)
  // Bumped when the player picks another microphone: the mic restarts on it.
  const [micChanges, setMicChanges] = useState(0)
  // Settings changed before the mic is up are applied when it starts.
  const pushed = useRef<{ threshold?: number; voiceFilter?: boolean; levels?: boolean }>({})
  useEffect(
    () => () => {
      // Another sport has its own stored settings.
      delete pushed.current.threshold
      delete pushed.current.voiceFilter
    },
    [preset],
  )
  const wantAudio = enabled && preset.weights.audio > 0
  const wantMotion = enabled && preset.weights.motion > 0

  const fusion = useRef<Fusion | null>(null)
  useEffect(() => {
    fusion.current = new Fusion({ weights: preset.weights })
  }, [preset])
  // The camera's tracker runs in another hook; it reports here (setVision).
  const vision = useRef<SensorStatus>('off')

  const feed = (candidate: ScoredCandidate) => {
    // tok's own voice, sounds and buzz, and a finger on the screen, are not hits.
    if (candidate.source !== 'manual' && isSelfNoise(candidate.t, candidate.source)) return
    const f = fusion.current
    if (!f) return
    // While the sport's main sensor runs, every hit must include it.
    const { dominant } = preset
    const main = dominant === 'audio' ? audio : dominant === 'motion' ? motion : vision.current
    f.required = main === 'on' ? dominant : null
    const hit = f.push(candidate)
    if (hit) handlers.current.onHit?.(hit)
  }
  const feedRef = useLatest(feed)

  useEffect(() => {
    if (!wantAudio) return
    let cancelled = false
    setAudio('starting')
    const openedAt = Date.now()
    let hearing = true
    void (async () => {
      try {
        const [storedThreshold, storedVoiceFilter] = await Promise.all([
          loadThreshold(preset.id),
          loadVoiceFilter(preset.id),
        ])
        const deviceId = await loadMicDevice()
        const started = await startAudio({
          deviceId,
          bandHz: preset.bandHz,
          refractoryMs: preset.refractoryMs,
          threshold: pushed.current.threshold ?? storedThreshold,
          voiceFilter: pushed.current.voiceFilter ?? storedVoiceFilter,
          levels: pushed.current.levels ?? false,
          onCandidate: (c) => feedRef.current(c),
          onLevel: (l) => handlers.current.onLevel?.(l),
          onHealth: (now) => {
            if (cancelled) return
            if (now && !hearing) {
              // Nor is the one as it comes back.
              const at = Date.now()
              maskNoise(at, at + MIC_SETTLE_MS, ['audio'])
            }
            hearing = now
            setAudio(now ? 'on' : 'starting')
          },
          // The track is gone: open the mic again, as for another microphone.
          onLost: () => {
            if (!cancelled) setMicChanges((n) => n + 1)
          },
        })
        if (cancelled) started.stop()
        else {
          // The mic's pop as it opens is not a hit.
          maskNoise(openedAt, Date.now() + MIC_SETTLE_MS, ['audio'])
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
    // The threshold is pushed live through setThreshold, not by restarting;
    // another microphone does restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAudio, preset, micChanges])

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
  }, [wantMotion, preset, feedRef])

  // Only refs inside: the same functions on every render, safe in effect deps.
  const controls = useMemo(
    () => ({
      setThreshold: (value: number) => {
        pushed.current.threshold = value
        audioSensor.current?.setThreshold(value)
      },
      setVoiceFilter: (on: boolean) => {
        pushed.current.voiceFilter = on
        audioSensor.current?.setVoiceFilter(on)
      },
      /** Level trace on while something draws it: no messages otherwise. */
      setLevels: (on: boolean) => {
        pushed.current.levels = on
        audioSensor.current?.setLevels(on)
      },
      /** Listens with another microphone from now on ('' = system default). */
      setMicDevice: async (id: string) => {
        await saveMicDevice(id)
        setMicChanges((n) => n + 1)
      },
      audioTrack: () => audioSensor.current?.track ?? null,
      /** What the camera's tracker is doing: when it is the sport's main sensor, hits need it. */
      setVision: (status: SensorStatus) => {
        vision.current = status
      },
      /** Feeds a candidate from another sensor (vision) into the same fusion. */
      feed: (candidate: ScoredCandidate) => feedRef.current(candidate),
    }),
    [feedRef],
  )

  const active: SensorKind[] = ['manual']
  if (audio === 'on') active.push('audio')
  if (motion === 'on') active.push('motion')
  const status: Sensors['status'] = {}
  if (wantAudio) status.audio = audio
  if (wantMotion) status.motion = motion
  return { status, active, ...controls }
}
