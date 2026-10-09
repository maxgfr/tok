// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { judgeRally } from './judge.ts'

const base = { best: 40, todayBest: 20, sessionBest: 15, goal: 0 }

describe('judgeRally', () => {
  test('beating every rally ever is a record', () => {
    expect(judgeRally(41, base)).toEqual({ record: true, todayBest: false, goal: null })
  })

  test('beating today but not the record is a best of the day', () => {
    expect(judgeRally(25, base)).toEqual({ record: false, todayBest: true, goal: null })
  })

  test('this session counts as today', () => {
    expect(judgeRally(18, { ...base, todayBest: 0, sessionBest: 19 })).toEqual({
      record: false,
      todayBest: false,
      goal: null,
    })
  })

  test('a single hit is never a celebration', () => {
    expect(judgeRally(1, { best: 0, todayBest: 0, sessionBest: 0, goal: 0 })).toEqual({
      record: false,
      todayBest: false,
      goal: null,
    })
  })

  test('the first rally of the day to reach the goal reaches it', () => {
    expect(judgeRally(30, { ...base, goal: 30 }).goal).toBe(30)
  })

  test('the goal is not celebrated again once reached today', () => {
    expect(judgeRally(31, { ...base, todayBest: 30, goal: 30 }).goal).toBeNull()
  })
})
