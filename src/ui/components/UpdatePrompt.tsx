import { useRegisterSW } from 'virtual:pwa-register/react'

/** Registers the service worker; offers a reload when a new version waits. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh && !offlineReady) return null
  return (
    <section className="safe-x border-t border-rule bg-slate-2 py-2" aria-label="App update">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <output className="flex-1 text-sm">
          {needRefresh ? 'A new version of tok is ready.' : 'tok now works offline.'}
        </output>
        {needRefresh ? (
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="min-h-11 rounded-lg bg-chalk px-4 text-sm font-semibold text-slate"
          >
            Reload
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOfflineReady(false)}
            className="min-h-11 rounded-lg px-3 text-sm font-semibold text-chalk-dim hover:text-chalk"
          >
            Got it
          </button>
        )}
      </div>
    </section>
  )
}
