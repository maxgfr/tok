import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AudioWaveform,
  Hand,
  Lock,
  Minus,
  RotateCcw,
  Square,
  Undo2,
  Video,
  VideoOff,
  X,
} from 'lucide-react'
import type { Side } from '../../engine/scoring/index.ts'
import type { Hit } from '../../engine/types.ts'
import { useWakeLock } from '../../device/wakeLock.ts'
import { useCoach } from '../hooks/useCoach.ts'
import { sport } from '../../engine/sports.ts'
import { Count } from '../components/Count.tsx'
import type { TracePoint } from '../components/LevelTrace.tsx'
import { PocketMode } from '../components/PocketMode.tsx'
import { SensitivityPanel } from '../components/SensitivityPanel.tsx'
import { SensorChips } from '../components/SensorChips.tsx'
import { Tally } from '../components/Tally.tsx'
import { saveConfig, type InputMode, type LiveConfig } from '../config.ts'
import { loadMicDevice } from '../micDevice.ts'
import { loadRallyLimit } from '../sportSettings.ts'
import { useLiveSession, type LiveSession } from '../hooks/useLiveSession.ts'
import { useCamera } from '../hooks/useCamera.ts'
import { useVision } from '../hooks/useVision.ts'
import { useSensitivity } from '../hooks/useSensitivity.ts'
import { useLatest } from '../hooks/useLatest.ts'
import { useSensors } from '../hooks/useSensors.ts'
import type { OverlayState } from '../../record/overlay.ts'
import { deleteVideo } from '../../record/videoStore.ts'
import { primeAudio, primeMotion } from '../../sensors/prime.ts'
import { releaseVisionWorker } from '../../sensors/vision.ts'
import { go } from '../router.ts'

