// DeviceMotion → impact candidates. iOS asks permission, and only from a tap.

import { perfToEpoch } from '../device/clock.ts'
import { MotionPeakDetector, type MotionCandidate } from '../engine/motionPeaks.ts'
import { primeMotion } from './prime.ts'

/** Some browsers stamp motion events on another clock; trust it only when plausible. */
const saneStamp = (stamp: number): number => {
  const now = performance.now()
  return Math.abs(now - stamp) < 1000 ? stamp : now
}

export interface MotionSensor {
  stop: () => void
}

export interface MotionOptions {
  refractoryMs: number
  onCandidate: (candidate: MotionCandidate) => void
  /** Called once if no motion event arrives (desktop, or sensors disabled). */
  onSilent: () => void
}

export async function startMotion(options: MotionOptions): Promise<MotionSensor> {
  if (typeof DeviceMotionEvent === 'undefined') {
    throw new DOMException('No motion sensors', 'NotSupportedError')
  }
  if (!(await primeMotion())) throw new DOMException('Motion access denied', 'NotAllowedError')
  const detector = new MotionPeakDetector({ refractoryMs: options.refractoryMs })
  let heard = false
  const onMotion = (event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity
    if (a?.x == null || a.y == null || a.z == null) return
    heard = true
    const candidate = detector.push({
      t: perfToEpoch(saneStamp(event.timeStamp)),
      x: a.x,
      y: a.y,
      z: a.z,
    })
    if (candidate) options.onCandidate(candidate)
  }
  window.addEventListener('devicemotion', onMotion)
  const silence = window.setTimeout(() => {
    if (!heard) options.onSilent()
  }, 1500)
  return {
    stop: () => {
      window.clearTimeout(silence)
      window.removeEventListener('devicemotion', onMotion)
    },
  }
}
