// Microphone → AudioWorklet onset detector → hit candidates on the epoch clock.
//
// A phone takes the mic away: a call, Siri, the screen locked, another app.
// The context gets suspended or interrupted, the track muted or ended. Each is
// reported, so the chip stops saying "Listening" to a dead mic, and the
// context is resumed when it can be; a track that ended needs a new one.

import { agedPerf, perfToEpoch } from '../device/clock.ts'
import type { Level } from '../engine/onset.ts'
import type { HitCandidate } from '../engine/types.ts'
import workletUrl from './onset.worklet.ts?worker&url'
import { primeAudio, retainAudio } from './prime.ts'
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
  /** A chosen microphone; '' or absent for the system default. */
  deviceId?: string
  onCandidate: (candidate: AudioCandidate) => void
  onLevel?: (level: TimedLevel) => void
  /** The mic stopped hearing (false) or hears again (true). */
  onHealth?: (hearing: boolean) => void
  /** The track ended: only a new one hears again. */
  onLost?: () => void
}

/** Epoch ms of an audio event that happened `age` seconds of audio ago. */
const toEpoch = (age: number): number => perfToEpoch(agedPerf(age, performance.now()))

export async function startAudio(options: AudioOptions): Promise<AudioSensor> {
  const ctx = primeAudio()
  if (!ctx) throw new Error('This browser cannot process audio.')
  // Raw signal: echo cancellation and noise suppression eat exactly the
  // sharp transients we are listening for.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      // 'ideal': a mic that was unplugged falls back to the default instead of failing.
      ...(options.deviceId ? { deviceId: { ideal: options.deviceId } } : {}),
    },
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
  const release = retainAudio()

  const track = stream.getAudioTracks()[0] ?? null
  let stopped = false
  const hearing = () =>
    ctx.state === 'running' && !!track && !track.muted && track.readyState === 'live'
  const check = () => {
    if (stopped) return
    if (track?.readyState === 'ended') {
      options.onLost?.()
      return
    }
    // Suspended or interrupted behind our back: ask for it back.
    if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {})
    options.onHealth?.(hearing())
  }
  ctx.addEventListener('statechange', check)
  const onVisible = () => {
    if (document.visibilityState === 'visible') check()
  }
  document.addEventListener('visibilitychange', onVisible)
  if (track) {
    track.addEventListener('mute', check)
    track.addEventListener('unmute', check)
    track.addEventListener('ended', check)
  }

  return {
    track,
    setThreshold: (value) => send({ type: 'threshold', value }),
    setVoiceFilter: (on) => send({ type: 'voiceFilter', on }),
    setLevels: (on) => send({ type: 'levels', on }),
    stop: () => {
      stopped = true
      ctx.removeEventListener('statechange', check)
      document.removeEventListener('visibilitychange', onVisible)
      if (track) {
        track.removeEventListener('mute', check)
        track.removeEventListener('unmute', check)
        track.removeEventListener('ended', check)
      }
      node.port.onmessage = null
      source.disconnect()
      node.disconnect()
      for (const t of stream.getTracks()) t.stop()
      // Suspended once nothing else (the coach's sounds) uses it.
      release()
    },
  }
}
