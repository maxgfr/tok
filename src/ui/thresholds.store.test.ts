import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { DEFAULT_THRESHOLD } from '../engine/onset.ts'
import { clearAll } from '../store/db.ts'
import {
  loadThreshold,
  loadVoiceFilter,
  resetThreshold,
  saveThreshold,
  saveVoiceFilter,
} from './thresholds.ts'

beforeEach(async () => {
  await clearAll()
})

test('resetting a threshold brings back the default', async () => {
  await saveThreshold('beach-rackets', 20)
  expect(await loadThreshold('beach-rackets')).toBe(20)
  await resetThreshold('beach-rackets')
  expect(await loadThreshold('beach-rackets')).toBe(DEFAULT_THRESHOLD)
})

test('the voice filter is on by default and remembered per sport', async () => {
  expect(await loadVoiceFilter('table-tennis')).toBe(true)
  await saveVoiceFilter('table-tennis', false)
  expect(await loadVoiceFilter('table-tennis')).toBe(false)
  expect(await loadVoiceFilter('beach-rackets')).toBe(true)
})
