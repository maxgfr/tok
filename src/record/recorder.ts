// Camera frame + score overlay drawn onto a canvas and recorded: the exported
// video carries the count, chaptered by rally later. Where WebCodecs exists the
// canvas is encoded frame by frame into an MP4 with exact timestamps (and a key
// frame at each rally); elsewhere it is captured as a stream for MediaRecorder.

import { perfToEpoch } from '../device/clock.ts'
import { pickRecordingFormat } from './chapters.ts'
import { drawOverlay, type OverlayState } from './overlay.ts'
import { deleteVideo, openVideoSink, openVideoWriter } from './videoStore.ts'
import type { VideoRef } from '../store/db.ts'

export interface Recording {
  stop: () => Promise<VideoRef | null>
  /** A rally is starting: the next frame is a key frame, so a clip can start there. */
  markRally: () => void
}

interface Options {
  video: HTMLVideoElement
  audioTrack: MediaStreamTrack | null
  overlay: () => OverlayState
  name: string
}

const MAX_WIDTH = 1280
/** Without frame callbacks, draw at most this often. */
const FRAME_MS = 1000 / 30

/**
 * Calls `onFrame(perfMs, mediaSeconds)` once per new camera frame where the
 * browser says when one is ready, else on animation frames at up to 30 fps.
 */
function frameLoop(
  video: HTMLVideoElement,
  onFrame: (perfMs: number, mediaSeconds: number | null) => void,
): () => void {
  let stopped = false
  if (typeof video.requestVideoFrameCallback === 'function') {
    let handle = 0
    const tick: VideoFrameRequestCallback = (now, meta) => {
      if (stopped) return
      handle = video.requestVideoFrameCallback(tick)
      onFrame(now, meta.mediaTime)
    }
    handle = video.requestVideoFrameCallback(tick)
    return () => {
      stopped = true
      video.cancelVideoFrameCallback(handle)
    }
  }
  let handle = 0
  let last = -Infinity
  const tick = (now: number) => {
    if (stopped) return
    handle = requestAnimationFrame(tick)
    if (now - last < FRAME_MS - 2) return
    last = now
    onFrame(now, null)
  }
  handle = requestAnimationFrame(tick)
  return () => {
    stopped = true
    cancelAnimationFrame(handle)
  }
}

function frameCanvas(video: HTMLVideoElement) {
  const scale = Math.min(1, MAX_WIDTH / (video.videoWidth || MAX_WIDTH))
  const canvas = document.createElement('canvas')
  // Even sizes: H.264 encoders reject odd ones.
  canvas.width = Math.round(((video.videoWidth || 1280) * scale) / 2) * 2
  canvas.height = Math.round(((video.videoHeight || 720) * scale) / 2) * 2
  const ctx = canvas.getContext('2d')
  return ctx ? { canvas, ctx } : null
}

export async function startRecording(opts: Options): Promise<Recording | null> {
  if (typeof VideoEncoder !== 'undefined') {
    const recording = await startEncoded(opts).catch(() => null)
    if (recording) return recording
  }
  return startMediaRecorder(opts)
}

async function startEncoded(opts: Options): Promise<Recording | null> {
  const { video } = opts
  const frame = frameCanvas(video)
  if (!frame) return null
  const { canvas, ctx } = frame
  const { pickCodecs, startEncoder } = await import('./encoder.ts')
  const codecs = await pickCodecs(canvas.width, canvas.height, !!opts.audioTrack)
  if (!codecs) return null

  const file = `${opts.name}.mp4`
  const sink = await openVideoSink(file)
  const audioTrack = opts.audioTrack?.clone() ?? null
  let encoder: Awaited<ReturnType<typeof startEncoder>>
  try {
    encoder = await startEncoder({
      canvas,
      audioTrack: audioTrack as MediaStreamAudioTrack | null,
      stream: sink.stream,
      codecs,
    })
  } catch (error) {
    audioTrack?.stop()
    await sink.stream.abort(error).catch(() => {})
    await deleteVideo({ file, store: sink.store, mimeType: 'video/mp4', startedAt: 0, bytes: 0 })
    throw error
  }

  let startedAt = 0
  let firstPerf = 0
  let firstMedia: number | null = null
  let lastT = -1
  let pending: Promise<void> | null = null
  let failed = false
  const stopLoop = frameLoop(video, (now, mediaTime) => {
    // The encoder is still busy with the last frame: drop this one rather than queue.
    if (pending || failed) return
    if (!startedAt) {
      startedAt = perfToEpoch(now)
      firstPerf = now
      firstMedia = mediaTime
    }
    // The camera's own clock where it has one, so frames keep their real spacing.
    let t =
      mediaTime !== null && firstMedia !== null ? mediaTime - firstMedia : (now - firstPerf) / 1000
    if (t <= lastT) t = (now - firstPerf) / 1000
    if (t <= lastT) return
    lastT = t
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    drawOverlay(ctx, canvas.width, canvas.height, opts.overlay())
    pending = encoder.frame(t).then(
      () => {
        pending = null
      },
      () => {
        failed = true
        pending = null
      },
    )
  })

  return {
    markRally: () => encoder.keyFrameNext(),
    stop: async () => {
      stopLoop()
      await pending
      const ref: VideoRef = { file, store: sink.store, mimeType: 'video/mp4', startedAt, bytes: 0 }
      try {
        if (!startedAt) throw new Error('nothing recorded')
        // After an encoder failure, what was encoded up to it is still a video.
        await encoder.finish()
        return { ...ref, bytes: await sink.saved }
      } catch {
        await encoder.cancel().catch(() => {})
        // Cancelling closes the sink, which saves what it holds: wait for that,
        // then remove it, so no file is left that no session points to.
        await Promise.race([sink.saved.catch(() => 0), new Promise((r) => setTimeout(r, 2000))])
        await deleteVideo(ref)
        return null
      } finally {
        audioTrack?.stop()
      }
    },
  }
}

async function startMediaRecorder(opts: Options): Promise<Recording | null> {
  if (typeof MediaRecorder === 'undefined') return null
  const format = pickRecordingFormat((t) => MediaRecorder.isTypeSupported(t))
  if (!format) return null
  const { video } = opts
  const frame = frameCanvas(video)
  if (!frame) return null
  const { canvas, ctx } = frame

  const file = `${opts.name}.${format.ext}`
  const writer = await openVideoWriter(file)
  const stream = canvas.captureStream(30)
  if (opts.audioTrack) stream.addTrack(opts.audioTrack.clone())
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      videoBitsPerSecond: 2_500_000,
    })
  } catch (error) {
    for (const track of stream.getTracks()) track.stop()
    await writer.close().catch(() => 0)
    throw error
  }
  recorder.ondataavailable = (e) => {
    if (e.data.size) writer.write(e.data)
  }
  // Drawing starts once there is something to record it.
  const stopLoop = frameLoop(video, () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    drawOverlay(ctx, canvas.width, canvas.height, opts.overlay())
  })
  const startedAt = Date.now()
  recorder.start(1000)

  return {
    markRally: () => {},
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          stopLoop()
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
