// Spoken calls with on-device voices only: a network voice would send the
// text off the phone, so without a local voice tok simply stays quiet.
//
// While tok talks the mic ignores it: from the call until a moment after the
// voice ends. Should the end event never come, the mic reopens once the
// phrase has surely been said.

import { maskNoise } from './selfNoise.ts'

/** The voice's tail in the room, and the speaker's lag. */
const TAIL_MS = 400

/**
 * The longest a phrase can take, counted in characters: "142" is three words
 * aloud. Voices say about 15 a second; this allows 12, plus a second.
 */
const capMs = (text: string): number => text.length * 80 + 1000

/** The utterance playing now; only its end re-opens the mic. */
let current: SpeechSynthesisUtterance | null = null
let endCurrent: ((toEpoch: number) => void) | null = null

function localVoice(): SpeechSynthesisVoice | null {
  const voices = globalThis.speechSynthesis?.getVoices() ?? []
  return (
    voices.find((v) => v.localService && v.lang.startsWith('en') && v.default) ??
    voices.find((v) => v.localService && v.lang.startsWith('en')) ??
    null
  )
}

export function canSpeak(): boolean {
  return localVoice() !== null
}

export function speak(text: string): void {
  const synth = globalThis.speechSynthesis
  const voice = localVoice()
  if (!synth || !voice) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = 1.05
  const calledAt = Date.now()
  // The call it cuts off stops now; this one's mask covers what follows.
  endCurrent?.(calledAt)
  const end = maskNoise(calledAt, calledAt + capMs(text), ['audio'])
  // The voice may take a moment to start: the cap counts from then.
  utterance.onstart = () => {
    if (current === utterance) end(Date.now() + capMs(text))
  }
  const done = () => {
    // cancel() ends the previous utterance asynchronously: ignore it.
    if (current !== utterance) return
    current = null
    endCurrent = null
    end(Date.now() + TAIL_MS)
  }
  utterance.onend = done
  utterance.onerror = done
  current = utterance
  endCurrent = end
  synth.cancel()
  synth.speak(utterance)
}
