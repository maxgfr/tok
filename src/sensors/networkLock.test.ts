import { describe, expect, test, vi } from 'vitest'
import { lockToOrigin } from './networkLock.ts'

function scope() {
  const fetch = vi.fn(async (_input: unknown, _init?: unknown) => new Response('ok'))
  class XHR {
    opened: string | null = null
    open(_method: string, url: string | URL) {
      this.opened = String(url)
    }
  }
  const sendBeacon = vi.fn((_url: unknown, _data?: unknown) => true)
  const s = {
    fetch,
    XMLHttpRequest: XHR,
    navigator: { sendBeacon },
    location: { origin: 'https://maxgfr.github.io' },
  }
  lockToOrigin(s as never)
  return { s: s as unknown as typeof s & { fetch: typeof fetch }, fetch, sendBeacon }
}

describe('lockToOrigin', () => {
  test('same-origin fetches go through', async () => {
    const { s, fetch } = scope()
    await s.fetch('/tok/models/efficientdet_lite0.tflite')
    expect(fetch).toHaveBeenCalled()
  })

  test('fetches to another origin are refused', async () => {
    const { s, fetch } = scope()
    await expect(
      s.fetch('https://odml.pa.googleapis.com/v1/log', { method: 'POST' }),
    ).rejects.toThrow(/blocked/i)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('XMLHttpRequest to another origin throws on open', () => {
    const { s } = scope()
    const xhr = new s.XMLHttpRequest()
    expect(() => xhr.open('POST', 'https://example.com/x')).toThrow(/blocked/i)
    xhr.open('GET', '/tok/x')
    expect(xhr.opened).toBe('/tok/x')
  })

  test('beacons are never sent', () => {
    const { s, sendBeacon } = scope()
    expect(s.navigator.sendBeacon('https://example.com', 'x')).toBe(false)
    expect(sendBeacon).not.toHaveBeenCalled()
  })
})
