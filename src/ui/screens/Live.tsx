import { useLayoutEffect, useRef, useState } from 'react'
import { Minus, Square, Undo2, X } from 'lucide-react'
import type { Side } from '../../engine/scoring/index.ts'
import type { HitCandidate } from '../../engine/types.ts'
import { useWakeLock } from '../../device/wakeLock.ts'
import { sport } from '../../engine/sports.ts'
import { Count } from '../components/Count.tsx'
import { SensorChips } from '../components/SensorChips.tsx'
import { Tally } from '../components/Tally.tsx'
import type { LiveConfig } from '../config.ts'
import { useLiveSession, type LiveSession } from '../hooks/useLiveSession.ts'
import { useSensors } from '../hooks/useSensors.ts'
import { go } from '../router.ts'

export function Live({ config }: { config: LiveConfig }) {
  const preset = sport(config.sportId)
  const sensing = useRef<(c: HitCandidate) => void>(() => {})
  const sensors = useSensors({
    enabled: config.input === 'auto',
    preset,
    onCandidate: (c) => sensing.current(c),
  })
  const session = useLiveSession(config, sensors.active)
  useLayoutEffect(() => {
    sensing.current = session.sense
  })
  const [confirmEnd, setConfirmEnd] = useState(false)
  useWakeLock()

  const end = async () => {
    const id = await session.finish()
    go(id ? `/history/${encodeURIComponent(id)}` : '/')
  }

  return (
    <div
      className="fixed inset-0 flex flex-col bg-slate select-none"
      style={{ touchAction: 'manipulation' }}
    >
      <header className="safe-top safe-x flex min-h-14 items-center gap-3 border-b border-rule pb-2">
        {confirmEnd ? (
          <fieldset className="flex w-full items-center gap-2">
            <legend className="sr-only">End session</legend>
            <p className="flex-1 font-semibold">End and save this session?</p>
            <button
              type="button"
              onClick={() => setConfirmEnd(false)}
              className="min-h-11 rounded-lg px-3 font-semibold text-chalk-dim hover:text-chalk"
            >
              Keep playing
            </button>
            <button
              type="button"
              onClick={() => void end()}
              className="min-h-11 rounded-lg bg-chalk px-4 font-semibold text-slate"
            >
              End
            </button>
          </fieldset>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              aria-label="End session"
              className="grid size-11 place-items-center rounded-lg text-chalk-dim hover:text-chalk"
            >
              <X size={26} aria-hidden="true" />
            </button>
            <p className="flex-1 truncate font-semibold">
              {session.preset.name}
              <span className="text-chalk-dim">
                {' '}
                · {config.mode === 'match' ? 'Match' : 'Rally'}
              </span>
            </p>
            <SensorChips status={sensors.status} />
          </>
        )}
      </header>
      {config.mode === 'match' && session.match ? (
        <MatchBoard session={session} config={config} />
      ) : (
        <RallyBoard session={session} />
      )}
    </div>
  )
}

function verdictLine(session: LiveSession): { text: string; tone: string } {
  const { verdict, inRally, count, preset } = session
  if (inRally) return { text: preset.unit, tone: 'text-chalk-dim' }
  if (!verdict)
    return { text: count ? preset.unit : 'Tap anywhere for each hit', tone: 'text-chalk-dim' }
  if (verdict.record) return { text: `New record — ${verdict.count}!`, tone: 'text-best' }
  if (verdict.todayBest) return { text: `Best today — ${verdict.count}!`, tone: 'text-best' }
  const gap = session.todayBest - verdict.count
  return {
    text: gap > 0 ? `${gap} off today's best. Again?` : 'Again?',
    tone: 'text-chalk-dim',
  }
}

