import { expect, test } from 'vitest'
import { DEFAULT_CONFIG, normalizeConfig } from './config.ts'

test('an unknown sport falls back to the default config', () => {
  expect(normalizeConfig({ sportId: 'curling' as never })).toEqual(DEFAULT_CONFIG)
})

test('a mode the sport does not offer is replaced by its first mode', () => {
  expect(normalizeConfig({ sportId: 'jump-rope', mode: 'match' }).mode).toBe('rally')
})

test('a new player counts by hand: Auto is experimental', () => {
  expect(DEFAULT_CONFIG.input).toBe('manual')
})
