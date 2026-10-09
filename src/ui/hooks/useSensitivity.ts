import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DEFAULT_THRESHOLD } from '../../engine/onset.ts'
import type { SportId } from '../../engine/sports.ts'
import {
  loadThreshold,
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
}

/**
 * The microphone settings of one sport, as the Lab and a live session both
 * see them: what one changes, the other counts with.
 */
export function useSensitivity(sportId: SportId, { onChange }: Options = {}) {
  // Tagged with its sport: another sport's values never show while this one loads.
  const [loaded, setLoaded] = useState<(MicSettings & { sportId: SportId }) | null>(null)
  const current = loaded?.sportId === sportId ? loaded : null
  const threshold = current?.threshold ?? null
  const voiceFilter = current?.voiceFilter ?? true
  const latest = useRef({ threshold: DEFAULT_THRESHOLD, voiceFilter: true, onChange })
  useLayoutEffect(() => {
    latest.current = { threshold: threshold ?? DEFAULT_THRESHOLD, voiceFilter, onChange }
  })

  useEffect(() => {
    let cancelled = false
    void Promise.all([loadThreshold(sportId), loadVoiceFilter(sportId)]).then(([k, on]) => {
      if (!cancelled) setLoaded({ sportId, threshold: k, voiceFilter: on })
    })
    return () => {
      cancelled = true
    }
  }, [sportId])

  const apply = useCallback(
    (next: Partial<MicSettings>) => {
      const { onChange: notify, ...before } = latest.current
      const settings = { ...before, ...next }
      latest.current = { ...settings, onChange: notify }
      setLoaded({ sportId, ...settings })
      notify?.(settings)
    },
    [sportId],
  )

  const setSensitivity = useCallback(
    async (sensitivity: number) => {
      const k = sensitivityToThreshold(sensitivity)
      apply({ threshold: k })
      await saveThreshold(sportId, k)
    },
    [apply, sportId],
  )

  /** An exact threshold, as calibration finds it. */
  const setThreshold = useCallback(
    async (k: number) => {
      apply({ threshold: k })
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

  /** Back to the default threshold; the voice filter is left as it is. */
  const reset = useCallback(async () => {
    apply({ threshold: DEFAULT_THRESHOLD })
    await resetThreshold(sportId)
  }, [apply, sportId])

  return {
    /** `null` until the sport's settings are loaded. */
    threshold,
    sensitivity: thresholdToSensitivity(threshold ?? DEFAULT_THRESHOLD),
    voiceFilter,
    setSensitivity,
    setThreshold,
    setVoiceFilter,
    reset,
  }
}
