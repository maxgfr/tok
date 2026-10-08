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
import { fmtBytes } from '../format.ts'

export function Settings() {
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

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
    setMessage(`Saved ${data.sessions.length} sessions to a file.`)
  }

  const doImport = async (file: File) => {
    try {
      const { sessions } = await importAll(JSON.parse(await file.text()))
      setMessage(`Restored ${sessions} sessions.`)
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
            <p className="figures text-lg text-chalk-dim">
              {fmtBytes(estimate.usage)} used of {fmtBytes(estimate.quota)} available
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
