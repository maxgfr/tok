import { Component, type ReactNode } from 'react'

/**
 * Screens load on first visit. If one cannot (offline before it was cached, or
 * a new version replaced the files under an open tab), say so and offer a
 * reload rather than leaving a blank page.
 */
export class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="safe-x safe-top mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3">
        <h1 className="figures text-4xl font-extrabold">This screen did not load</h1>
        <p className="text-chalk-dim">
          tok may have been updated, or the network dropped before it was saved for offline use.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-12 self-start rounded-xl bg-chalk px-5 font-semibold text-slate"
        >
          Reload
        </button>
      </main>
    )
  }
}
