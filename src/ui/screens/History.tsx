import { useEffect, useMemo, useState } from 'react'
import { SPORTS, sport, type SportId } from '../../engine/sports.ts'
import { countHits, dailySeries, summarize } from '../../engine/stats.ts'
import { listSessions, type SessionRecord } from '../../store/db.ts'
import { DayChart } from '../components/DayChart.tsx'
import { fmtDate, fmtTime, plural } from '../format.ts'

export function History() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null)
  const [filter, setFilter] = useState<SportId | null>(null)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    void listSessions().then(setSessions)
  }, [])

  const sports = useMemo(
    () => SPORTS.filter((s) => sessions?.some((x) => x.sportId === s.id)),
    [sessions],
  )
  const active = filter ?? sports[0]?.id ?? null

  if (!sessions) return <main className="flex-1" />

  if (sessions.length === 0) {
    return (
      <main className="safe-x safe-top mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3">
        <h1 className="figures text-5xl font-extrabold">Nothing on the board yet</h1>
        <p className="text-lg text-chalk-dim">
          Play a session and every rally lands here — your best, your average, your streaks.
        </p>
        <a
          href="#/"
          className="mt-4 self-start rounded-xl bg-chalk px-5 py-3 font-semibold text-slate no-underline"
        >
          Start playing
        </a>
      </main>
    )
  }

  const preset = active ? sport(active) : null
  const mine = sessions.filter((s) => s.sportId === active)
  const summary = preset ? summarize(mine, preset.id, preset.soundsPerHit, now) : null
  const series = preset ? dailySeries(mine, preset.id, preset.soundsPerHit) : []

  return (
    <main className="safe-x safe-top mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 pb-6">
      <h1 className="figures pt-2 text-5xl font-extrabold">History</h1>

      {sports.length > 1 && (
        <div
          role="tablist"
          aria-label="Sport"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
        >
          {sports.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === active}
              onClick={() => setFilter(s.id)}
              className={`min-h-11 shrink-0 rounded-lg px-4 font-semibold ${
                s.id === active
                  ? 'bg-chalk text-slate'
                  : 'bg-slate-2 text-chalk-dim hover:text-chalk'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {summary && preset && (
        <section aria-label={`${preset.name} progress`} className="flex flex-col gap-4">
          <p className="text-lg text-chalk-dim">
            Record{' '}
            <strong className="figures text-3xl font-extrabold text-best">{summary.best}</strong>{' '}
            {preset.unit} · average{' '}
            <strong className="figures text-2xl font-semibold text-chalk">
              {summary.average.toFixed(1)}
            </strong>{' '}
            over{' '}
            <strong className="figures text-2xl font-semibold text-chalk">{summary.rallies}</strong>{' '}
            {plural(summary.rallies, 'rally', 'rallies')}
          </p>
          <DayChart points={series} />
        </section>
      )}

      <section aria-labelledby="sessions-h" className="flex flex-col gap-2">
        <h2 id="sessions-h" className="text-sm font-semibold text-chalk-dim">
          Sessions
        </h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-rule text-xs text-chalk-dim">
              <th scope="col" className="py-2 pr-2 font-semibold">
                When
              </th>
              <th scope="col" className="py-2 pr-2 font-semibold">
                Mode
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">
                Rallies
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Best
              </th>
            </tr>
          </thead>
          <tbody>
            {mine.map((s) => {
              const best = Math.max(
                0,
                ...s.rallies.map((r) => countHits(r.hits, preset!.soundsPerHit)),
              )
              return (
                <tr key={s.id} className="border-b border-rule hover:bg-slate-2">
                  <td className="py-0">
                    <a
                      href={`#/history/${encodeURIComponent(s.id)}`}
                      aria-label={`Session of ${fmtDate(s.startedAt)}, ${fmtTime(s.startedAt)}`}
                      className="flex min-h-12 flex-col justify-center pr-2 text-chalk no-underline"
                    >
                      <span className="font-semibold">{fmtDate(s.startedAt)}</span>
                      <span className="text-xs text-chalk-dim">{fmtTime(s.startedAt)}</span>
                    </a>
                  </td>
                  <td className="pr-2 text-chalk-dim">{s.mode === 'match' ? 'Match' : 'Rally'}</td>
                  <td className="figures pr-2 text-right text-xl">{s.rallies.length}</td>
                  <td
                    className={`figures text-right text-xl font-extrabold ${best === summary?.best ? 'text-best' : ''}`}
                  >
                    {best}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </main>
  )
}
