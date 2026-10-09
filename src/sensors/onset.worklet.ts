// Runs on the audio rendering thread: every 128-sample quantum goes through
// the onset detector, and only onsets cross over to the main thread, plus a
// ~30 Hz level trace while a screen draws it.

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
  voiceFilter: boolean
  /** Post the level trace; off unless a screen shows it. */
  levels: boolean
}

/** Main thread → worklet: settings changed while it runs. */
export type ProcessorCommand =
  | { type: 'threshold'; value: number }
  | { type: 'voiceFilter'; on: boolean }
  | { type: 'levels'; on: boolean }

/** `age`: seconds of audio processed since the event, by sample count. */
export type WorkletMessage =
  | { type: 'onset'; age: number; score: number; confidence: number }
  /** `rejected`: sounds the voice filter has set aside so far. */
  | ({ type: 'level'; age: number; rejected: number } & Level)

class OnsetProcessor extends AudioWorkletProcessor {
  private readonly detector: OnsetDetector
  /** Seconds of audio pushed so far: the detector's own clock. */
  private elapsed = 0
  private lastLevel = 0
  private levels: boolean

  constructor(options: { processorOptions: OnsetProcessorOptions }) {
    super()
    const o = options.processorOptions
    this.detector = new OnsetDetector({
      sampleRate,
      bandHz: o.bandHz,
      refractoryMs: o.refractoryMs,
      threshold: o.threshold,
      voiceFilter: o.voiceFilter,
    })
    this.levels = o.levels
    this.port.onmessage = ({ data }: MessageEvent<ProcessorCommand>) => {
      if (data.type === 'threshold') this.detector.threshold = data.value
      else if (data.type === 'voiceFilter') this.detector.voiceFilter = data.on
      else this.levels = data.on
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
    if (this.levels && this.elapsed - this.lastLevel > 1 / 30) {
      this.lastLevel = this.elapsed
      const level: WorkletMessage = {
        type: 'level',
        age: 0,
        rejected: this.detector.rejected,
        ...this.detector.level(),
      }
      this.port.postMessage(level)
    }
    return true
  }
}

registerProcessor('tok-onset', OnsetProcessor)
