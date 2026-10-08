import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SportPreset } from '../../engine/sports.ts'
import type { HitCandidate, SensorKind } from '../../engine/types.ts'
import { startAudio, type TimedLevel } from '../../sensors/audio.ts'
import { loadThreshold } from '../thresholds.ts'

export type SensorStatus = 'off' | 'starting' | 'on' | 'blocked' | 'unavailable'

export interface Sensors {
  status: Partial<Record<Exclude<SensorKind, 'manual'>, SensorStatus>>
  /** Sources currently feeding hits, `manual` always included. */
  active: SensorKind[]
}

interface Options {
  enabled: boolean
  preset: SportPreset
  onCandidate: (candidate: HitCandidate) => void
  onLevel?: (level: TimedLevel) => void
  /** Overrides the stored per-sport threshold (Lab). */
  threshold?: number
}

/** Starts the sensors a session uses and reports what is actually running. */
export function useSensors({
  enabled,
  preset,
  onCandidate,
  onLevel,
  threshold,
}: Options): Sensors & {
  setThreshold: (value: number) => void
} {
  const [audio, setAudio] = useState<SensorStatus>('off')
  const handlers = useRef({ onCandidate, onLevel })
  useLayoutEffect(() => {
    handlers.current = { onCandidate, onLevel }
  })
  const sensor = useRef<{ setThreshold: (v: number) => void; stop: () => void } | null>(null)

  useEffect(() => {
    if (!enabled || preset.weights.audio === 0) return
    let cancelled = false
    setAudio('starting')
    void (async () => {
      try {
        const k = threshold ?? (await loadThreshold(preset.id))
        const started = await startAudio({
          bandHz: preset.bandHz,
          refractoryMs: preset.refractoryMs,
          threshold: k,
          onCandidate: (c) => handlers.current.onCandidate(c),
          onLevel: (l) => handlers.current.onLevel?.(l),
        })
        if (cancelled) started.stop()
        else {
          sensor.current = started
          setAudio('on')
        }
      } catch (error) {
        if (cancelled) return
        const name = (error as DOMException).name
        setAudio(name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : 'unavailable')
      }
    })()
    return () => {
      cancelled = true
      sensor.current?.stop()
      sensor.current = null
      setAudio('off')
    }
    // The threshold is pushed live through setThreshold, not by restarting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, preset])

  const active: SensorKind[] = ['manual']
  if (audio === 'on') active.push('audio')
  return {
    status: enabled ? { audio } : {},
    active,
    setThreshold: (value) => sensor.current?.setThreshold(value),
  }
}
