// Microphone → AudioWorklet onset detector → hit candidates on the epoch clock.

import type { Level } from '../engine/onset.ts'
import type { HitCandidate } from '../engine/types.ts'
import workletUrl from './onset.worklet.ts?worker&url'
import type { OnsetProcessorOptions, WorkletMessage } from './onset.worklet.ts'

let context: AudioContext | null = null

/**
 * Creates (or resumes) the AudioContext. Call it inside the tap that starts a
 * session: iOS only lets audio start from a user gesture.
 */
export function primeAudio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  context ??= new AudioContext({ latencyHint: 'interactive' })
  if (context.state === 'suspended') void context.resume()
  return context
}

export interface AudioCandidate extends HitCandidate {
  score: number
}

export interface TimedLevel extends Level {
  t: number
}

export interface AudioSensor {
  setThreshold: (value: number) => void
  stop: () => void
}

export interface AudioOptions extends OnsetProcessorOptions {
  onCandidate: (candidate: AudioCandidate) => void
  onLevel?: (level: TimedLevel) => void
}

/** Maps an AudioContext time to epoch ms, the clock every hit lives on. */
function toEpoch(ctx: AudioContext, contextTime: number): number {
  const stamp = ctx.getOutputTimestamp?.()
  if (stamp?.contextTime !== undefined && stamp.performanceTime !== undefined) {
    return performance.timeOrigin + stamp.performanceTime + (contextTime - stamp.contextTime) * 1000
  }
  return performance.timeOrigin + performance.now() - (ctx.currentTime - contextTime) * 1000
}

export async function startAudio(options: AudioOptions): Promise<AudioSensor> {
  const ctx = primeAudio()
  if (!ctx) throw new Error('This browser cannot process audio.')
  // Raw signal: echo cancellation and noise suppression eat exactly the
  // sharp transients we are listening for.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
  await ctx.audioWorklet.addModule(workletUrl)
  const source = ctx.createMediaStreamSource(stream)
  const processorOptions: OnsetProcessorOptions = {
    bandHz: options.bandHz,
    refractoryMs: options.refractoryMs,
    threshold: options.threshold,
  }
  const node = new AudioWorkletNode(ctx, 'tok-onset', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    channelCountMode: 'explicit',
    processorOptions,
  })
  node.port.onmessage = (event: MessageEvent<WorkletMessage>) => {
    const m = event.data
    if (m.type === 'onset') {
      options.onCandidate({
        t: toEpoch(ctx, m.contextTime),
        source: 'audio',
        confidence: m.confidence,
        score: m.score,
      })
    } else {
      const { type: _type, contextTime, ...level } = m
      options.onLevel?.({ t: toEpoch(ctx, contextTime), ...level })
    }
  }
  source.connect(node)
  if (ctx.state === 'suspended') await ctx.resume()

  return {
    setThreshold: (value) => node.port.postMessage({ type: 'threshold', value }),
    stop: () => {
      node.port.onmessage = null
      source.disconnect()
      node.disconnect()
      for (const track of stream.getTracks()) track.stop()
    },
  }
}
