// Camera frame + score overlay drawn onto a canvas, captured as a stream and
// recorded: the exported video carries the count, chaptered by rally later.

import { pickRecordingFormat } from './chapters.ts'
import { drawOverlay, type OverlayState } from './overlay.ts'
import { openVideoWriter } from './videoStore.ts'
import type { VideoRef } from '../store/db.ts'

export interface Recording {
  stop: () => Promise<VideoRef | null>
}

const MAX_WIDTH = 1280

export async function startRecording(opts: {
  video: HTMLVideoElement
  audioTrack: MediaStreamTrack | null
  overlay: () => OverlayState
  name: string
}): Promise<Recording | null> {
  if (typeof MediaRecorder === 'undefined') return null
  const format = pickRecordingFormat((t) => MediaRecorder.isTypeSupported(t))
  if (!format) return null

  const { video } = opts
  const scale = Math.min(1, MAX_WIDTH / (video.videoWidth || MAX_WIDTH))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((video.videoWidth || 1280) * scale)
  canvas.height = Math.round((video.videoHeight || 720) * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  let frame = 0
  const draw = () => {
    frame = requestAnimationFrame(draw)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    drawOverlay(ctx, canvas.width, canvas.height, opts.overlay())
  }
  draw()

  const stream = canvas.captureStream(30)
  if (opts.audioTrack) stream.addTrack(opts.audioTrack.clone())
  const file = `${opts.name}.${format.ext}`
  const writer = await openVideoWriter(file)
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: 2_500_000,
  })
  recorder.ondataavailable = (e) => {
    if (e.data.size) writer.write(e.data)
  }
  const startedAt = Date.now()
  recorder.start(1000)

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          cancelAnimationFrame(frame)
          for (const track of stream.getTracks()) track.stop()
          void writer.close().then(
            (bytes) =>
              resolve(
                bytes
                  ? { file, store: writer.store, mimeType: format.mimeType, startedAt, bytes }
                  : null,
              ),
            () => resolve(null),
          )
        }
        if (recorder.state === 'inactive') recorder.onstop(new Event('stop'))
        else recorder.stop()
      }),
  }
}
