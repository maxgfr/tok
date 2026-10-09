// Short sounds that confirm what tok counted, so the player can keep their
// eyes on the ball: a click for each hit, a falling pair of notes when a rally
// ends, a rising run for a record. Played on the shared AudioContext; while
// one plays, Auto ignores the mic so tok never counts its own sounds.

import { primeAudio } from '../sensors/prime.ts'

/** The mic ignores this much after a sound ends: speaker ring and room echo. */
const GUARD_MS = 150

let quietAt = -Infinity

/** True while tok is making a sound (and just after). */
export const isSounding = (): boolean => performance.now() < quietAt

function play(notes: readonly number[], stepS: number, lengthS: number, volume: number): void {
  quietAt = performance.now() + ((notes.length - 1) * stepS + lengthS) * 1000 + GUARD_MS
  const ctx = primeAudio()
  if (!ctx) return
  notes.forEach((frequency, i) => {
    const start = ctx.currentTime + i * stepS
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume, start + 0.005)
    gain.gain.linearRampToValueAtTime(0, start + lengthS)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + lengthS + 0.01)
  })
}

/** One counted hit. */
export const hitSound = (): void => play([1320], 0, 0.035, 0.12)

/** A rally ended; `best` when it set a record, today's best or reached the goal. */
export const rallyEndSound = (best: boolean): void =>
  best ? play([660, 880, 1320], 0.09, 0.14, 0.18) : play([660, 440], 0.1, 0.14, 0.15)
