import { useEffect, useRef } from 'react'
import { GUIDED_HITS, MIN_EXAMPLES } from '../../engine/toneprint.ts'
import { plural } from '../format.ts'
import type { Lesson } from '../hooks/useToneprint.ts'
import { LevelTrace, type TracePoint } from './LevelTrace.tsx'
import { MicPicker } from './MicPicker.tsx'
import { Toggle } from './Toggle.tsx'

interface Props {
  sportName: string
  sensitivity: number
  /** The slider was left alone: the threshold follows the player's hits. */
  auto?: boolean
  voiceFilter: boolean
  /** Mutable buffers owned by the caller, as for `LevelTrace`. */
  levels: React.RefObject<TracePoint[]>
  onsets: React.RefObject<number[]>
  /** Sounds the voice filter has set aside since the mic opened. */
  rejected: number
  onSensitivity: (sensitivity: number) => void
  onVoiceFilter: (on: boolean) => void
  onReset: () => void
  onClose: () => void
  micDevice: string
  onMicDevice: (id: string) => void
  /** Leave Auto: count by hand for the rest of the session. */
  onManual: () => void
  /** Whether sounds unlike the player's ball are set aside. */
  toneFilter?: boolean
  onToneFilter?: (on: boolean) => void
  /** Hits of the player's ball learned so far. */
  known?: number
  /** Sounds set aside since the mic opened because they are not the ball. */
  notYours?: number
  lesson?: Lesson | null
  onLearn?: () => void
  onSaveTape?: () => void
}

/**
 * The mic settings of the sport being played, as a sheet over the session:
 * what tok hears, how eagerly it counts, and whether voices are kept out.
 */
export function SensitivityPanel({
  sportName,
  sensitivity,
  voiceFilter,
  levels,
  onsets,
  rejected,
  onSensitivity,
  onVoiceFilter,
  onReset,
  onClose,
  micDevice,
  onMicDevice,
  onManual,
  auto = false,
  toneFilter = true,
  onToneFilter,
  known = 0,
  notYours = 0,
  lesson = null,
  onLearn,
  onSaveTape,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)

  // Modal: the session behind it does not take a stray +1.
  useEffect(() => {
    const el = dialog.current
    if (el && !el.open) {
      if (typeof el.showModal === 'function') el.showModal()
      else el.setAttribute('open', '')
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="sens-panel-h"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="safe-x fixed inset-x-0 top-auto bottom-0 m-0 mx-auto w-full max-w-2xl border-0 border-t border-rule bg-slate p-0 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-chalk backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4">
        <h2 id="sens-panel-h" className="text-xl font-semibold">
          Sensitivity · {sportName}
        </h2>
        <p className="-mt-2 text-sm text-chalk-dim">
          Auto is experimental: it can miss hits or hear extra ones. Tap to add one, Undo to remove
          one, or count by hand.
        </p>
        <LevelTrace
          levels={levels}
          onsets={onsets}
          label="Sound level in chalk, threshold in yellow, counted hits in green"
        />
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <label htmlFor="panel-sensitivity" className="font-semibold">
              Sensitivity
              {auto && (
                <span className="ml-2 rounded-full bg-slate-2 px-2 py-0.5 text-sm text-chalk-dim">
                  Auto
                </span>
              )}
            </label>
            <output htmlFor="panel-sensitivity" className="figures text-3xl font-extrabold">
              {sensitivity}
            </output>
          </div>
          <input
            id="panel-sensitivity"
            type="range"
            min={0}
            max={100}
            value={sensitivity}
            onChange={(e) => onSensitivity(Number(e.target.value))}
            className="h-11 w-full"
          />
          <p className="text-sm text-chalk-dim">
            {auto
              ? 'Auto: set from your own hits. Slide to take over; Default goes back to Auto.'
              : 'Missing hits? Slide right. Counting footsteps and chatter? Slide left.'}
          </p>
        </div>
        <Toggle
          label="Ignore voices"
          hint={`${rejected} ${plural(rejected, 'sound', 'sounds')} ignored as voice`}
          checked={voiceFilter}
          onChange={onVoiceFilter}
        />
        {onToneFilter && (
          <Toggle
            label="Only my ball"
            hint={
              known >= MIN_EXAMPLES
                ? `Not your ball: ${notYours}`
                : `Learning your ball: ${known} of ${MIN_EXAMPLES} hits`
            }
            checked={toneFilter}
            onChange={onToneFilter}
          />
        )}
        {onLearn && <LearnBall lesson={lesson} onLearn={onLearn} />}
        <MicPicker value={micDevice} onChange={onMicDevice} />
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onManual}
            className="min-h-12 rounded-xl bg-slate-2 px-3 font-semibold"
          >
            Switch to manual
          </button>
          <button
            type="button"
            onClick={onReset}
            className="min-h-12 rounded-xl bg-slate-2 px-4 font-semibold"
          >
            Default
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-xl bg-chalk px-4 font-semibold text-slate"
          >
            Done
          </button>
        </div>
        {onSaveTape && (
          <button
            type="button"
            onClick={onSaveTape}
            className="min-h-11 self-start text-sm font-semibold text-chalk-dim underline underline-offset-4 hover:text-chalk"
          >
            Save last 20 s (sound + what tok heard)
          </button>
        )}
      </div>
    </dialog>
  )
}

const LESSON_TEXT: Record<Lesson['status'], (got: number) => string> = {
  listening: () => `Hit the ball ${GUIDED_HITS} times, at your usual pace`,
  learned: () => 'Got it: tok knows your ball',
  missed: (got) => `Heard ${got} of ${GUIDED_HITS} steady hits. Try again?`,
}

/** "Learn my ball": a few hits on purpose, and tok knows the sound to count. */
function LearnBall({ lesson, onLearn }: { lesson: Lesson | null; onLearn: () => void }) {
  const listening = lesson?.status === 'listening'
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-1 flex-col gap-1">
        <span className="font-semibold">Learn my ball</span>
        <span className="text-sm text-chalk-dim" aria-live="polite">
          {lesson ? LESSON_TEXT[lesson.status](lesson.got) : 'Teach tok the sound of your hits'}
        </span>
        {listening && (
          <ol className="flex gap-1.5" aria-label={`${lesson.got} of ${GUIDED_HITS} hits heard`}>
            {Array.from({ length: GUIDED_HITS }, (_, i) => (
              <li
                key={i}
                className={`size-3 rounded-full ${i < lesson.got ? 'bg-live' : 'bg-slate-3'}`}
              />
            ))}
          </ol>
        )}
      </div>
      <button
        type="button"
        onClick={onLearn}
        disabled={listening}
        className="min-h-12 shrink-0 rounded-xl bg-slate-2 px-4 font-semibold disabled:text-chalk-faint"
      >
        {lesson?.status === 'learned' ? 'Again' : listening ? 'Listening…' : 'Learn'}
      </button>
    </div>
  )
}
