import { useCallback, useEffect, useRef, useState } from 'react'
import { startRecording, type Recording } from '../../record/recorder.ts'
import type { OverlayState } from '../../record/overlay.ts'
import { startCamera } from '../../sensors/camera.ts'
import type { VideoRef } from '../../store/db.ts'
import { deriveStatus, failure } from './sensorStatus.ts'
import { useLatest } from './useLatest.ts'

export type CameraStatus = 'off' | 'starting' | 'on' | 'recording' | 'blocked' | 'unavailable'

interface Options {
  enabled: boolean
  /** File name stem for the recordings (the session id). */
  name: string
  /** The score to burn in; each new object repaints the plate. */
  overlay: OverlayState
  audioTrack: () => MediaStreamTrack | null
}

/**
 * Camera preview plus continuous recording with the score burned in. Recording
 * starts as soon as frames flow; switching the camera off closes that part, and
 * `stop()` at session end closes the last one and returns them all.
 */
export function useCamera({ enabled, name, overlay, audioTrack }: Options) {
  const video = useRef<HTMLVideoElement>(null)
  // Only async outcomes are stored; 'starting' is derived while enabled.
  const [phase, setPhase] = useState<CameraStatus>('off')
  const status: CameraStatus = deriveStatus(enabled, phase)
  const recording = useRef<Recording | null>(null)
  const parts = useRef<Promise<VideoRef | null>[]>([])
  // Every start gets a fresh file name, even if an earlier part was cancelled.
  const partNumber = useRef(0)
  const opts = useLatest({ overlay, audioTrack, name })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let stream: MediaStream | null = null
    const el = video.current
    // The same array for the whole hook: parts accumulate across camera toggles.
    const done = parts.current
    void (async () => {
      try {
        stream = await startCamera()
        if (cancelled || !el) {
          // Switched off (or unmounted) while the camera was starting.
          for (const track of stream.getTracks()) track.stop()
          return
        }
        el.srcObject = stream
        await el.play()
        setPhase('on')
        const rec = await startRecording({
          video: el,
          audioTrack: opts.current.audioTrack(),
          overlay: () => opts.current.overlay,
          name: `${opts.current.name}-${(partNumber.current += 1)}`,
        })
        if (cancelled) {
          // Keep the part: stop() resolves to its file, or null when empty.
          if (rec) done.push(rec.stop())
          return
        }
        recording.current = rec
        if (rec) setPhase('recording')
      } catch (error) {
        if (cancelled) return
        setPhase(failure(error))
      }
    })()
    return () => {
      cancelled = true
      const rec = recording.current
      if (rec) {
        done.push(rec.stop())
        recording.current = null
      }
      for (const track of stream?.getTracks() ?? []) track.stop()
      if (el) el.srcObject = null
      setPhase('off')
    }
  }, [enabled, opts])

  /** Stops recording (if any) and resolves to every saved part. */
  const stop = async (): Promise<VideoRef[]> => {
    if (recording.current) {
      parts.current.push(recording.current.stop())
      recording.current = null
    }
    const saved = await Promise.all(parts.current)
    return saved.filter((v): v is VideoRef => v !== null)
  }

  /** A rally is starting: the recording puts a key frame there. */
  const markRally = useCallback(() => recording.current?.markRally(), [])

  return { video, status, stop, markRally }
}
