import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { calibrateThreshold } from '../../engine/onset.ts'
import { SPORTS, sport, type SportId } from '../../engine/sports.ts'
import { primeAudio } from '../../sensors/prime.ts'
import { Count } from '../components/Count.tsx'
import { LevelTrace, type TracePoint } from '../components/LevelTrace.tsx'
import { SensorChips } from '../components/SensorChips.tsx'
import { loadConfig } from '../config.ts'
import { Toggle } from '../components/Toggle.tsx'
import { plural } from '../format.ts'
import { useLatest } from '../hooks/useLatest.ts'
import { useSensitivity } from '../hooks/useSensitivity.ts'
import { useSensors } from '../hooks/useSensors.ts'
import { thresholdToSensitivity } from '../thresholds.ts'

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
  const [heard, setHeard] = useState(0)
  const [rejected, setRejected] = useState(0)
  const [calibration, setCalibration] = useState<Calibration>({ phase: 'idle' })
  const levels = useRef<TracePoint[]>([])
  const onsets = useRef<number[]>([])
  const calibrating = useLatest(calibration)

  useEffect(() => {
    void loadConfig().then((c) => setSportId(c.sportId))
  }, [])

  const preset = sportId ? sport(sportId) : SPORTS[0]!
  const count = (t: number) => {
    onsets.current.push(t)
    if (onsets.current.length > 50) onsets.current.splice(0, onsets.current.length - 50)
    setHeard((n) => n + 1)
  }
  // The mic runs exactly as in a session: the sport's stored threshold and
  // voice filter, fused hits counted. Only calibration reads raw scores.
  const sensors = useSensors({
    enabled: listening,
    preset,
    use: ['audio'],
    levels: true,
    onCandidate: (c) => {
      if (calibrating.current.phase !== 'listening') return
      setCalibration((prev) =>
        prev.phase === 'listening'
          ? { ...prev, scores: [...prev.scores, c.score ?? 0], last: c.t }
          : prev,
      )
      count(c.t)
    },
    onHit: (hit) => {
      if (calibrating.current.phase !== 'listening') count(hit.t)
    },
    onLevel: (l) => {
      const buffer = levels.current
      buffer.push({ t: l.t, flux: l.flux, threshold: l.threshold })
      if (buffer.length > 600) buffer.splice(0, buffer.length - 600)
      setRejected(l.rejected)
    },
  })
  const sens = useSensitivity(preset.id, {
    onChange: ({ threshold, voiceFilter }) => {
      // Calibration keeps listening at its own eager level until it is done.
      if (calibrating.current.phase !== 'listening') sensors.setThreshold(threshold)
      sensors.setVoiceFilter(voiceFilter)
    },
  })

  const finishCalibration = () => {
    const cal = calibrating.current
    if (cal.phase !== 'listening') return
    const value = calibrateThreshold(cal.scores, TEST_HITS)
    if (cal.scores.length < TEST_HITS || value === null) {
      setCalibration({
        phase: 'done',
        good: false,
        message: `Only heard ${cal.scores.length} of ${TEST_HITS}. Move the phone closer, or hit a bit harder, and try again.`,
      })
      if (sens.threshold !== null) sensors.setThreshold(sens.threshold)
      return
    }
    // Still 'listening' here, so the mic is told directly.
    sensors.setThreshold(value)
    void sens.setThreshold(value)
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
      <p className="-mt-4 text-sm text-chalk-dim">Used in every {preset.name} session.</p>

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
                {sens.sensitivity}
              </output>
            </div>
            <input
              id="sensitivity"
              type="range"
              min={0}
              max={100}
              value={sens.sensitivity}
              aria-labelledby="sens-h"
              onChange={(e) => void sens.setSensitivity(Number(e.target.value))}
              className="h-11 w-full"
            />
            <p className="text-sm text-chalk-dim">
              Missing hits? Slide right. Counting footsteps and chatter? Slide left.
            </p>
            <Toggle
              label="Ignore voices"
              hint={`${rejected} ${plural(rejected, 'sound', 'sounds')} ignored as voice`}
              checked={sens.voiceFilter}
              onChange={(on) => void sens.setVoiceFilter(on)}
            />
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
                    sensors.setThreshold(CALIBRATION_THRESHOLD)
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
