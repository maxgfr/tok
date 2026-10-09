// Ball detection off the main thread. MediaPipe's EfficientDet-Lite0 looks for
// a "sports ball" in each frame; if it cannot load (old GPU, no SIMD…), a
// frame-difference tracker follows the smallest moving blob instead.

import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'
import { lockToOrigin } from './networkLock.ts'

// Before any MediaPipe code runs: the page's CSP does not reach this worker.
lockToOrigin(self as unknown as Parameters<typeof lockToOrigin>[0])

export type VisionRequest =
  | { type: 'init'; base: string }
  /** A new run of frames: forget the last one. */
  | { type: 'reset' }
  | { type: 'frame'; bitmap: ImageBitmap; t: number }

export type VisionReply =
  | { type: 'ready'; mode: 'mediapipe' | 'motion' }
  | { type: 'ball'; t: number; ball: { x: number; y: number; score: number } | null }

let detector: ObjectDetector | null = null
let mode: 'mediapipe' | 'motion' = 'motion'

const post = (message: VisionReply) => (self as unknown as Worker).postMessage(message)

async function init(base: string): Promise<void> {
  try {
    const fileset = await FilesetResolver.forVisionTasks(`${base}models/mediapipe`, true)
    const create = (delegate: 'GPU' | 'CPU') =>
      ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${base}models/efficientdet_lite0.tflite`, delegate },
        runningMode: 'VIDEO',
        scoreThreshold: 0.25,
        maxResults: 3,
        categoryAllowlist: ['sports ball'],
      })
    detector = await create('GPU').catch(() => create('CPU'))
    mode = 'mediapipe'
  } catch {
    detector = null
    mode = 'motion'
  }
  post({ type: 'ready', mode })
}

// -- Fallback: frame difference on a tiny grayscale copy ----------------------
const W = 96
const H = 54
let ctx: OffscreenCanvasRenderingContext2D | null = null
// Two grayscale frames, swapped: this one and the one before.
let gray = new Uint8ClampedArray(W * H)
let previous = new Uint8ClampedArray(W * H)
let hasPrevious = false

function motionBall(bitmap: ImageBitmap) {
  ctx ??= new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, W, H)
  const { data } = ctx.getImageData(0, 0, W, H)
  const before = previous
  previous = gray
  gray = before
  const current = previous
  for (let i = 0; i < W * H; i += 1) {
    current[i] = (data[i * 4]! * 3 + data[i * 4 + 1]! * 6 + data[i * 4 + 2]!) / 10
  }
  const compare = hasPrevious
  hasPrevious = true
  if (!compare) return null
  let n = 0
  let sx = 0
  let sy = 0
  for (let i = 0; i < W * H; i += 1) {
    if (Math.abs(current[i]! - before[i]!) > 40) {
      n += 1
      sx += i % W
      sy += Math.floor(i / W)
    }
  }
  // A ball is a small mover; a player walking through the frame is not.
  if (n < 3 || n > 120) return null
  return { x: sx / n / W, y: sy / n / H, score: 0.3 }
}

self.onmessage = async (event: MessageEvent<VisionRequest>) => {
  const m = event.data
  if (m.type === 'init') return init(m.base)
  if (m.type === 'reset') {
    hasPrevious = false
    return
  }
  let ball: { x: number; y: number; score: number } | null = null
  try {
    if (detector) {
      const result = detector.detectForVideo(m.bitmap, m.t)
      const best = result.detections
        .filter((d) => d.boundingBox)
        .sort((a, b) => (b.categories[0]?.score ?? 0) - (a.categories[0]?.score ?? 0))[0]
      if (best?.boundingBox) {
        const box = best.boundingBox
        ball = {
          x: (box.originX + box.width / 2) / m.bitmap.width,
          y: (box.originY + box.height / 2) / m.bitmap.height,
          score: best.categories[0]?.score ?? 0,
        }
      }
    } else {
      ball = motionBall(m.bitmap)
    }
  } finally {
    m.bitmap.close()
  }
  post({ type: 'ball', t: m.t, ball })
}
