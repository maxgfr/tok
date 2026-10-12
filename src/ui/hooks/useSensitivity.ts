import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DEFAULT_THRESHOLD } from '../../engine/onset.ts'
import type { SportId } from '../../engine/sports.ts'
import {
  loadStoredThreshold,
  loadVoiceFilter,
  resetThreshold,
  saveThreshold,
  saveVoiceFilter,
  sensitivityToThreshold,
  thresholdToSensitivity,
} from '../thresholds.ts'

export interface MicSettings {
  threshold: number
  voiceFilter: boolean
}

interface Options {
  /** Called after every change, to push it to a running mic. */
  onChange?: (settings: MicSettings) => void
  /** The threshold the player's own hits call for (engine/toneprint.ts), if known. */
  suggested?: number | null
}

/**
 * The microphone settings of one sport, kept on the device: what a session
 * changes is what the next one of that sport starts with. Until the player
 * moves the slider the threshold is Auto: the one their hits call for, or the
 * default. Default goes back to Auto.
 */
export function useSensitivity(sportId: SportId, { onChange, suggested = null }: Options = {}) {
  // Tagged with its sport: another sport's values never show while this one loads.
  const [loaded, setLoaded] = useState<{
    sportId: SportId
    /** Set by the player; null in Auto. */
    stored: number | null
    voiceFilter: boolean
  } | null>(null)
  const current = loaded?.sportId === sportId ? loaded : null
  const auto = current ? current.stored === null : true
  const threshold = current ? (current.stored ?? suggested ?? DEFAULT_THRESHOLD) : null
  const voiceFilter = current?.voiceFilter ?? true
  const latest = useRef({ threshold: DEFAULT_THRESHOLD, voiceFilter: true, onChange })
  useLayoutEffect(() => {
    latest.current = { threshold: threshold ?? DEFAULT_THRESHOLD, voiceFilter, onChange }
  })

  useEffect(() => {
    let cancelled = false
    void Promise.all([loadStoredThreshold(sportId), loadVoiceFilter(sportId)]).then(([k, on]) => {
      if (!cancelled) setLoaded({ sportId, stored: k, voiceFilter: on })
    })
    return () => {
      cancelled = true
    }
  }, [sportId])

  // In Auto, a newly suggested threshold reaches the running mic.
  const autoThreshold = current && auto && suggested !== null ? suggested : null
  useEffect(() => {
    if (autoThreshold === null) return
    const { onChange: notify, voiceFilter: on } = latest.current
    notify?.({ threshold: autoThreshold, voiceFilter: on })
  }, [autoThreshold])

  const apply = useCallback(
    (next: { stored?: number | null; voiceFilter?: boolean }) => {
      const { onChange: notify, voiceFilter: on } = latest.current
      setLoaded((l) => {
        const base = l?.sportId === sportId ? l : { sportId, stored: null, voiceFilter: on }
        return { ...base, ...next }
      })
      const settings = {
        threshold:
          next.stored === undefined
            ? latest.current.threshold
            : (next.stored ?? suggested ?? DEFAULT_THRESHOLD),
        voiceFilter: next.voiceFilter ?? on,
      }
      latest.current = { ...settings, onChange: notify }
      notify?.(settings)
    },
    [sportId, suggested],
  )

  const setSensitivity = useCallback(
    async (sensitivity: number) => {
      const k = sensitivityToThreshold(sensitivity)
      apply({ stored: k })
      await saveThreshold(sportId, k)
    },
    [apply, sportId],
  )

  const setVoiceFilter = useCallback(
    async (on: boolean) => {
      apply({ voiceFilter: on })
      await saveVoiceFilter(sportId, on)
    },
    [apply, sportId],
  )

  /** Back to Auto; the voice filter is left as it is. */
  const reset = useCallback(async () => {
    apply({ stored: null })
    await resetThreshold(sportId)
  }, [apply, sportId])

  return {
    /** `null` until the sport's settings are loaded. */
    threshold,
    sensitivity: thresholdToSensitivity(threshold ?? DEFAULT_THRESHOLD),
    /** The slider was left alone: the threshold follows the player's hits. */
    auto,
    voiceFilter,
    setSensitivity,
    setVoiceFilter,
    reset,
  }
}
