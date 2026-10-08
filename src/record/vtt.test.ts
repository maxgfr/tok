import { expect, test } from 'vitest'
import { chaptersVtt } from './vtt.ts'

test('one cue per rally, labelled with its count', () => {
  const vtt = chaptersVtt(
    [
      { index: 0, start: 1, end: 10.5, count: 5, best: true },
      { index: 2, start: 61.25, end: 3725, count: 1, best: false },
    ],
    'hits',
  )
  expect(vtt).toBe(
    'WEBVTT\n\n' +
      '00:00:01.000 --> 00:00:10.500\nRally 1 — 5 hits (best)\n\n' +
      '00:01:01.250 --> 01:02:05.000\nRally 3 — 1 hits\n',
  )
})
