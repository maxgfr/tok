import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'live' }
  | { name: 'history' }
  | { name: 'session'; id: string }
  | { name: 'replay'; id: string }
  | { name: 'settings' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [head, id] = parts
  switch (head) {
    case 'live':
    case 'settings':
      return { name: head }
    case 'history':
      return id ? { name: 'session', id: decodeURIComponent(id) } : { name: 'history' }
    case 'replay':
      return id ? { name: 'replay', id: decodeURIComponent(id) } : { name: 'history' }
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
