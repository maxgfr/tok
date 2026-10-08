// A dedicated worker does not inherit the page's <meta> Content-Security-
// Policy, and GitHub Pages sends no CSP header. So the worker that runs
// third-party code (MediaPipe) locks its own network APIs to tok's origin.

interface Scope {
  fetch: typeof fetch
  XMLHttpRequest: { prototype: { open: (...args: never[]) => void } }
  navigator: { sendBeacon?: (url: string | URL, data?: unknown) => boolean }
  location: { origin: string }
}

export function lockToOrigin(scope: Scope): void {
  const origin = scope.location.origin
  const allowed = (url: string | URL | Request): boolean => {
    const href = typeof url === 'string' || url instanceof URL ? String(url) : url.url
    try {
      return new URL(href, origin).origin === origin
    } catch {
      return false
    }
  }
  const blocked = (url: unknown) => new Error(`tok: network blocked in worker (${String(url)})`)

  const realFetch = scope.fetch.bind(scope)
  scope.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    allowed(input) ? realFetch(input, init) : Promise.reject(blocked(input))) as typeof fetch

  const proto = scope.XMLHttpRequest.prototype as unknown as {
    open: (this: unknown, method: string, url: string | URL, ...rest: unknown[]) => void
  }
  const realOpen = proto.open
  proto.open = function (this: unknown, method: string, url: string | URL, ...rest: unknown[]) {
    if (!allowed(url)) throw blocked(url)
    return realOpen.call(this, method, url, ...rest)
  }

  scope.navigator.sendBeacon = () => false
}
