// Microphone → AudioWorklet onset detector → hit candidates on the epoch clock.

import { agedPerf, perfToEpoch } from '../device/clock.ts'
import type { Level } from '../engine/onset.ts'
import type { HitCandidate } from '../engine/types.ts'
import workletUrl from './onset.worklet.ts?worker&url'
import { primeAudio } from './prime.ts'
import type { OnsetProcessorOptions, ProcessorCommand, WorkletMessage } from './onset.worklet.ts'

export interface AudioCandidate extends HitCandidate {
  score: number
}

export interface TimedLevel extends Level {
  t: number
  /** Sounds the voice filter has set aside since the mic opened. */
  rejected: number
}

export interface AudioSensor {
  /** The raw mic track, reused for the recording's soundtrack. */
  track: MediaStreamTrack | null
  setThreshold: (value: number) => void
  setVoiceFilter: (on: boolean) => void
  /** Turns the level trace on while something draws it. */
  setLevels: (on: boolean) => void
  stop: () => void
}

export interface AudioOptions extends OnsetProcessorOptions {
  onCandidate: (candidate: AudioCandidate) => void
  onLevel?: (level: TimedLevel) => void
}

/** Epoch ms of an audio event that happened `age` seconds of audio ago. */
const toEpoch = (age: number): number => perfToEpoch(agedPerf(age, performance.now()))

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
    voiceFilter: options.voiceFilter,
    levels: options.levels,
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
        t: toEpoch(m.age),
        source: 'audio',
        confidence: m.confidence,
        score: m.score,
      })
    } else {
      const { type: _type, age, ...level } = m
      options.onLevel?.({ t: toEpoch(age), ...level })
    }
  }
  source.connect(node)
  const send = (command: ProcessorCommand) => node.port.postMessage(command)

  return {
    track: stream.getAudioTracks()[0] ?? null,
    setThreshold: (value) => send({ type: 'threshold', value }),
    setVoiceFilter: (on) => send({ type: 'voiceFilter', on }),
    setLevels: (on) => send({ type: 'levels', on }),
    stop: () => {
      node.port.onmessage = null
      source.disconnect()
      node.disconnect()
      for (const track of stream.getTracks()) track.stop()
      // Nothing else plays through it; a running context keeps the audio thread awake.
      void ctx.suspend()
    },
  }
}
