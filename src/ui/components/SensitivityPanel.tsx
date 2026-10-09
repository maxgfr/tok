import { useEffect, useRef } from 'react'
import { plural } from '../format.ts'
import { LevelTrace, type TracePoint } from './LevelTrace.tsx'
import { Toggle } from './Toggle.tsx'

interface Props {
  sportName: string
  sensitivity: number
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
        <LevelTrace
          levels={levels}
          onsets={onsets}
          label="Sound level in chalk, threshold in yellow, counted hits in green"
        />
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <label htmlFor="panel-sensitivity" className="font-semibold">
              Sensitivity
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
            Missing hits? Slide right. Counting footsteps and chatter? Slide left.
          </p>
        </div>
        <Toggle
          label="Ignore voices"
          hint={`${rejected} ${plural(rejected, 'sound', 'sounds')} ignored as voice`}
          checked={voiceFilter}
          onChange={onVoiceFilter}
        />
        <div className="grid grid-cols-2 gap-3">
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
      </div>
    </dialog>
  )
}
