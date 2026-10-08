// Camera frames → vision worker → ball tracker → hit candidates and "ball on
// the ground" signals. Runs at ~15 fps and never queues: a frame is only sent
// when the previous one is answered.

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

export function startVision(opts: VisionOptions): { stop: () => void } {
  const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' })
  const tracker = new BallTracker({ refractoryMs: opts.refractoryMs })
  const send = (message: VisionRequest, transfer: Transferable[] = []) =>
    worker.postMessage(message, transfer)
  let busy = true // until the model is ready
  let stopped = false

  worker.onmessage = (event: MessageEvent<VisionReply>) => {
    const m = event.data
    if (m.type === 'ready') {
      busy = false
      opts.onReady(m.mode)
      return
    }
    busy = false
    for (const e of tracker.push(m.t, m.ball ? { t: m.t, ...m.ball } : null)) {
      if (e.type === 'hit') opts.onCandidate(e.candidate)
      else opts.onGround(e.t)
    }
  }
  send({ type: 'init', base: new URL(import.meta.env.BASE_URL, location.href).href })

  const timer = window.setInterval(() => {
    const v = opts.video
    if (busy || stopped || v.readyState < 2 || !v.videoWidth) return
    busy = true
    const t = performance.timeOrigin + performance.now()
    createImageBitmap(v, {
      resizeWidth: 640,
      resizeHeight: Math.round((640 * v.videoHeight) / v.videoWidth),
    }).then(
      (bitmap) => {
        if (stopped) bitmap.close()
        else send({ type: 'frame', bitmap, t }, [bitmap])
      },
      () => {
        busy = false
      },
    )
  }, FRAME_MS)

  return {
    stop: () => {
      stopped = true
      window.clearInterval(timer)
      worker.terminate()
    },
  }
}
