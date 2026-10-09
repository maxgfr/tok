import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Download, Play, Share2, Trophy } from 'lucide-react'
import { sport } from '../../engine/sports.ts'
import { chapters, type Chapter } from '../../record/chapters.ts'
import { readVideo } from '../../record/videoStore.ts'
import { chaptersVtt } from '../../record/vtt.ts'
import { getSession, type SessionRecord } from '../../store/db.ts'
import { clock, fmtDate } from '../format.ts'

export function Replay({ id }: { id: string }) {
  const [session, setSession] = useState<SessionRecord | null | undefined>(undefined)
  const [part, setPart] = useState(0)
  const [blob, setBlob] = useState<Blob | null | undefined>(undefined)
  const [message, setMessage] = useState<string | null>(null)
  const [cutting, setCutting] = useState(false)
  // A cut rally waiting for its own tap: the browser only opens the share sheet
  // from a fresh one, and cutting outlasts the tap that asked for it.
  const [clip, setClip] = useState<{ file: File; url: string; label: string } | null>(null)
  useEffect(() => () => (clip ? URL.revokeObjectURL(clip.url) : undefined), [clip])
  const player = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    void getSession(id).then((s) => setSession(s ?? null))
  }, [id])

  const ref = session?.videos?.[part]
  useEffect(() => {
    if (!ref) return
    let alive = true
    void readVideo(ref).then((b) => {
      if (alive) setBlob(b)
    })
    return () => {
      alive = false
    }
  }, [ref])

  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url])

  const marks = useMemo(() => {
    if (!session || !ref) return []
    return chapters(session.rallies, ref.startedAt, sport(session.sportId).soundsPerHit)
  }, [session, ref])

  // Captions name each rally as it plays.
  const captions = useMemo(() => {
    if (!session || marks.length === 0) return null
    const vtt = chaptersVtt(marks, sport(session.sportId).unit)
    return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }))
  }, [session, marks])
  useEffect(() => () => (captions ? URL.revokeObjectURL(captions) : undefined), [captions])

  if (session === undefined) return <main className="flex-1" />
  if (!session || !session.videos?.length) {
    return (
      <main className="safe-x safe-top mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3">
        <h1 className="figures text-4xl font-extrabold">No recording here</h1>
        <p className="text-chalk-dim">
          Turn the camera on during a session to film it with the score burned in.
        </p>
        <a
          href={`#/history/${encodeURIComponent(id)}`}
          className="font-semibold text-chalk underline underline-offset-4"
        >
          Back to the session
        </a>
      </main>
    )
  }

  const preset = sport(session.sportId)
  const best = marks.find((c) => c.best)
  const ext = ref?.mimeType.includes('mp4') ? 'mp4' : 'webm'
  const fileName = `tok-${session.sportId}-${new Date(session.startedAt).toISOString().slice(0, 10)}.${ext}`

  const seek = (seconds: number) => {
    const v = player.current
    if (!v) return
    v.currentTime = seconds
    void v.play()
  }

  const share = async () => {
    if (!blob) return
    const file = new File([blob], fileName, { type: blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `tok — ${preset.name}` })
      } catch {
        // Cancelled by the user.
      }
    } else {
      setMessage('Sharing files is not supported here — use Save instead.')
    }
  }

  /** Cuts one rally into its own MP4, then shares it (or saves it where sharing files is not possible). */
  /** Cuts one rally into its own MP4, ready to share or save. */
  const cutRally = async (c: Chapter) => {
    if (!blob || cutting) return
    setCutting(true)
    setClip(null)
    setMessage('Cutting the clip…')
    try {
      const { exportClip } = await import('../../record/clip.ts')
      const cut = await exportClip(blob, c.start, c.end)
      const name = fileName.replace(/\.(mp4|webm)$/, `-rally-${c.index + 1}.mp4`)
      const file = new File([cut], name, { type: 'video/mp4' })
      setClip({
        file,
        url: URL.createObjectURL(file),
        label: `Rally ${c.index + 1} · ${c.count} ${preset.unit}`,
      })
      setMessage(null)
    } catch {
      setMessage('This rally could not be cut. Share or save the whole video instead.')
    } finally {
      setCutting(false)
    }
  }

  const shareClip = async () => {
    if (!clip) return
    try {
      await navigator.share({ files: [clip.file], title: `tok — ${clip.label}` })
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError')
        setMessage('Sharing did not work here — save the clip instead.')
    }
  }

  return (
    <main className="safe-x safe-top mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 pb-6">
      <header className="flex items-center gap-2 pt-1">
        <a
          href={`#/history/${encodeURIComponent(id)}`}
          aria-label="Back to the session"
          className="grid size-11 place-items-center rounded-lg text-chalk-dim hover:text-chalk"
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </a>
        <div className="flex-1">
          <h1 className="figures text-4xl font-extrabold">Replay</h1>
          <p className="text-sm text-chalk-dim">
            {preset.name} · {fmtDate(session.startedAt)}
          </p>
        </div>
      </header>

      {session.videos.length > 1 && (
        <div role="tablist" aria-label="Recording" className="flex gap-1">
          {session.videos.map((v, i) => (
            <button
              key={v.file}
              type="button"
              role="tab"
              aria-selected={i === part}
              onClick={() => {
                setBlob(undefined)
                setPart(i)
              }}
              className={`min-h-11 rounded-lg px-4 font-semibold ${i === part ? 'bg-chalk text-slate' : 'bg-slate-2 text-chalk-dim'}`}
            >
              Part {i + 1}
            </button>
          ))}
        </div>
      )}

      {blob === null ? (
        <p className="text-side-b">
          This recording could not be read. The browser may have cleared it.
        </p>
      ) : (
        <video
          ref={player}
          src={url ?? undefined}
          controls
          playsInline
          className="aspect-video w-full rounded-lg bg-black"
          aria-label="Session recording"
        >
          <track kind="captions" src={captions ?? undefined} srcLang="en" label="Rallies" default />
        </video>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {best && (
          <>
            <button
              type="button"
              onClick={() => seek(best.start)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-chalk px-4 font-semibold text-slate"
            >
              <Trophy size={20} aria-hidden="true" /> Best rally — {best.count}
            </button>
            <button
              type="button"
              onClick={() => void cutRally(best)}
              disabled={!blob || cutting}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-2 px-4 font-semibold disabled:text-chalk-faint"
            >
              <Share2 size={20} aria-hidden="true" /> Share this rally
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => void share()}
          disabled={!blob}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-2 px-4 font-semibold disabled:text-chalk-faint"
        >
          <Share2 size={20} aria-hidden="true" /> Share
        </button>
        {url && (
          <a
            href={url}
            download={fileName}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-2 px-4 font-semibold text-chalk no-underline"
          >
            <Download size={20} aria-hidden="true" /> Save
          </a>
        )}
      </div>
      {clip && (
        <section aria-label="Rally clip" className="flex flex-wrap items-center gap-2">
          <p className="flex-1 font-semibold">{clip.label} — clip ready</p>
          {navigator.canShare?.({ files: [clip.file] }) && (
            <button
              type="button"
              onClick={() => void shareClip()}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-chalk px-4 font-semibold text-slate"
            >
              <Share2 size={20} aria-hidden="true" /> Share the clip
            </button>
          )}
          <a
            href={clip.url}
            download={clip.file.name}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-slate-2 px-4 font-semibold text-chalk no-underline"
          >
            <Download size={20} aria-hidden="true" /> Save the clip
          </a>
        </section>
      )}
      {message && <output className="text-chalk-dim">{message}</output>}

      <section aria-labelledby="chapters-h" className="flex flex-col gap-2">
        <h2 id="chapters-h" className="text-sm font-semibold text-chalk-dim">
          Rallies in this recording
        </h2>
        {marks.length === 0 ? (
          <p className="text-chalk-dim">No rallies while the camera was rolling.</p>
        ) : (
          <ol className="border-t border-rule">
            {marks.map((c) => (
              <li key={c.index} className="flex border-b border-rule">
                <button
                  type="button"
                  onClick={() => seek(c.start)}
                  aria-label={`Jump to rally ${c.index + 1}, ${c.count} ${preset.unit}, at ${clock(c.start)}`}
                  className="flex min-h-12 flex-1 items-center gap-4 text-left hover:bg-slate-2"
                >
                  <span className="figures w-10 text-xl text-chalk-dim">{c.index + 1}</span>
                  <span
                    className={`figures w-16 text-2xl font-extrabold ${c.best ? 'text-best' : ''}`}
                  >
                    {c.count}
                  </span>
                  <span className="text-chalk-dim">{preset.unit}</span>
                  <span className="figures ml-auto pr-2 text-lg text-chalk-dim">
                    <Play size={14} className="mr-1 inline" aria-hidden="true" />
                    {clock(c.start)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void cutRally(c)}
                  disabled={!blob || cutting}
                  aria-label={`Share rally ${c.index + 1}`}
                  className="grid size-12 shrink-0 place-items-center border-l border-rule text-chalk-dim hover:bg-slate-2 hover:text-chalk disabled:text-chalk-faint"
                >
                  <Share2 size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}
