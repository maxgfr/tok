import { useEffect } from 'react'

/** Keeps the screen on while mounted; iOS stops the mic and camera when it locks. */
export function useWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) await lock.release()
        else sentinel = lock
      } catch {
        // Denied (battery saver, hidden tab): the session still works.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [enabled])
}
