// Recording through WebCodecs: each canvas frame is encoded with the timestamp
// it was drawn for, and the muxer writes a fragmented MP4 straight to the
// sink. Fragmented keeps memory flat however long the session runs, and a
// key frame can be asked for at any moment (a rally starting), so a replay or
// a clip can start exactly there. Loaded only where WebCodecs exists.

import {
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  MediaStreamAudioTrackSource,
  Mp4OutputFormat,
  Output,
  QUALITY_MEDIUM,
  StreamTarget,
  type AudioCodec,
  type VideoCodec,
} from 'mediabunny'
import type { VideoChunk } from './videoStore.ts'

export interface Codecs {
  video: VideoCodec
  audio: AudioCodec | null
}

// H.264/AAC first: what every phone plays and every app accepts as a share.
const VIDEO: VideoCodec[] = ['avc', 'vp9', 'av1']
const AUDIO: AudioCodec[] = ['aac', 'opus']

/** The codecs this browser can encode into an MP4 at this size, or null. */
export async function pickCodecs(
  width: number,
  height: number,
  withAudio: boolean,
): Promise<Codecs | null> {
  if (typeof VideoEncoder === 'undefined') return null
  const format = new Mp4OutputFormat()
  const video = await getFirstEncodableVideoCodec(
    VIDEO.filter((c) => format.getSupportedVideoCodecs().includes(c)),
    { width, height },
  )
  if (!video) return null
  const audio =
    withAudio && typeof AudioEncoder !== 'undefined'
      ? await getFirstEncodableAudioCodec(
          AUDIO.filter((c) => format.getSupportedAudioCodecs().includes(c)),
        )
      : null
  return { video, audio }
}

export interface Encoder {
  /** Encodes the canvas as it is now, at `t` seconds into the video. */
  frame: (t: number) => Promise<void>
  /** The next frame becomes a key frame. */
  keyFrameNext: () => void
  /** Ends the file. */
  finish: () => Promise<void>
  cancel: () => Promise<void>
}

export async function startEncoder({
  canvas,
  audioTrack,
  stream,
  codecs,
}: {
  canvas: HTMLCanvasElement | OffscreenCanvas
  audioTrack: MediaStreamAudioTrack | null
  stream: WritableStream<VideoChunk>
  codecs: Codecs
}): Promise<Encoder> {
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'fragmented' }),
    target: new StreamTarget(stream, { chunked: true }),
  })
  const video = new CanvasSource(canvas, {
    codec: codecs.video,
    quality: QUALITY_MEDIUM,
    keyFrameInterval: 2,
    latencyMode: 'realtime',
  })
  // No frameRate: it would snap timestamps to a grid, and they are exact.
  output.addVideoTrack(video)
  if (audioTrack && codecs.audio) {
    // Zero at its own first sample, as the video is at its first frame.
    const audio = new MediaStreamAudioTrackSource(
      audioTrack,
      { codec: codecs.audio, quality: QUALITY_MEDIUM },
      { timestampBase: 'zero' },
    )
    output.addAudioTrack(audio)
  }
  await output.start()

  let keyFrame = false
  return {
    frame: (t) => {
      const options = keyFrame ? { keyFrame: true } : undefined
      keyFrame = false
      return video.add(t, undefined, options)
    },
    keyFrameNext: () => {
      keyFrame = true
    },
    finish: () => output.finalize(),
    cancel: () => output.cancel(),
  }
}
