import { Activity, ChevronDown, Eye, EyeOff, Mic, MicOff } from 'lucide-react'
import type { AutoSensor } from '../../engine/sports.ts'
import type { SensorStatus, Sensors } from '../hooks/useSensors.ts'

const TEXT: Record<AutoSensor, Record<SensorStatus, string>> = {
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
  vision: {
    off: '',
    starting: 'Ball…',
    on: 'Tracking',
    blocked: 'Camera blocked',
    unavailable: 'No tracking',
  },
}

const tone = (s: SensorStatus) =>
  s === 'on'
    ? 'bg-live/15 text-live'
    : s === 'starting'
      ? 'bg-slate-2 text-chalk-dim'
      : 'bg-side-b/15 text-side-b'

/** Which sensors are counting right now, at a glance. Taps always count. */
export function SensorChips({
  status,
  dominant,
  onAudio,
}: {
  status: Sensors['status']
  /** The sport's main sensor: only its failures are worth a chip. */
  dominant?: AutoSensor
  /** Makes the mic chip a button that opens the sensitivity settings. */
  onAudio?: () => void
}) {
  const chips = (['audio', 'motion', 'vision'] as const).filter(
    (k) => status[k] && status[k] !== 'off',
  )
  return (
    <ul className="flex items-center gap-1.5" aria-label="Counting with">
      {chips.map((kind) => {
        const s = status[kind]!
        const down = s === 'blocked' || s === 'unavailable'
        const Icon =
          kind === 'motion'
            ? Activity
            : kind === 'vision'
              ? down
                ? EyeOff
                : Eye
              : down
                ? MicOff
                : Mic
        // A secondary sensor that cannot run is not news (a laptop has no
        // accelerometer); the main one failing is.
        if ((s === 'blocked' || s === 'unavailable') && kind !== (dominant ?? 'audio')) return null
        const chip = `flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold ${tone(s)}`
        const content = (
          <>
            <Icon size={16} aria-hidden="true" />
            {/* Icon-only on narrow phones: the colour carries the state, the label stays for screen readers. */}
            <span className="max-[460px]:sr-only">{TEXT[kind][s]}</span>
          </>
        )
        if (kind === 'audio' && onAudio) {
          return (
            <li key={kind}>
              <button
                type="button"
                aria-label="Microphone sensitivity"
                onClick={onAudio}
                // The pill stays 32px; the hit area grows to 44px around it.
                className={`relative ${chip} before:absolute before:-inset-1.5 before:content-['']`}
              >
                {content}
                <ChevronDown size={14} aria-hidden="true" className="-mr-1" />
              </button>
            </li>
          )
        }
        return (
          <li key={kind} className={chip}>
            {content}
          </li>
        )
      })}
    </ul>
  )
}
