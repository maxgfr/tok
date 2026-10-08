import { Activity, Mic, MicOff } from 'lucide-react'
import type { SensorStatus, Sensors } from '../hooks/useSensors.ts'

const TEXT: Record<'audio' | 'motion', Record<SensorStatus, string>> = {
  audio: {
    off: '',
    starting: 'Mic…',
    on: 'Listening',
    blocked: 'Mic blocked',
    unavailable: 'No mic',
  },
  motion: {
    off: '',
    starting: 'Motion…',
    on: 'Motion',
    blocked: 'Motion blocked',
    unavailable: 'No motion',
  },
}

const tone = (s: SensorStatus) =>
  s === 'on'
    ? 'bg-live/15 text-live'
    : s === 'starting'
      ? 'bg-slate-2 text-chalk-dim'
      : 'bg-side-b/15 text-side-b'

/** Which sensors are counting right now, at a glance. Taps always count. */
export function SensorChips({ status }: { status: Sensors['status'] }) {
  const chips = (['audio', 'motion'] as const).filter((k) => status[k] && status[k] !== 'off')
  return (
    <ul className="flex items-center gap-1.5" aria-label="Counting with">
      {chips.map((kind) => {
        const s = status[kind]!
        const Icon =
          kind === 'motion' ? Activity : s === 'blocked' || s === 'unavailable' ? MicOff : Mic
        // A missing accelerometer on a laptop is not news; only show it when it works.
        if (kind === 'motion' && s === 'unavailable') return null
        return (
          <li
            key={kind}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold ${tone(s)}`}
          >
            <Icon size={16} aria-hidden="true" />
            {/* Icon-only on narrow phones: the colour carries the state, the label stays for screen readers. */}
            <span className="max-[460px]:sr-only">{TEXT[kind][s]}</span>
          </li>
        )
      })}
    </ul>
  )
}
