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
  })
})