function RallyBoard({ session }: { session: LiveSession }) {
  const line = verdictLine(session)
  const celebrating = !!session.verdict && (session.verdict.record || session.verdict.todayBest)
  return (
    <>
      <main className="relative flex flex-1 flex-col">
        <button
          type="button"
          onClick={session.tap}
          aria-label={`Add a hit. Current rally: ${session.count}`}
          className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-offset-[-6px]"
        />
        <div className="safe-x pointer-events-none relative z-[1] flex flex-1 flex-col items-center justify-center gap-4">
          <Count
            value={session.count}
            className={`text-[clamp(8rem,min(42vh,58vw),26rem)] ${celebrating ? 'text-best' : 'text-chalk'}`}
          />
          <p
            className={`figures text-[clamp(1.5rem,4.5vh,2.5rem)] font-semibold ${line.tone}`}
            aria-live="polite"
          >
            {line.text}
          </p>
          <Tally
            count={session.count}
            tone={session.inRally ? 'var(--color-chalk)' : 'var(--color-chalk-faint)'}
            className="w-full max-w-3xl"
          />
        </div>
      </main>
      <footer className="safe-x safe-bottom border-t border-rule pt-3">
        <div className="mx-auto max-w-2xl">
          <dl className="figures grid grid-cols-3 pb-3 text-center">
            <Stat label="Today" value={session.todayBest} tone="text-best" />
            <Stat label="Record" value={session.best} tone="text-best" />
            <Stat label="Rallies" value={session.rallies.length} tone="text-chalk" />
          </dl>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={session.undoHit}
              disabled={!session.inRally}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-2 text-lg font-semibold disabled:text-chalk-faint"
            >
              <Minus size={22} aria-hidden="true" /> Undo hit
            </button>
            <button
              type="button"
              onClick={session.endRally}
              disabled={!session.inRally}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-2 text-lg font-semibold disabled:text-chalk-faint"
            >
              <Square size={18} aria-hidden="true" /> End rally
            </button>
          </div>
        </div>
      </footer>
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col">
      <dt className="font-sans text-xs font-semibold text-chalk-dim">{label}</dt>
      <dd className={`text-4xl font-extrabold ${tone}`}>{value}</dd>
    </div>
  )
}

const SIDE_TONE: Record<Side, string> = { A: 'text-side-a', B: 'text-side-b' }

function MatchBoard({ session, config }: { session: LiveSession; config: LiveConfig }) {
  const match = session.match!
  const tennis = match.games !== null
  const half = (side: Side) => (
    <button
      type="button"
      onClick={() => session.point(side)}
      disabled={!!match.winner}
      aria-label={`Point to ${config.names[side]}. Score ${match.current[side]}`}
      className={`safe-x relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150 ${
        side === 'A' ? 'bg-side-a/8 active:bg-side-a/20' : 'bg-side-b/8 active:bg-side-b/20'
      }`}
    >
      <span className={`text-xl font-semibold ${SIDE_TONE[side]}`}>{config.names[side]}</span>
      <span
        className={`figures text-[clamp(8rem,min(34vh,64vw),22rem)] leading-[0.82] font-extrabold ${SIDE_TONE[side]}`}
      >
        {match.current[side]}
      </span>
      {match.matchPoint === side ? (
        <span className="figures text-2xl font-semibold text-best">Match point</span>
      ) : match.setPoint === side ? (
        <span className="figures text-2xl font-semibold text-best">Set point</span>
      ) : null}
    </button>
  )

  const status = match.winner
    ? `${config.names[match.winner]} wins!`
    : session.awaitingWinner
      ? `${session.count} ${session.preset.unit} — who won it?`
      : session.inRally
        ? `${session.count} ${session.preset.unit}`
        : match.tiebreak
          ? 'Tie-break'
          : 'Tap the winner of each point'

  // The seam is the scorer's column: who serves, sets, games, finished sets.
  const column = (side: Side) => (
    <span className={`flex items-center gap-2 ${SIDE_TONE[side]}`}>
      <span
        className={`size-3 rounded-full ${match.server === side && !match.winner ? 'bg-chalk' : 'bg-transparent'}`}
        aria-label={
          match.server === side && !match.winner ? `${config.names[side]} serves` : undefined
        }
      />
      <span className="figures text-2xl font-extrabold">
        {match.setsWon[side]}
        {tennis && match.games ? (
          <span className="text-chalk-dim"> · {match.games[side]}</span>
        ) : null}
      </span>
    </span>
  )

  return (
    <main className="flex flex-1 flex-col landscape:flex-row">
      {half('A')}
      <div className="safe-x flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-rule bg-slate-2 py-2 landscape:flex-col landscape:flex-nowrap landscape:justify-center landscape:border-x landscape:border-y-0 landscape:px-3">
        <div
          className="flex items-center gap-3 landscape:flex-col"
          aria-label={tennis ? 'Sets and games' : 'Sets'}
        >
          {column('A')}
          <span className="text-chalk-faint">sets{tennis ? ' · games' : ''}</span>
          {column('B')}
        </div>
        {match.sets.length > 0 && (
          <p className="figures text-lg text-chalk-dim" aria-label="Finished sets">
            {match.sets.map((s) => `${s.A}–${s.B}`).join('  ')}
          </p>
        )}
        <p
          className="figures order-last basis-full text-lg font-semibold text-chalk-dim landscape:order-none landscape:max-w-52 landscape:basis-auto landscape:text-center"
          aria-live="polite"
        >
          {status}
        </p>
        <button
          type="button"
          onClick={session.undoPoint}
          className="ml-auto flex min-h-11 items-center gap-1 rounded-lg px-3 font-semibold text-chalk-dim hover:text-chalk landscape:ml-0"
        >
          <Undo2 size={18} aria-hidden="true" /> Undo point
        </button>
      </div>
      {half('B')}
    </main>
  )
}
