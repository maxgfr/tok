// Runs on the audio rendering thread: every 128-sample quantum goes through
// the onset detector, and only onsets and a ~30 Hz level trace cross over to
// the main thread.

import { OnsetDetector, type Level } from '../engine/onset.ts'

declare const sampleRate: number
declare const currentTime: number
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

export type WorkletMessage =
  | { type: 'onset'; contextTime: number; score: number; confidence: number }
  | ({ type: 'level'; contextTime: number } & Level)

class OnsetProcessor extends AudioWorkletProcessor {
  private readonly detector: OnsetDetector
  private start: number | null = null
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
    this.start ??= currentTime
    for (const onset of this.detector.push(channel)) {
      const message: WorkletMessage = {
        type: 'onset',
        contextTime: this.start + onset.t,
        score: onset.score,
        confidence: onset.confidence,
      }
      this.port.postMessage(message)
    }
    if (currentTime - this.lastLevel > 1 / 30) {
      this.lastLevel = currentTime
      const level: WorkletMessage = {
        type: 'level',
        contextTime: currentTime,
        ...this.detector.level(),
      }
      this.port.postMessage(level)
    }
    return true
  }
}

registerProcessor('tok-onset', OnsetProcessor)
