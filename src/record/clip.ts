// One rally cut out of a session recording, as its own MP4 to share. The
// recording opens on a key frame at each rally, but a clip starts a beat
// earlier, so the cut is re-encoded rather than copied. Mediabunny is loaded
// only when a clip is asked for.

/** The part of `recording` from `start` to `end` seconds, as an MP4. */
export async function exportClip(recording: Blob, start: number, end: number): Promise<Blob> {
  const { BlobSource, BufferTarget, Conversion, Input, MP4, Mp4OutputFormat, Output, WEBM } =
    await import('mediabunny')
  // Only the containers tok itself writes.
  const input = new Input({ source: new BlobSource(recording), formats: [MP4, WEBM] })
  try {
    const target = new BufferTarget()
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target })
    const duration = await input.computeDuration()
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: Math.max(0, start), end: Math.min(end, duration) },
      showWarnings: false,
    })
    if (!conversion.isValid) throw new Error('This recording cannot be cut on this device.')
    await conversion.execute()
    if (!target.buffer) throw new Error('The clip came out empty.')
    return new Blob([target.buffer], { type: 'video/mp4' })
  } finally {
    input.dispose()
  }
}
