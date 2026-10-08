import { useEffect, useState } from 'react'
import { ArrowLeft, Film, Trash2 } from 'lucide-react'
import { matchPoints } from '../../engine/live.ts'
import { replay } from '../../engine/scoring/index.ts'
import { sport } from '../../engine/sports.ts'
import { countHits, tempo } from '../../engine/stats.ts'
import { deleteVideo } from '../../record/videoStore.ts'
import { deleteSession, getSession, type SessionRecord } from '../../store/db.ts'
import { RallyBars } from '../components/RallyBars.tsx'
import { fmtDate, fmtDuration, fmtTime, plural } from '../format.ts'
import { go } from '../router.ts'

export function SessionDetail({ id }: { id: string }) {
  const [session, setSession] = useState<SessionRecord | null | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    void getSession(id).then((s) => setSession(s ?? null))
  }, [id])

  if (session === undefined) return <main className="flex-1" />
  if (session === null) {
    return (
      <main className="safe-x safe-top mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3">
        <h1 className="figures text-4xl font-extrabold">This session is gone</h1>
        <p className="text-chalk-dim">It was deleted, or it belongs to another device.</p>
        <a href="#/history" className="font-semibold text-chalk">
          Back to history
        </a>
      </main>
    )
  }

  const preset = sport(session.sportId)
  const counts = session.rallies.map((r) => countHits(r.hits, preset.soundsPerHit))
  const hitRallies = session.rallies.filter((r) => r.hits.length > 0)
  const best = Math.max(0, ...counts)
  const total = counts.reduce((a, b) => a + b, 0)
  const span =
    (session.endedAt ?? session.rallies.at(-1)?.endedAt ?? session.startedAt) - session.startedAt
  const match =
    session.match && preset.scoring
      ? replay(session.match.rules, matchPoints(session.rallies), session.match.firstServer)
      : null

  const remove = async () => {
    await Promise.all((session.videos ?? []).map(deleteVideo))
    await deleteSession(session.id)
    go('/history')
  }

  return (
    <main className="safe-x safe-top mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 pb-6">
      <header className="flex items-center gap-2 pt-1">
        <a
          href="#/history"
          aria-label="Back to history"
          className="grid size-11 place-items-center rounded-lg text-chalk-dim hover:text-chalk"
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </a>
        <div className="flex-1">
          <h1 className="figures text-4xl font-extrabold">{preset.name}</h1>
          <p className="text-sm text-chalk-dim">
            {fmtDate(session.startedAt)} · {fmtTime(session.startedAt)} · {fmtDuration(span)}
          </p>
        </div>
      </header>

      {match && session.match && (
        <section aria-label="Final score" className="flex flex-col gap-1">
          <p className="figures flex items-baseline gap-4 text-6xl font-extrabold">
            <span className="text-side-a">{match.setsWon.A}</span>
            <span className="text-3xl text-chalk-faint">–</span>
            <span className="text-side-b">{match.setsWon.B}</span>
          </p>
          <p className="text-lg">
            <span className="text-side-a">{session.match.names.A}</span> vs{' '}
            <span className="text-side-b">{session.match.names.B}</span>
            {match.winner ? ` · ${session.match.names[match.winner]} won` : ' · unfinished'}
          </p>
          {match.sets.length > 0 && (
            <p className="figures text-2xl text-chalk-dim">
              {match.sets.map((s) => `${s.A}–${s.B}`).join('   ')}
            </p>
          )}
        </section>
      )}

      <p className="text-lg text-chalk-dim">
        <strong className="figures text-3xl font-extrabold text-best">{best}</strong> best ·{' '}
        <strong className="figures text-2xl font-semibold text-chalk">{counts.length}</strong>{' '}
        {plural(counts.length, 'rally', 'rallies')} ·{' '}
        <strong className="figures text-2xl font-semibold text-chalk">{total}</strong> {preset.unit}{' '}
        in all
      </p>

      {session.videos?.length ? (
        <a
          href={`#/replay/${encodeURIComponent(session.id)}`}
          className="flex min-h-12 items-center gap-2 self-start rounded-xl bg-chalk px-4 font-semibold text-slate no-underline"
        >
          <Film size={20} aria-hidden="true" /> Watch the replay
        </a>
      ) : null}

      {hitRallies.length > 0 && <RallyBars counts={counts} label="Each rally, in order" />}

      <section aria-labelledby="rallies-h" className="flex flex-col gap-2">
        <h2 id="rallies-h" className="text-sm font-semibold text-chalk-dim">
          Rallies
        </h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-rule text-xs text-chalk-dim">
              <th scope="col" className="py-2 pr-2 font-semibold">
                #
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">
                {preset.unit}
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">
                Length
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">
                Per min
              </th>
              {match && (
                <th scope="col" className="py-2 text-right font-semibold">
                  Point
                </th>
              )}
            </tr>
          </thead>
          <tbody className="figures text-xl">
            {session.rallies.map((r, i) => {
              const pace = tempo(r)
              return (
                <tr key={r.startedAt} className="border-b border-rule">
                  <td className="py-2 pr-2 text-chalk-dim">{i + 1}</td>
                  <td
                    className={`pr-2 text-right font-extrabold ${counts[i] === best && best > 0 ? 'text-best' : ''}`}
                  >
                    {counts[i]}
                  </td>
                  <td className="pr-2 text-right text-chalk-dim">
                    {fmtDuration(r.endedAt - r.startedAt)}
                  </td>
                  <td className="pr-2 text-right text-chalk-dim">
                    {pace ? Math.round(pace) : '—'}
                  </td>
                  {match && session.match && (
                    <td
                      className={`text-right ${r.winner === 'A' ? 'text-side-a' : r.winner === 'B' ? 'text-side-b' : 'text-chalk-faint'}`}
                    >
                      {r.winner ? session.match.names[r.winner] : '—'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <div className="mt-auto flex justify-end gap-2 pt-4">
        {confirmDelete ? (
          <>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-11 rounded-lg px-4 font-semibold text-chalk-dim"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              className="min-h-11 rounded-lg bg-side-b px-4 font-semibold text-slate"
            >
              Delete for good
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-chalk-dim hover:text-side-b"
          >
            <Trash2 size={18} aria-hidden="true" /> Delete session
          </button>
        )}
      </div>
    </main>
  )
}
