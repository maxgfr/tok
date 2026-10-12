// What tok itself makes the sensors pick up: its sounds and voice through the
// speaker, the phone's vibration, a finger tapping the screen, the mic's own
// pop as it opens. Each producer masks the stretch of time its noise lands in;
// a candidate is checked at the time it happened, not when its message
// arrived, since the mic, the speaker and Bluetooth all lag.
//
// Epoch ms, the clock every candidate carries (device/clock.ts).

import type { AutoSensor } from '../engine/sports.ts'

interface Mask {
  from: number
  to: number
  sources: readonly AutoSensor[]
}

const ALL: readonly AutoSensor[] = ['audio', 'motion', 'vision']

/** A mask is kept this long after it ends: candidates reach us late. */
const KEEP_MS = 5000

let masks: Mask[] = []

/**
 * Ignores `sources` between `fromEpoch` and `toEpoch`. Returns a function that
 * moves the end, for noise whose length is only known once it stops.
 */
export function maskNoise(
  fromEpoch: number,
  toEpoch: number,
  sources: readonly AutoSensor[] = ALL,
): (toEpoch: number) => void {
  const cutoff = Date.now() - KEEP_MS
  masks = masks.filter((m) => m.to >= cutoff)
  const mask: Mask = { from: fromEpoch, to: toEpoch, sources }
  masks.push(mask)
  return (to) => {
    mask.to = to
  }
}

/** True when a candidate from `source` at `t` is tok's own noise. */
export function isSelfNoise(t: number, source: AutoSensor): boolean {
  return masks.some((m) => t >= m.from && t <= m.to && m.sources.includes(source))
}

/** A tap is heard from just before the finger lands (the event lags) until it has rung out. */
const TAP_BEFORE_MS = 80
const TAP_AFTER_MS = 300

/**
 * Masks every touch on the page: a finger on the glass is loud to the mic
 * and felt by the accelerometer. Returns the cleanup.
 */
export function maskTouches(target: EventTarget = window): () => void {
  const onDown = () => {
    const now = Date.now()
    maskNoise(now - TAP_BEFORE_MS, now + TAP_AFTER_MS, ['audio', 'motion'])
  }
  target.addEventListener('pointerdown', onDown, { capture: true })
  return () => target.removeEventListener('pointerdown', onDown, { capture: true })
}

/** Forgets every mask: tests. */
export function clearSelfNoise(): void {
  masks = []
}
