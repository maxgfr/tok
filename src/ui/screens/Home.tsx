import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { SPORTS, sport, type SportId } from '../../engine/sports.ts'
import { primeAudio, primeMotion } from '../../sensors/prime.ts'
import { Segmented } from '../components/Segmented.tsx'
import { loadConfig, saveConfig, type LiveConfig } from '../config.ts'
import { go } from '../router.ts'

/** The two games tok is built around come first; the rest follow. */
const PRIMARY: SportId[] = ['table-tennis', 'beach-rackets']

interface Props {
  onStart: (config: LiveConfig) => void
}

export function Home({ onStart }: Props) {
  const [config, setConfig] = useState<LiveConfig | null>(null)

  useEffect(() => {
    void loadConfig().then(setConfig)
  }, [])

  if (!config) return <div className="flex-1" />

  const preset = sport(config.sportId)
  const update = (patch: Partial<LiveConfig>) => setConfig({ ...config, ...patch })
  const pickSport = (id: SportId) => {
    const next = sport(id)
    update({ sportId: id, mode: next.modes.includes(config.mode) ? config.mode : 'rally' })
  }
  const start = () => {
    // Inside the tap: iOS only lets audio start from a user gesture.
    if (config.input === 'auto') {
      primeAudio()
      void primeMotion()
    }
    void saveConfig(config)
    onStart(config)
    go('/live')
  }
  const ordered = [...PRIMARY.map(sport), ...SPORTS.filter((s) => !PRIMARY.includes(s.id))]

  return (
    <main className="safe-x safe-top mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 pb-6">
      <header className="flex items-baseline justify-between pt-2">
        <h1 className="figures text-5xl font-extrabold tracking-[-0.02em]">tok</h1>
        <p className="text-sm text-chalk-dim">Every hit counts.</p>
      </header>

      <section aria-labelledby="mode-h" className="flex flex-col gap-3">
        <h2 id="mode-h" className="text-sm font-semibold text-chalk-dim">
          Mode
        </h2>
        <Segmented
          label="Mode"
          value={config.mode}
          onChange={(mode) => update({ mode })}
          options={[
            { value: 'rally', label: 'Count a rally' },
            {
              value: 'match',
              label: 'Keep score',
              disabled: !preset.modes.includes('match'),
            },
          ]}
        />
      </section>

      <section aria-labelledby="input-h" className="flex flex-col gap-3">
        <h2 id="input-h" className="text-sm font-semibold text-chalk-dim">
          Count with
        </h2>
        <Segmented
          label="Count with"
          value={config.input}
          onChange={(input) => update({ input })}
          options={[
            { value: 'auto', label: 'Auto — listen' },
            { value: 'manual', label: 'Taps only' },
          ]}
        />
        {config.input === 'auto' && (
          <p className="text-sm text-chalk-dim">
            Prop the phone near play, or keep it in a pocket. Sound and motion never leave this
            phone. Tune it in the Lab.
          </p>
        )}
      </section>

      {config.mode === 'match' && (
        <section aria-labelledby="players-h" className="flex flex-col gap-3">
          <h2 id="players-h" className="text-sm font-semibold text-chalk-dim">
            Players
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {(['A', 'B'] as const).map((side) => (
              <label key={side} className="flex flex-col gap-1">
                <span
                  className={`text-sm font-semibold ${side === 'A' ? 'text-side-a' : 'text-side-b'}`}
                >
                  Side {side}
                </span>
                <input
                  value={config.names[side]}
                  maxLength={16}
                  onChange={(e) => update({ names: { ...config.names, [side]: e.target.value } })}
                  className="min-h-12 rounded-lg border border-rule bg-slate-2 px-3 text-lg text-chalk placeholder:text-chalk-faint focus:border-chalk-dim"
                />
              </label>
            ))}
          </div>
          <Segmented
            label="First to serve"
            value={config.firstServer}
            onChange={(firstServer) => update({ firstServer })}
            options={[
              { value: 'A', label: `${config.names.A || 'A'} serves` },
              { value: 'B', label: `${config.names.B || 'B'} serves` },
            ]}
          />
        </section>
      )}

      <section aria-labelledby="sport-h" className="flex flex-col gap-3">
        <h2 id="sport-h" className="text-sm font-semibold text-chalk-dim">
          Sport
        </h2>
        <ul className="grid grid-cols-2 border-t border-l border-rule">
          {ordered.map((s) => {
            const active = s.id === config.sportId
            return (
              <li key={s.id} className="border-r border-b border-rule">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickSport(s.id)}
                  className={`flex min-h-13 w-full flex-col justify-center px-3 py-1.5 text-left transition-colors duration-150 ${
                    active ? 'bg-chalk text-slate' : 'hover:bg-slate-2'
                  }`}
                >
                  <span className="figures text-2xl font-semibold">{s.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="text-sm text-chalk-dim">{preset.blurb}</p>
      </section>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-slate pt-3">
        <p className="text-center text-sm text-chalk-dim">
          {config.mode === 'match' ? 'Keep score' : 'Count a rally'} ·{' '}
          {config.input === 'auto' ? 'listening' : 'taps only'}
        </p>
        <button
          type="button"
          onClick={start}
          className="figures flex min-h-18 w-full items-center justify-center gap-3 rounded-2xl bg-chalk text-3xl font-extrabold text-slate uppercase shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] transition-transform duration-150 active:scale-[0.98]"
        >
          <Play size={28} strokeWidth={2.6} fill="currentColor" aria-hidden="true" />
          Start {preset.name.toLowerCase()}
        </button>
      </div>
    </main>
  )
}
