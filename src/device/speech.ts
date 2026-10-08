// Spoken calls with on-device voices only: a network voice would send the
// text off the phone, so without a local voice tok simply stays quiet.

let quietAfter = 0
let speaking = false

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
  const done = () => {
    speaking = false
    quietAfter = performance.now() + 400
  }
  utterance.onend = done
  utterance.onerror = done
  synth.cancel()
  speaking = true
  synth.speak(utterance)
}

/** True while tok is talking (and a moment after): the mic must not count it. */
export function isSpeaking(now = performance.now()): boolean {
  return speaking || now < quietAfter
}
