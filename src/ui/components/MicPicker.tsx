import { useEffect, useId, useState } from 'react'
import { listMicrophones, type Microphone } from '../micDevice.ts'

/** Which microphone Auto listens with; `''` is the system default. */
export function MicPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const id = useId()
  const [mics, setMics] = useState<Microphone[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void listMicrophones().then(setMics, () => setMics([]))
  }, [])

  if (!mics) return null
  const hidden = mics.some((m) => !m.named)
  // A chosen mic that is not plugged in right now still shows, so the choice is not lost.
  const missing = value && !mics.some((m) => m.id === value)

  const ask = () => {
    listMicrophones({ ask: true }).then(setMics, () =>
      setMessage('The browser did not allow the microphone, so their names stay hidden.'),
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        Microphone
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 rounded-lg border border-rule bg-slate-2 px-3 text-lg text-chalk"
      >
        <option value="">System default</option>
        {mics.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
        {missing && <option value={value}>Chosen microphone (not plugged in)</option>}
      </select>
      <span className="text-sm text-chalk-dim">
        Auto listens with it. A headset or a clip-on mic near play hears hits best.
      </span>
      {hidden && (
        <button
          type="button"
          onClick={ask}
          className="min-h-11 self-start rounded-lg px-3 font-semibold text-chalk-dim hover:text-chalk"
        >
          Show microphone names
        </button>
      )}
      {message && <output className="text-sm text-side-b">{message}</output>}
    </div>
  )
}
