import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { calibrateThreshold } from '../../engine/onset.ts'
import { SPORTS, sport, type SportId } from '../../engine/sports.ts'
import { primeAudio } from '../../sensors/audio.ts'
import { Count } from '../components/Count.tsx'
import { LevelTrace, type TracePoint } from '../components/LevelTrace.tsx'
import { SensorChips } from '../components/SensorChips.tsx'
import { loadConfig } from '../config.ts'
import { useSensors, type ScoredCandidate } from '../hooks/useSensors.ts'
import {
  loadThreshold,
  saveThreshold,
  sensitivityToThreshold,
  thresholdToSensitivity,
} from '../thresholds.ts'

const TEST_HITS = 10
/** Calibration listens far more eagerly than play, then sets the bar. */
const CALIBRATION_THRESHOLD = 3
const QUIET_AFTER_MS = 2500

type Calibration =
  | { phase: 'idle' }
  | { phase: 'listening'; scores: number[]; last: number | null }
  | { phase: 'done'; message: string; good: boolean }

export function Lab() {
  const [sportId, setSportId] = useState<SportId | null>(null)
  const [listening, setListening] = useState(false)
  const [threshold, setThreshold] = useState<number | null>(null)
  const [heard, setHeard] = useState(0)
  const [calibration, setCalibration] = useState<Calibration>({ phase: 'idle' })
  const levels = useRef<TracePoint[]>([])
  const onsets = useRef<number[]>([])
  const calibrating = useRef<Calibration>(calibration)
  useLayoutEffect(() => {
    calibrating.current = calibration
  })

  useEffect(() => {
    void loadConfig().then((c) => setSportId(c.sportId))
  }, [])
  useEffect(() => {
    if (sportId) void loadThreshold(sportId).then(setThreshold)
  }, [sportId])

  const preset = sportId ? sport(sportId) : SPORTS[0]!
  const onCandidate = (c: ScoredCandidate) => {
    const cal = calibrating.current
    if (cal.phase === 'listening') {
      setCalibration((prev) =>
        prev.phase === 'listening'
          ? { ...prev, scores: [...prev.scores, c.score ?? 0], last: c.t }
          : prev,
      )
      onsets.current.push(c.t)
      setHeard((n) => n + 1)
      return
    }
    if (threshold !== null && (c.score ?? Infinity) < threshold) return
    onsets.current.push(c.t)
    setHeard((n) => n + 1)
  }
  const sensors = useSensors({
    enabled: listening && threshold !== null,
    preset,
    // The worklet listens at the calibration level; play-level filtering
    // happens above, so the slider moves the bar without restarting the mic.
    threshold: CALIBRATION_THRESHOLD,
    use: ['audio'],
    onCandidate,
    onLevel: (l) => {
      // Draw the bar the player set, not the eager one calibration listens at.
      const buffer = levels.current
      const bar = threshold ?? CALIBRATION_THRESHOLD
      buffer.push({ t: l.t, flux: l.flux, threshold: l.median + bar * l.spread })
      if (buffer.length > 600) buffer.splice(0, buffer.length - 600)
    },
  })

  const finishCalibration = () => {
    const cal = calibrating.current
    if (cal.phase !== 'listening' || !sportId) return
    const value = calibrateThreshold(cal.scores, TEST_HITS)
    if (cal.scores.length < TEST_HITS || value === null) {
      setCalibration({
        phase: 'done',
        good: false,
        message: `Only heard ${cal.scores.length} of ${TEST_HITS}. Move the phone closer, or hit a bit harder, and try again.`,
      })
      return
    }
    setThreshold(value)
    void saveThreshold(sportId, value)
    setCalibration({
      phase: 'done',
      good: true,
      message: `Tuned to your ${TEST_HITS} hits — sensitivity ${thresholdToSensitivity(value)}. Go play!`,
    })
  }

  // Calibration ends after a quiet spell once enough hits were heard.
  useEffect(() => {
    if (calibration.phase !== 'listening' || calibration.last === null) return
    if (calibration.scores.length < TEST_HITS) return
    const timer = window.setTimeout(() => finishCalibration(), QUIET_AFTER_MS)
    return () => window.clearTimeout(timer)
  })

  const listen = () => {
    primeAudio()
    setListening(true)
  }

  const sensitivity = threshold === null ? 50 : thresholdToSensitivity(threshold)

  return (
    <main className="safe-x safe-top mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 pb-6">
      <header className="flex items-end justify-between gap-3 pt-2">
        <h1 className="figures text-5xl font-extrabold">Lab</h1>
        <SensorChips status={sensors.status} />
      </header>
      <p className="text-chalk-dim">
        See what tok hears, and tune it to your paddles, your ball and your spot. Settings are kept
        per sport.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-chalk-dim">Sport</span>
        <select
          value={preset.id}
          onChange={(e) => setSportId(e.target.value as SportId)}
          className="min-h-12 rounded-lg border border-rule bg-slate-2 px-3 text-lg text-chalk"
        >
          {SPORTS.filter((s) => s.weights.audio > 0).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {!listening ? (
        <button
          type="button"
          onClick={listen}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-chalk text-lg font-semibold text-slate"
        >
          <Mic size={22} aria-hidden="true" /> Start listening
        </button>
      ) : (
        <>
          <section aria-label="What tok hears" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">What it hears</h2>
              <p className="figures text-2xl font-extrabold">
                {heard}{' '}
                <span className="font-sans text-base font-semibold text-chalk-dim">hits heard</span>
              </p>
            </div>
            <LevelTrace
              levels={levels}
              onsets={onsets}
              label="Sound level in chalk, threshold in yellow, detected hits in green"
            />
            <p className="text-sm text-chalk-dim">
              Chalk: the sound. Yellow: the bar a hit has to clear. Green: a hit.
            </p>
          </section>

          <section aria-labelledby="sens-h" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 id="sens-h" className="text-xl font-semibold">
                Sensitivity
              </h2>
              <output htmlFor="sensitivity" className="figures text-3xl font-extrabold">
                {sensitivity}
              </output>
            </div>
            <input
              id="sensitivity"
              type="range"
              min={0}
              max={100}
              value={sensitivity}
              aria-labelledby="sens-h"
              onChange={(e) => {
                const value = sensitivityToThreshold(Number(e.target.value))
                setThreshold(value)
                if (sportId) void saveThreshold(sportId, value)
              }}
              className="h-11 w-full"
            />
            <p className="text-sm text-chalk-dim">
              Missing hits? Slide right. Counting footsteps and chatter? Slide left.
            </p>
          </section>

          <section aria-labelledby="cal-h" className="flex flex-col gap-3">
            <h2 id="cal-h" className="text-xl font-semibold">
              Tune it in ten hits
            </h2>
            {calibration.phase === 'listening' ? (
              <div className="flex items-center gap-6">
                <Count
                  value={calibration.scores.length}
                  className="text-8xl"
                  label={`${calibration.scores.length} hits heard`}
                />
                <div className="flex flex-col gap-2">
                  <p className="text-chalk-dim">
                    Hit the ball {TEST_HITS} times, then let it be quiet.
                  </p>
                  <button
                    type="button"
                    onClick={finishCalibration}
                    className="min-h-11 self-start rounded-lg bg-slate-2 px-4 font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {calibration.phase === 'done' && (
                  <output className={calibration.good ? 'text-best' : 'text-side-b'}>
                    {calibration.message}
                  </output>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onsets.current = []
                    setHeard(0)
                    setCalibration({ phase: 'listening', scores: [], last: null })
                  }}
                  className="min-h-12 self-start rounded-xl bg-chalk px-5 font-semibold text-slate"
                >
                  Make {TEST_HITS} hits
                </button>
              </>
            )}
          </section>
        </>
      )}
    </main>
  )
}
