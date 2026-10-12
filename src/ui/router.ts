import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'live' }
  | { name: 'history' }
  | { name: 'session'; id: string }
  | { name: 'replay'; id: string }
  | { name: 'settings' }

/** A broken escape in a link (`%E0%A4%A`) must not take the whole app down. */
const decode = (part: string): string | null => {
  try {
    return decodeURIComponent(part)
  } catch {
    return null
  }
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [head, id] = parts
  switch (head) {
    case 'live':
    case 'settings':
      return { name: head }
    case 'history':
    case 'replay': {
      const decoded = id === undefined ? null : decode(id)
      if (decoded === null) return { name: 'history' }
      return { name: head === 'history' ? 'session' : 'replay', id: decoded }
    }
    default:
      return { name: 'home' }
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseHash(hash)
}

/** `replace` drops the current entry, so Back cannot return to it (the live screen). */
export function go(path: string, { replace = false }: { replace?: boolean } = {}): void {
  if (replace) window.location.replace(`#${path}`)
  else window.location.hash = path
}