export function Live({ config: initial }: { config: LiveConfig }) {
  // The counting mode can change mid-session; everything else is fixed at Start.
  const [input, setInput] = useState<InputMode>(initial.input)
  const config = useMemo(() => ({ ...initial, input }), [initial, input])
  const switchInput = () => {
    const next: InputMode = input === 'auto' ? 'manual' : 'auto'
    if (next === 'auto') {
      // Inside the tap: iOS only starts audio and motion from a user gesture.
      primeAudio()
      void primeMotion()
    }
    setInput(next)
    void saveConfig({ ...initial, input: next })
  }
  const preset = sport(config.sportId)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [pocket, setPocket] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [micDevice, setMicDevice] = useState('')
  useEffect(() => {
    if (panelOpen) void loadMicDevice().then(setMicDevice)
  }, [panelOpen])
  const [rejected, setRejected] = useState(0)
  // What the mic hears, for the sensitivity panel's trace.
  const levels = useRef<TracePoint[]>([])
  const onsets = useRef<number[]>([])
  const sensing = useRef<(hit: Hit) => void>(() => {})
  const sensors = useSensors({
    enabled: config.input === 'auto',
    preset,
    onHit: (hit) => {
      sensing.current(hit)
      onsets.current.push(hit.t)
      if (onsets.current.length > 50) onsets.current.splice(0, onsets.current.length - 50)
    },
    onLevel: (l) => {
      const buffer = levels.current
      buffer.push({ t: l.t, flux: l.flux, threshold: l.threshold })
      if (buffer.length > 600) buffer.splice(0, buffer.length - 600)
      setRejected(l.rejected)
    },
  })
  const sens = useSensitivity(preset.id, {
    onChange: ({ threshold, voiceFilter }) => {
      sensors.setThreshold(threshold)
      sensors.setVoiceFilter(voiceFilter)
    },
  })
  const { setLevels } = sensors
  useEffect(() => {
    setLevels(panelOpen)
  }, [panelOpen, setLevels])
  const session = useLiveSession(config, sensors.active)
  useLayoutEffect(() => {
    sensing.current = session.sense
  })
  // A new object only when the score moves: the recording repaints its plate then.
  const m = session.match
  const overlay = useMemo<OverlayState>(
    () => ({
      title: preset.name,
      unit: preset.unit,
      count: session.count,
      best: session.best,
      match: m ? { names: config.names, points: m.current, sets: m.setsWon } : null,
    }),
    [preset, session.count, session.best, m, config.names],
  )
  const {
    video: cameraVideo,
    status: cameraStatus,
    stop: stopCamera,
    markRally,
  } = useCamera({
    enabled: cameraOn,
    name: session.id,
    overlay,
    audioTrack: sensors.audioTrack,
  })
  const vision = useVision({
    enabled: cameraOn && config.input === 'auto' && preset.weights.vision > 0,
    video: cameraVideo,
    preset,
    onCandidate: sensors.feed,
  })
  // Each rally opens on a key frame: replays and clips can cut exactly there.
  useEffect(() => {
    if (session.inRally) markRally()
  }, [session.inRally, markRally])
  // The model stays loaded while the camera goes on and off; leaving frees it.
  useEffect(() => releaseVisionWorker, [])
  const [usedVision, setUsedVision] = useState(false)
  if (vision === 'on' && !usedVision) setUsedVision(true)
  useWakeLock()
  useCoach(config, session)

  // Every way out of this screen closes the session and keeps its videos:
  // End, but also a back gesture or another tab in the app.
  const ended = useRef(false)
  const close = async () => {
    const hasPlay = session.rallies.length > 0 || session.inRally
    // StrictMode's rehearsal unmount (nothing played, no camera) must not
    // count as leaving.
    if (!hasPlay && !cameraOn) return null
    ended.current = true
    const videos = await stopCamera()
    const used = [...sensors.active, ...(usedVision ? (['vision'] as const) : [])]
    const id = hasPlay
      ? await session.finish({ sensors: used, ...(videos.length ? { videos } : {}) })
      : null
    if (!id) await Promise.all(videos.map(deleteVideo))
    return id
  }
  const closeRef = useLatest(close)
  useEffect(
    () => () => {
      if (!ended.current) void closeRef.current()
    },
    [closeRef],
  )

  const end = async () => {
    ended.current = true
    const id = await close()
    go(id ? `/history/${encodeURIComponent(id)}` : '/', { replace: true })
  }

  /** Ends without keeping anything: no session in History, no video. */
  const discard = async () => {
    ended.current = true
    const videos = await stopCamera()
    await Promise.all([...videos.map(deleteVideo), session.discard()])
    go('/', { replace: true })
  }

  // Rally mode with a session length set (Settings): after the last rally,
  // a moment for its verdict and chime, then the session ends on its own.
  const [rallyLimit, setRallyLimit] = useState(0)
  useEffect(() => {
    void loadRallyLimit(config.sportId).then(setRallyLimit)
  }, [config.sportId])
  const limitReached =
    config.mode === 'rally' &&
    rallyLimit > 0 &&
    session.rallies.length >= rallyLimit &&
    !session.inRally
  const endRef = useLatest(end)
  useEffect(() => {
    if (!limitReached) return
    const timer = window.setTimeout(() => void endRef.current(), 1500)
    return () => window.clearTimeout(timer)
  }, [limitReached, endRef])

  return (
    <div
      className="fixed inset-0 flex flex-col bg-slate select-none"
      style={{ touchAction: 'manipulation' }}
    >
      {cameraOn && (
        <>
          <video
            ref={cameraVideo}
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            aria-label="Camera preview"
          />
          {/* Scrim: the figures must stay legible over a sunny court. */}
          <div className="absolute inset-0 bg-slate/70" aria-hidden="true" />
        </>
      )}
      <header
        className={`safe-top safe-x relative flex min-h-14 items-center gap-3 border-b border-rule pb-2 ${cameraOn ? 'bg-slate/90' : ''}`}
      >
        {confirmEnd ? (
          <fieldset className="flex w-full items-center gap-2">
            <legend className="sr-only">End session</legend>
            <p className="flex-1 font-semibold max-[420px]:sr-only">End this session?</p>
            <button
              type="button"
              onClick={() => setConfirmEnd(false)}
              className="min-h-11 rounded-lg px-3 font-semibold text-chalk-dim hover:text-chalk"
            >
              Keep playing
            </button>
            <button
              type="button"
              onClick={() => void discard()}
              className="min-h-11 rounded-lg px-3 font-semibold text-chalk-dim hover:text-side-b"
            >
              Don't save
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
            <p className="min-w-0 flex-1 truncate font-semibold">
              {session.preset.name}
              <span className="text-chalk-dim">
                {' '}
                · {config.mode === 'match' ? 'Match' : 'Rally'}
                {config.mode === 'rally' && rallyLimit > 0
                  ? ` ${Math.min(session.rallies.length, rallyLimit)}/${rallyLimit}`
                  : ''}
              </span>
            </p>
            <SensorChips
              status={{ ...sensors.status, ...(vision !== 'off' ? { vision } : {}) }}
              dominant={preset.dominant}
              onAudio={() => setPanelOpen(true)}
            />
            <button
              type="button"
              onClick={switchInput}
              title={
                input === 'auto' ? 'Auto (experimental) — tap for Manual' : 'Manual — tap for Auto'
              }
              aria-label={
                input === 'auto'
                  ? 'Counting with sensors. Switch to Manual'
                  : 'Counting by hand. Switch to Auto'
              }
              className={`grid size-11 place-items-center rounded-lg ${
                input === 'auto' ? 'text-chalk' : 'text-chalk-dim hover:text-chalk'
              }`}
            >
              {input === 'auto' ? (
                <AudioWaveform size={22} aria-hidden="true" />
              ) : (
                <Hand size={22} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setCameraOn((on) => !on)}
              aria-pressed={cameraOn}
              aria-label={cameraOn ? 'Stop the camera' : 'Film the session'}
              className={`relative grid size-11 place-items-center rounded-lg ${
                cameraOn ? 'text-chalk' : 'text-chalk-dim hover:text-chalk'
              }`}
            >
              {cameraOn ? (
                <Video size={22} aria-hidden="true" />
              ) : (
                <VideoOff size={22} aria-hidden="true" />
              )}
              {cameraStatus === 'recording' && (
                <span
                  className="absolute top-2 right-2 size-2 rounded-full bg-side-b"
                  aria-label="recording"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setPocket(true)}
              aria-label="Lock the screen"
              title="Lock the screen: black, touches ignored"
              className="grid size-11 place-items-center rounded-lg text-chalk-dim hover:text-chalk"
            >
              <Lock size={22} aria-hidden="true" />
            </button>
          </>
        )}
      </header>
      {config.mode === 'match' && session.match ? (
        <MatchBoard session={session} config={config} />
      ) : (
        <RallyBoard session={session} bright={cameraOn} />
      )}
      {pocket && <PocketMode onUnlock={() => setPocket(false)} />}
      {panelOpen && (
        <SensitivityPanel
          sportName={preset.name}
          sensitivity={sens.sensitivity}
          voiceFilter={sens.voiceFilter}
          levels={levels}
          onsets={onsets}
          rejected={rejected}
          onSensitivity={(v) => void sens.setSensitivity(v)}
          onVoiceFilter={(on) => void sens.setVoiceFilter(on)}
          onReset={() => void sens.reset()}
          onClose={() => setPanelOpen(false)}
          micDevice={micDevice}
          onMicDevice={(id) => {
            setMicDevice(id)
            void sensors.setMicDevice(id)
          }}
          onManual={() => {
            setPanelOpen(false)
            switchInput()
          }}
        />
      )}
    </div>
  )
}

function verdictLine(session: LiveSession): { text: string; tone: string } {
  const { verdict, inRally, count, preset } = session
  if (inRally) return { text: preset.unit, tone: 'text-chalk-dim' }
  if (!verdict)
    return { text: count ? preset.unit : 'Tap anywhere for each hit', tone: 'text-chalk-dim' }
  if (verdict.goal) return { text: `Goal reached — ${verdict.count}!`, tone: 'text-best' }
  if (verdict.record) return { text: `New record — ${verdict.count}!`, tone: 'text-best' }
  if (verdict.todayBest) return { text: `Best today — ${verdict.count}!`, tone: 'text-best' }
  const gap = session.todayBest - verdict.count
  return {
    text: gap > 0 ? `${gap} off today's best. Again?` : 'Again?',
    tone: 'text-chalk-dim',
  }
}

function RallyBoard({ session, bright }: { session: LiveSession; bright: boolean }) {
  const line = verdictLine(session)
  // Over a camera feed, secondary text steps up to full chalk.
  const tone = bright && line.tone === 'text-chalk-dim' ? 'text-chalk' : line.tone
  const celebrating =
    !!session.verdict &&
    (session.verdict.record || session.verdict.todayBest || !!session.verdict.goal)
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
            className={`figures text-[clamp(1.5rem,4.5vh,2.5rem)] font-semibold ${tone}`}
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
      <footer
        className={`safe-x safe-bottom relative border-t border-rule pt-3 ${bright ? 'bg-slate/90' : ''}`}
      >
        <div className="mx-auto max-w-2xl">
          <dl className="figures grid grid-cols-3 pb-3 text-center">
            <Stat label="Today" value={session.todayBest} tone="text-best" bright={bright} />
            <Stat
              key={session.verdict?.record ? `r${session.best}` : 'record'}
              label="Record"
              value={session.best}
              tone="text-best"
              bright={bright}
              pulse={!!session.verdict?.record}
            />
            {session.goal > 0 ? (
              <Stat
                label="Goal"
                value={session.goal}
                tone={session.todayBest >= session.goal ? 'text-best' : 'text-chalk'}
                bright={bright}
              />
            ) : (
              <Stat
                label="Rallies"
                value={session.rallies.length}
                tone="text-chalk"
                bright={bright}
              />
            )}
          </dl>
          <div className="grid grid-cols-3 gap-3">
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
              onClick={session.restartRally}
              disabled={!session.inRally}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-2 text-lg font-semibold disabled:text-chalk-faint"
            >
              <RotateCcw size={20} aria-hidden="true" /> Restart
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

function Stat({
  label,
  value,
  tone,
  pulse = false,
  bright = false,
}: {
  label: string
  value: number
  tone: string
  pulse?: boolean
  bright?: boolean
}) {
  return (
    <div className="flex flex-col">
      <dt className={`font-sans text-xs font-semibold ${bright ? 'text-chalk' : 'text-chalk-dim'}`}>
        {label}
      </dt>
      <dd
        className={`text-4xl font-extrabold ${tone}`}
        style={pulse ? { animation: 'chalk-pulse 700ms var(--ease-out-expo) 2' } : undefined}
      >
        {value}
      </dd>
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
    <main className="relative flex flex-1 flex-col landscape:flex-row">
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
          className="order-last basis-full text-lg font-semibold text-chalk-dim landscape:order-none landscape:max-w-52 landscape:basis-auto landscape:text-center"
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
