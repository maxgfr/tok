import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { DEFAULT_THRESHOLD } from '../engine/onset.ts'
import { clearAll, setSetting } from '../store/db.ts'
import {
  loadStoredThreshold,
  loadThreshold,
  loadVoiceFilter,
  MAX_THRESHOLD,
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

test('an old threshold beyond the range comes back into it', async () => {
  await setSetting('threshold:beach-rackets', 500)
  expect(await loadThreshold('beach-rackets')).toBe(MAX_THRESHOLD)
  expect(await loadStoredThreshold('beach-rackets')).toBe(MAX_THRESHOLD)
})
