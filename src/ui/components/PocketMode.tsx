import { useEffect, useRef } from 'react'
import { ChevronUp } from 'lucide-react'

const UNLOCK_DISTANCE = 160

/**
 * Black screen, touches swallowed: the phone keeps counting in a pocket or
 * face-up on the sand without a stray palm ending the session. Pure black
 * costs nothing on OLED screens. Swipe up (or Escape) to come back.
 */
export function PocketMode({ onUnlock }: { onUnlock: () => void }) {
  const start = useRef<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  // A modal dialog sits in the top layer and makes the rest of the page inert.
  useEffect(() => {
    const el = dialog.current
    if (el && !el.open) {
      if (typeof el.showModal === 'function') el.showModal()
      else el.setAttribute('open', '')
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onUnlock()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onUnlock])

  return (
    <dialog
      ref={dialog}
      data-testid="pocket"
      aria-label="Pocket mode. Swipe up or press Escape to unlock."
      onCancel={(e) => {
        e.preventDefault()
        onUnlock()
      }}
      className="fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none touch-none flex-col items-center justify-end border-0 bg-black p-0 pb-16 select-none backdrop:bg-black"
      onPointerDown={(e) => {
        start.current = e.clientY
      }}
      onPointerUp={(e) => {
        if (start.current !== null && start.current - e.clientY >= UNLOCK_DISTANCE) onUnlock()
        start.current = null
      }}
      onPointerCancel={() => {
        start.current = null
      }}
    >
      <ChevronUp size={28} className="text-chalk-faint/50" aria-hidden="true" />
      <p className="text-sm text-chalk-faint/60">Swipe up to unlock</p>
    </dialog>
  )
}
