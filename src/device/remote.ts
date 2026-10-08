// Experimental: a Bluetooth remote or earbuds as a scoreboard clicker, through
// the Media Session API. Media keys only reach a page that is playing media,
// so a second of silence loops quietly in the background.

export interface RemoteHandlers {
  playPause: () => void
  next: () => void
  previous: () => void
}

function silentWav(): Blob {
  const rate = 8000
  const samples = rate
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const text = (offset: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples * 2, true)
  return new Blob([buffer], { type: 'audio/wav' })
}

export function startRemote(handlers: RemoteHandlers, title: string): { stop: () => void } {
  const session = navigator.mediaSession
  if (!session) return { stop: () => {} }
  const url = URL.createObjectURL(silentWav())
  const audio = new Audio(url)
  audio.loop = true
  void audio.play().catch(() => {})
  session.metadata = new MediaMetadata({ title, artist: 'tok' })
  const actions: [MediaSessionAction, () => void][] = [
    ['play', handlers.playPause],
    ['pause', handlers.playPause],
    ['nexttrack', handlers.next],
    ['previoustrack', handlers.previous],
  ]
  for (const [action, handler] of actions) {
    try {
      session.setActionHandler(action, handler)
    } catch {
      // Not every browser knows every action.
    }
  }
  return {
    stop: () => {
      for (const [action] of actions) {
        try {
          session.setActionHandler(action, null)
        } catch {
          // ignore
        }
      }
      audio.pause()
      URL.revokeObjectURL(url)
    },
  }
}
