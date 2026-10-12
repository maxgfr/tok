// Runs on the audio rendering thread: every 128-sample quantum goes through
// the onset detector, and only onsets cross over to the main thread, plus a
// ~30 Hz level trace while a screen draws it.
//
// It also keeps the last `TAPE_SECONDS` of sound and the onsets found in it,
// handed over on request: real recordings to tune and test the detector with.

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

/** Seconds of sound kept for "Save last 20 s" (3.8 MB at 48 kHz). */
export const TAPE_SECONDS = 20

/** An onset of a tape: `t` in seconds from the tape's start. */
export interface TapeOnset {
  t: number
  score: number
  confidence: number
  print: number[]
}

/** Main thread → worklet: settings changed while it runs, or a tape wanted. */
export type ProcessorCommand =
  | { type: 'threshold'; value: number }
  | { type: 'voiceFilter'; on: boolean }
  | { type: 'levels'; on: boolean }
  | { type: 'tape' }

/** `age`: seconds of audio processed since the event, by sample count. */
export type WorkletMessage =
  | { type: 'onset'; age: number; score: number; confidence: number; print: number[] }
  /** `rejected`: sounds the voice filter has set aside so far. */
  | ({ type: 'level'; age: number; rejected: number } & Level)
  /** The last seconds of sound, oldest first, and their onsets. */
  | { type: 'tape'; sampleRate: number; samples: Float32Array; onsets: TapeOnset[] }

class OnsetProcessor extends AudioWorkletProcessor {
  private readonly detector: OnsetDetector
  /** Seconds of audio pushed so far: the detector's own clock. */
  private elapsed = 0
  private lastLevel = 0
  private levels: boolean
  private readonly tape = new Float32Array(Math.round(sampleRate * TAPE_SECONDS))
  private tapePos = 0
  private tapeFilled = 0
  /** Onsets of the tape, on the detector's clock. */
  private tapeOnsets: TapeOnset[] = []

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
      else if (data.type === 'levels') this.levels = data.on
      else this.sendTape()
    }
  }

  private record(channel: Float32Array): void {
    const { tape } = this
    for (let i = 0; i < channel.length; i += 1) {
      tape[this.tapePos] = channel[i]!
      this.tapePos = (this.tapePos + 1) % tape.length
    }
    this.tapeFilled = Math.min(tape.length, this.tapeFilled + channel.length)
  }

  private sendTape(): void {
    const { tape } = this
    const samples = new Float32Array(this.tapeFilled)
    const start = (this.tapePos - this.tapeFilled + tape.length) % tape.length
    for (let i = 0; i < samples.length; i += 1) samples[i] = tape[(start + i) % tape.length]!
    const from = this.elapsed - samples.length / sampleRate
    const onsets = this.tapeOnsets
      .filter((o) => o.t >= from)
      .map(({ t, score, confidence, print }) => ({ t: t - from, score, confidence, print }))
    const message: WorkletMessage = { type: 'tape', sampleRate, samples, onsets }
    this.port.postMessage(message, [samples.buffer])
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel) return true
    const onsets = this.detector.push(channel)
    this.record(channel)
    this.elapsed += channel.length / sampleRate
    if (onsets.length) {
      this.tapeOnsets.push(...onsets)
      const from = this.elapsed - TAPE_SECONDS
      while (this.tapeOnsets.length && this.tapeOnsets[0]!.t < from) this.tapeOnsets.shift()
    }
    for (const onset of onsets) {
      const message: WorkletMessage = {
        type: 'onset',
        age: this.elapsed - onset.t,
        score: onset.score,
        confidence: onset.confidence,
        print: onset.print,
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
