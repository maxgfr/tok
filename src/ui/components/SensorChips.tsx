import { Hand, Mic, MicOff } from 'lucide-react'
import type { Sensors } from '../hooks/useSensors.ts'

const MIC_TEXT = {
  off: '',
  starting: 'Mic…',
  on: 'Listening',
  blocked: 'Mic blocked',
  unavailable: 'No mic',
} as const

/** What is counting right now, at a glance. */
export function SensorChips({ status }: { status: Sensors['status'] }) {
  const mic = status.audio
  return (
    <ul className="flex items-center gap-1.5" aria-label="Counting with">
      {mic && mic !== 'off' && (
        <li
          className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold ${
            mic === 'on'
              ? 'bg-live/15 text-live'
              : mic === 'starting'
                ? 'bg-slate-2 text-chalk-dim'
                : 'bg-side-b/15 text-side-b'
          }`}
        >
          {mic === 'on' || mic === 'starting' ? (
            <Mic size={16} aria-hidden="true" />
          ) : (
            <MicOff size={16} aria-hidden="true" />
          )}
          {MIC_TEXT[mic]}
        </li>
      )}
      <li className="flex h-8 items-center gap-1.5 rounded-full bg-slate-2 px-2.5 text-sm font-semibold text-chalk-dim">
        <Hand size={16} aria-hidden="true" /> Tap
      </li>
    </ul>
  )
}
