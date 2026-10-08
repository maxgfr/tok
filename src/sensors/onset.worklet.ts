// Runs on the audio rendering thread: every 128-sample quantum goes through
// the onset detector, and only onsets and a ~30 Hz level trace cross over to
// the main thread.

import { OnsetDetector, type Level } from '../engine/onset.ts'

declare const sampleRate: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor(options?: unknown)
}

export interface OnsetProcessorOptions {
  bandHz: [number, number]
  refractoryMs: number
  threshold: number
}

/** `age`: seconds of audio processed since the event, by sample count. */
export type WorkletMessage =
  | { type: 'onset'; age: number; score: number; confidence: number }
  | ({ type: 'level'; age: number } & Level)

class OnsetProcessor extends AudioWorkletProcessor {
  private readonly detector: OnsetDetector
  /** Seconds of audio pushed so far: the detector's own clock. */
  private elapsed = 0
  private lastLevel = 0

  constructor(options: { processorOptions: OnsetProcessorOptions }) {
    super()
    const o = options.processorOptions
    this.detector = new OnsetDetector({
      sampleRate,
      bandHz: o.bandHz,
      refractoryMs: o.refractoryMs,
      threshold: o.threshold,
    })
    this.port.onmessage = (event: MessageEvent<{ type: 'threshold'; value: number }>) => {
      if (event.data.type === 'threshold') this.detector.threshold = event.data.value
    }
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel) return true
    const onsets = this.detector.push(channel)
    this.elapsed += channel.length / sampleRate
    for (const onset of onsets) {
      const message: WorkletMessage = {
        type: 'onset',
        age: this.elapsed - onset.t,
        score: onset.score,
        confidence: onset.confidence,
      }
      this.port.postMessage(message)
    }
    if (this.elapsed - this.lastLevel > 1 / 30) {
      this.lastLevel = this.elapsed
      const level: WorkletMessage = { type: 'level', age: 0, ...this.detector.level() }
      this.port.postMessage(level)
    }
    return true
  }
}

registerProcessor('tok-onset', OnsetProcessor)
