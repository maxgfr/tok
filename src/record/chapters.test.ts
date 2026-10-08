import { describe, expect, test } from 'vitest'
import type { Rally } from '../engine/types.ts'
import { chapters, pickRecordingFormat } from './chapters.ts'

const rally = (startedAt: number, endedAt: number, n: number): Rally => ({
  startedAt,
  endedAt,
  hits: Array.from({ length: n }, (_, i) => ({
    t: startedAt + i,
    sources: ['audio'],
    confidence: 1,
  })),
  endReason: 'timeout',
})

describe('chapters', () => {
  test('one chapter per rally, in seconds from the start of the video, with a pre-roll', () => {
    const list = chapters([rally(12_000, 20_000, 5), rally(30_000, 31_000, 2)], 10_000, 1)
    expect(list).toEqual([
      { index: 0, start: 1, end: 10.5, count: 5, best: true },
      { index: 1, start: 19, end: 21.5, count: 2, best: false },
    ])
  })

  test('a rally that started before the recording is clamped to 0', () => {
    expect(chapters([rally(9_500, 12_000, 3)], 10_000, 1)[0]?.start).toBe(0)
  })

  test('rallies that ended before the recording began are left out', () => {
    expect(chapters([rally(1_000, 2_000, 3)], 10_000, 1)).toEqual([])
  })

  test('points without hits are not chapters', () => {
    expect(chapters([rally(12_000, 12_000, 0)], 10_000, 1)).toEqual([])
  })
})

describe('pickRecordingFormat', () => {
  test('prefers MP4 so the file plays everywhere', () => {
    expect(pickRecordingFormat(() => true)).toEqual({
      mimeType: 'video/mp4;codecs=avc1',
      ext: 'mp4',
    })
  })

  test('falls back to WebM', () => {
    expect(pickRecordingFormat((t) => t.startsWith('video/webm'))).toEqual({
      mimeType: 'video/webm;codecs=vp9,opus',
      ext: 'webm',
    })
  })

  test('null when nothing is supported', () => {
    expect(pickRecordingFormat(() => false)).toBeNull()
  })
})
