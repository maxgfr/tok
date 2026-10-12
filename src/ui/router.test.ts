import { describe, expect, test } from 'vitest'
import { parseHash } from './router.ts'

describe('parseHash', () => {
  test('empty and unknown hashes go home', () => {
    expect(parseHash('')).toEqual({ name: 'home' })
    expect(parseHash('#/nope')).toEqual({ name: 'home' })
  })

  test('named screens', () => {
    expect(parseHash('#/live')).toEqual({ name: 'live' })
    expect(parseHash('#/history')).toEqual({ name: 'history' })
    expect(parseHash('#/settings')).toEqual({ name: 'settings' })
  })

  test('a session id is decoded', () => {
    expect(parseHash('#/history/abc%20d')).toEqual({ name: 'session', id: 'abc d' })
    expect(parseHash('#/replay/abc%20d')).toEqual({ name: 'replay', id: 'abc d' })
  })

  test('a malformed link opens History instead of breaking the app', () => {
    expect(parseHash('#/history/%E0%A4%A')).toEqual({ name: 'history' })
    expect(parseHash('#/replay/%')).toEqual({ name: 'history' })
  })
})
