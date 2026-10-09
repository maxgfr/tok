import { useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import {
  clearAll,
  exportAll,
  importAll,
  requestPersistence,
  storageEstimate,
} from '../../store/db.ts'
import { clearVideos } from '../../record/videoStore.ts'
import { SPORTS, type SportId } from '../../engine/sports.ts'
import { canSpeak } from '../../device/speech.ts'
import { MicPicker } from '../components/MicPicker.tsx'
import { Toggle } from '../components/Toggle.tsx'
import {
  loadAutoEnd,
  loadCoach,
  loadGoal,
  saveAutoEnd,
  saveCoach,
  saveGoal,
  type CoachSettings,
} from '../coach.ts'
import { fmtBytes, plural } from '../format.ts'
import { loadMicDevice, saveMicDevice } from '../micDevice.ts'

export function Settings() {
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [coach, setCoach] = useState<CoachSettings | null>(null)
  const [goalSport, setGoalSport] = useState<SportId>('table-tennis')
  const [goal, setGoal] = useState(0)
  const [voiceAvailable, setVoiceAvailable] = useState(canSpeak)
  const [mic, setMic] = useState('')
  const [autoEnd, setAutoEnd] = useState(0)
  useEffect(() => {
    void loadMicDevice().then(setMic)
    void loadAutoEnd().then(setAutoEnd)
  }, [])
  useEffect(() => {
    // Voices arrive asynchronously in some browsers.
    const synth = globalThis.speechSynthesis
    if (!synth?.addEventListener) return
    const update = () => setVoiceAvailable(canSpeak())
    synth.addEventListener('voiceschanged', update)
    return () => synth.removeEventListener('voiceschanged', update)
  }, [])

  useEffect(() => {
    void loadCoach().then(setCoach)
  }, [])
  useEffect(() => {
    void loadGoal(goalSport).then(setGoal)
  }, [goalSport])

  const updateCoach = (patch: Partial<CoachSettings>) => {
    if (!coach) return
    setCoach({ ...coach, ...patch })
    void saveCoach(patch)
  }

  const refresh = () => {
    void storageEstimate().then(setEstimate)
    void navigator.storage?.persisted?.().then(setPersisted)
  }
  useEffect(refresh, [])

  const doExport = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tok-backup-${data.exportedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage(
      `Saved ${data.sessions.length} ${plural(data.sessions.length, 'session', 'sessions')} to a file.`,
    )
  }

  const doImport = async (file: File) => {
    try {
      const { sessions, skipped } = await importAll(JSON.parse(await file.text()))
      setMessage(
        `Restored ${sessions} ${plural(sessions, 'session', 'sessions')}.${skipped ? ` Skipped ${skipped} this version cannot read.` : ''}`,
      )
      refresh()
    } catch (error) {
      setMessage(
        error instanceof SyntaxError ? 'That file is not valid JSON.' : (error as Error).message,
      )
    }
  }

  const wipe = async () => {
    await Promise.all([clearAll(), clearVideos()])
    setConfirmWipe(false)
    setMessage('Everything is wiped. Fresh board.')
    refresh()
  }

  const share = estimate && estimate.quota ? estimate.usage / estimate.quota : 0

  return (
    <main className="safe-x safe-top mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 pb-6">
      <h1 className="figures pt-2 text-5xl font-extrabold">Settings</h1>

      <section aria-labelledby="counting-h" className="flex flex-col gap-3">
        <h2 id="counting-h" className="text-xl font-semibold">
          Counting
        </h2>
        <Toggle
          label="Sounds"
          hint="A click for each hit, a chime when a rally ends. Auto never counts them."
          checked={coach?.sounds ?? true}
          disabled={!coach}
          onChange={(sounds) => updateCoach({ sounds })}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="auto-end" className="font-semibold">
            End a rally on its own
          </label>
          <select
            id="auto-end"
            value={autoEnd}
            onChange={(e) => {
              const seconds = Number(e.target.value)
              setAutoEnd(seconds)
              void saveAutoEnd(seconds)
            }}
            className="min-h-12 rounded-lg border border-rule bg-slate-2 px-3 text-lg text-chalk"
          >
            <option value={0}>Never — I end each rally</option>
            <option value={3}>After 3 s without a hit</option>
            <option value={5}>After 5 s without a hit</option>
            <option value={8}>After 8 s without a hit</option>
          </select>
          <span className="text-sm text-chalk-dim">
            End rally, a point, or the earbuds always end it too.
          </span>
        </div>
        <MicPicker
          value={mic}
          onChange={(id) => {
            setMic(id)
            void saveMicDevice(id)
          }}
        />
      </section>

      <section aria-labelledby="coach-h" className="flex flex-col gap-3">
        <h2 id="coach-h" className="text-xl font-semibold">
          Coach
        </h2>
        <Toggle
          label="Call it out loud"
          hint={
            voiceAvailable
              ? 'Each rally’s count, or the score after every point.'
              : 'No on-device voice here — tok won’t use one that sends text away.'
          }
          checked={!!coach?.voice}
          disabled={!coach || !voiceAvailable}
          onChange={(voice) => updateCoach({ voice })}
        />
        <Toggle
          label="Earbuds as a clicker"
          hint="Count with your hands free. Rally: play = +1, next = end rally, previous = undo. Match: next = point A, previous = point B, play = undo. Works with most Bluetooth earbuds and remotes; a few browsers keep the buttons to themselves."
          checked={!!coach?.remote}
          disabled={!coach}
          onChange={(remote) => updateCoach({ remote })}
        />
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Goal</span>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <label className="sr-only" htmlFor="goal-sport">
              Sport
            </label>
            <select
              id="goal-sport"
              value={goalSport}
              onChange={(e) => setGoalSport(e.target.value as SportId)}
              className="min-h-12 rounded-lg border border-rule bg-slate-2 px-3 text-chalk"
            >
              {SPORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="goal-value">
              Goal in one rally
            </label>
            <input
              id="goal-value"
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              placeholder="None"
              value={goal || ''}
              onChange={(e) => {
                const value = Math.max(0, Math.min(9999, Math.round(Number(e.target.value) || 0)))
                setGoal(value)
                void saveGoal(goalSport, value)
              }}
              className="figures min-h-12 rounded-lg border border-rule bg-slate-2 px-3 text-right text-2xl text-chalk placeholder:text-chalk-faint"
            />
          </div>
          <span className="text-sm text-chalk-dim">
            One rally to reach. The board cheers the first time each day.
          </span>
        </div>
      </section>

      <section aria-labelledby="backup-h" className="flex flex-col gap-3">
        <h2 id="backup-h" className="text-xl font-semibold">
          Backup
        </h2>
        <p className="text-chalk-dim">
          Your sessions live only on this device. Keep a copy, or move them to another phone.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void doExport()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-chalk font-semibold text-slate"
          >
            <Download size={20} aria-hidden="true" /> Export
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-2 font-semibold"
          >
            <Upload size={20} aria-hidden="true" /> Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void doImport(file)
              e.target.value = ''
            }}
          />
        </div>
        {message && <output className="text-best">{message}</output>}
      </section>

      <section aria-labelledby="storage-h" className="flex flex-col gap-3">
        <h2 id="storage-h" className="text-xl font-semibold">
          Storage
        </h2>
        {estimate ? (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-slate-3" aria-hidden="true">
              <div
                className="h-full rounded-full bg-chalk"
                style={{ width: `${Math.max(1, share * 100)}%` }}
              />
            </div>
            <p className="text-chalk-dim">
              <span className="figures text-xl text-chalk">{fmtBytes(estimate.usage)}</span> used of{' '}
              {fmtBytes(estimate.quota)} available
            </p>
          </>
        ) : (
          <p className="text-chalk-dim">This browser does not report storage use.</p>
        )}
        {persisted === false && (
          <button
            type="button"
            onClick={() => void requestPersistence().then(setPersisted)}
            className="min-h-12 self-start rounded-xl bg-slate-2 px-4 font-semibold"
          >
            Protect from automatic cleanup
          </button>
        )}
        {persisted && (
          <p className="text-chalk-dim">
            Protected: the browser will not clear your sessions to free space.
          </p>
        )}
      </section>

      <section aria-labelledby="danger-h" className="flex flex-col gap-3">
        <h2 id="danger-h" className="text-xl font-semibold">
          Start over
        </h2>
        {confirmWipe ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmWipe(false)}
              className="min-h-12 rounded-xl px-4 font-semibold text-chalk-dim"
            >
              Keep everything
            </button>
            <button
              type="button"
              onClick={() => void wipe()}
              className="min-h-12 rounded-xl bg-side-b px-4 font-semibold text-slate"
            >
              Delete all sessions, videos and settings
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmWipe(true)}
            className="min-h-12 self-start rounded-xl bg-slate-2 px-4 font-semibold hover:text-side-b"
          >
            Delete everything…
          </button>
        )}
      </section>

      <footer className="mt-auto text-sm text-chalk-dim">
        tok works offline and never sends anything anywhere.{' '}
        <a
          href="https://github.com/maxgfr/tok"
          className="text-chalk underline decoration-rule underline-offset-4 hover:decoration-chalk"
        >
          Read the source
        </a>
        .
      </footer>
    </main>
  )
}
