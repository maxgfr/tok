import { beforeEach, expect, test } from 'vitest'
import { sport } from '../engine/sports.ts'
import { clearAll } from '../store/db.ts'
import { loadAutoEnd, loadGoal, saveAutoEnd, saveGoal } from './coach.ts'
import {
  loadRallyLimit,
  loadRules,
  resetSport,
  saveRallyLimit,
  saveRules,
} from './sportSettings.ts'

beforeEach(async () => {
  await clearAll()
})

test('a sport plays by its official rules until they are changed', async () => {
  expect(await loadRules('table-tennis')).toEqual(sport('table-tennis').scoring)
  await saveRules('table-tennis', { pointsToWin: 21, setsToWin: 2 })
  expect(await loadRules('table-tennis')).toMatchObject({
    kind: 'rally',
    pointsToWin: 21,
    setsToWin: 2,
    winBy: 2,
    serve: { every: 2, deuceEvery: 1 },
  })
  // Another sport keeps its own.
  expect(await loadRules('badminton')).toEqual(sport('badminton').scoring)
})

test('a sport without a match has no rules to change', async () => {
  expect(await loadRules('beach-rackets')).toBeNull()
})

test('rally mode has no limit on the number of rallies until one is set', async () => {
  expect(await loadRallyLimit('beach-rackets')).toBe(0)
  await saveRallyLimit('beach-rackets', 10)
  expect(await loadRallyLimit('beach-rackets')).toBe(10)
})

test('reset brings back every default of that sport, and only that sport', async () => {
  await saveRules('table-tennis', { pointsToWin: 21 })
  await saveRallyLimit('table-tennis', 5)
  await saveAutoEnd('table-tennis', 8)
  await saveGoal('table-tennis', 50)
  await saveGoal('badminton', 30)
  await resetSport('table-tennis')
  expect(await loadRules('table-tennis')).toEqual(sport('table-tennis').scoring)
  expect(await loadRallyLimit('table-tennis')).toBe(0)
  expect(await loadAutoEnd('table-tennis')).toBe(1.5)
  expect(await loadGoal('table-tennis')).toBe(0)
  expect(await loadGoal('badminton')).toBe(30)
})
