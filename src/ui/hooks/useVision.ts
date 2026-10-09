import { useEffect, useState } from 'react'
import type { SportPreset } from '../../engine/sports.ts'
import type { HitCandidate } from '../../engine/types.ts'
import { startVision } from '../../sensors/vision.ts'
import { deriveStatus } from './sensorStatus.ts'
import { useLatest } from './useLatest.ts'
import type { SensorStatus } from './useSensors.ts'

interface Options {
  enabled: boolean
  video: React.RefObject<HTMLVideoElement | null>
  preset: SportPreset
  onCandidate: (candidate: HitCandidate) => void
  onGround: (t: number) => void
}

/** Ball tracking on the camera preview. Loads the model only when enabled. */
export function useVision({
  enabled,
  video,
  preset,
  onCandidate,
  onGround,
}: Options): SensorStatus {
  const [phase, setPhase] = useState<SensorStatus>('off')
  const handlers = useLatest({ onCandidate, onGround })

  useEffect(() => {
    const el = video.current
    if (!enabled || !el) return
    const vision = startVision({
      video: el,
      refractoryMs: preset.refractoryMs,
      onCandidate: (c) => handlers.current.onCandidate(c),
      onGround: (t) => handlers.current.onGround(t),
      onReady: (mode) => {
        // Inspectable without a console: which tracker is actually running.
        document.documentElement.dataset.vision = mode
        setPhase('on')
      },
    })
    return () => {
      vision.stop()
      setPhase('off')
    }
  }, [enabled, video, preset, handlers])

  return deriveStatus(enabled, phase)
}
