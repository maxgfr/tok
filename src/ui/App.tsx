import { useState } from 'react'
import { BottomNav } from './components/BottomNav.tsx'
import { UpdatePrompt } from './components/UpdatePrompt.tsx'
import type { LiveConfig } from './config.ts'
import { useRoute } from './router.ts'
import { History } from './screens/History.tsx'
import { Home } from './screens/Home.tsx'
import { Lab } from './screens/Lab.tsx'
import { Replay } from './screens/Replay.tsx'
import { Live } from './screens/Live.tsx'
import { SessionDetail } from './screens/SessionDetail.tsx'
import { Settings } from './screens/Settings.tsx'

export function App() {
  const route = useRoute()
  const [config, setConfig] = useState<LiveConfig | null>(null)

  if (route.name === 'live') {
    // A reload on the live screen goes back to setup rather than guessing.
    if (!config) return <Home onStart={setConfig} />
    return <Live key={JSON.stringify(config)} config={config} />
  }

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex flex-1 flex-col overflow-y-auto">
        {route.name === 'home' && <Home onStart={setConfig} />}
        {route.name === 'history' && <History />}
        {route.name === 'session' && <SessionDetail id={route.id} />}
        {route.name === 'settings' && <Settings />}
        {route.name === 'lab' && <Lab />}
        {route.name === 'replay' && <Replay id={route.id} />}
      </div>
      <UpdatePrompt />
      <BottomNav route={route} />
    </div>
  )
}
