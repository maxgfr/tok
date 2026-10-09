import { lazy, Suspense, useEffect, useState } from 'react'
import { BottomNav } from './components/BottomNav.tsx'
import { ScreenBoundary } from './components/ScreenBoundary.tsx'
import { UpdatePrompt } from './components/UpdatePrompt.tsx'
import type { LiveConfig } from './config.ts'
import { useRoute } from './router.ts'
import { Home } from './screens/Home.tsx'

// Home opens the app; every other screen loads when first visited.
const loadLive = () => import('./screens/Live.tsx')
const Live = lazy(() => loadLive().then((m) => ({ default: m.Live })))
const History = lazy(() => import('./screens/History.tsx').then((m) => ({ default: m.History })))
const Lab = lazy(() => import('./screens/Lab.tsx').then((m) => ({ default: m.Lab })))
const Replay = lazy(() => import('./screens/Replay.tsx').then((m) => ({ default: m.Replay })))
const SessionDetail = lazy(() =>
  import('./screens/SessionDetail.tsx').then((m) => ({ default: m.SessionDetail })),
)
const Settings = lazy(() => import('./screens/Settings.tsx').then((m) => ({ default: m.Settings })))

const Loading = () => <main className="flex-1" />

export function App() {
  const route = useRoute()
  const [config, setConfig] = useState<LiveConfig | null>(null)

  // Setting up a session: have the live screen ready by the time Start is tapped.
  useEffect(() => {
    if (route.name === 'home') void loadLive()
  }, [route.name])

  if (route.name === 'live') {
    // A reload on the live screen goes back to setup rather than guessing.
    if (!config) return <Home onStart={setConfig} />
    return (
      <ScreenBoundary>
        <Suspense fallback={<div className="fixed inset-0 bg-slate" />}>
          <Live key={JSON.stringify(config)} config={config} />
        </Suspense>
      </ScreenBoundary>
    )
  }

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Keyed by route: leaving a screen that failed tries the next one afresh. */}
        <ScreenBoundary key={route.name}>
          <Suspense fallback={<Loading />}>
            {route.name === 'home' && <Home onStart={setConfig} />}
            {route.name === 'history' && <History />}
            {route.name === 'session' && <SessionDetail id={route.id} />}
            {route.name === 'settings' && <Settings />}
            {route.name === 'lab' && <Lab />}
            {route.name === 'replay' && <Replay id={route.id} />}
          </Suspense>
        </ScreenBoundary>
      </div>
      <UpdatePrompt />
      <BottomNav route={route} />
    </div>
  )
}
