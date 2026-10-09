// Camera frames → vision worker → ball tracker → hit candidates and "ball on
// the ground" signals. Runs at ~15 fps and never queues: a frame is only sent
// when the previous one is answered. One worker serves the whole session.

import { perfToEpoch } from '../device/clock.ts'
import { BallTracker } from '../engine/ballTrack.ts'
import type { HitCandidate } from '../engine/types.ts'
import type { VisionReply, VisionRequest } from './vision.worker.ts'

export interface VisionOptions {
  video: HTMLVideoElement
  refractoryMs: number
  onCandidate: (candidate: HitCandidate) => void
  onGround: (t: number) => void
  onReady: (mode: 'mediapipe' | 'motion') => void
}

const FRAME_MS = 66

type Mode = 'mediapipe' | 'motion'

interface SharedWorker {
  worker: Worker
  ready: Promise<Mode>
  /** The running session's handler for ball replies. */
  listener: ((reply: Extract<VisionReply, { type: 'ball' }>) => void) | null
}

let shared: SharedWorker | null = null

/**
 * The vision worker, created and initialised once: turning the camera off and
 * on again during a session does not reload the model.
 */
export function getVisionWorker(): SharedWorker {
  if (shared) return shared
  const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' })
  let resolveReady: (mode: Mode) => void = () => {}
  const self: SharedWorker = {
    worker,
    ready: new Promise<Mode>((resolve) => (resolveReady = resolve)),
    listener: null,
  }
  worker.onmessage = (event: MessageEvent<VisionReply>) => {
    const m = event.data
    if (m.type === 'ready') resolveReady(m.mode)
    else self.listener?.(m)
  }
  const init: VisionRequest = {
    type: 'init',
    base: new URL(import.meta.env.BASE_URL, location.href).href,
  }
  worker.postMessage(init)
  shared = self
  return self
}

/** Ends the worker and frees the model: when the session screen closes. */
export function releaseVisionWorker(): void {
  shared?.worker.terminate()
  shared = null
}

export function startVision(opts: VisionOptions): { stop: () => void } {
  const vision = getVisionWorker()
  const tracker = new BallTracker({ refractoryMs: opts.refractoryMs })
  const send = (message: VisionRequest, transfer: Transferable[] = []) =>
    vision.worker.postMessage(message, transfer)
  const startedAt = performance.now()
  let width = 0 // until the model is ready
  let busy = false
  let stopped = false
  let last = -Infinity
  let frameRequest = 0
  let timer = 0

  const listener: SharedWorker['listener'] = (m) => {
    // A reply to a frame sent by an earlier session of the same worker.
    if (stopped || m.t < startedAt) return
    busy = false
    for (const e of tracker.push(m.t, m.ball ? { t: m.t, ...m.ball } : null)) {
      if (e.type === 'hit') opts.onCandidate({ ...e.candidate, t: perfToEpoch(e.candidate.t) })
      else opts.onGround(perfToEpoch(e.t))
    }
  }
  vision.listener = listener

  const capture = () => {
    const v = opts.video
    const now = performance.now()
    if (!width || busy || stopped || v.readyState < 2 || !v.videoWidth) return
    if (now - last < FRAME_MS) return
    last = now
    busy = true
    // Monotonic here; converted to epoch when an event leaves the tracker.
    const t = now
    createImageBitmap(v, {
      resizeWidth: width,
      resizeHeight: Math.round((width * v.videoHeight) / v.videoWidth),
    }).then(
      (bitmap) => {
        if (stopped) bitmap.close()
        else send({ type: 'frame', bitmap, t }, [bitmap])
      },
      () => {
        busy = false
      },
    )
  }

  // Paced by the camera's own frames where the browser says when one is new.
  const video = opts.video
  const paced = typeof video.requestVideoFrameCallback === 'function'
  const onFrame = () => {
    if (stopped) return
    frameRequest = video.requestVideoFrameCallback(onFrame)
    capture()
  }

  void vision.ready.then((mode) => {
    if (stopped) return
    // The detector's input is 320 px square; the fallback diffs a 96 px thumbnail.
    width = mode === 'mediapipe' ? 320 : 96
    send({ type: 'reset' })
    opts.onReady(mode)
    if (paced) frameRequest = video.requestVideoFrameCallback(onFrame)
    else timer = window.setInterval(capture, FRAME_MS)
  })

  return {
    stop: () => {
      stopped = true
      if (paced && frameRequest) video.cancelVideoFrameCallback(frameRequest)
      window.clearInterval(timer)
      if (vision.listener === listener) vision.listener = null
    },
  }
}
