import { afterEach, expect, test, vi } from 'vitest'

type U = { onend: (() => void) | null; onerror: (() => void) | null }

function installSynth() {
  const queue: U[] = []
  const synth = {
    getVoices: () => [{ localService: true, lang: 'en-US', default: true, name: 'Local' }],
    // Cancelling ends the utterance that was playing, asynchronously.
    cancel: vi.fn(() => {
      const playing = queue.splice(0)
      setTimeout(() => playing.forEach((u) => u.onend?.()), 0)
    }),
    speak: vi.fn((u: U) => queue.push(u)),
  }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      text: string
      constructor(text: string) {
        this.text = text
      }
    },
  )
  return { synth, queue }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

test('a new call cancelling the previous one keeps the mic muted until the new one ends', async () => {
  const { queue } = installSynth()
  const { speak, isSpeaking } = await import('./speech.ts')
  speak('23. Best today, 41.')
  speak('New record! 42.')
  await new Promise((r) => setTimeout(r, 5))
  // The first call's onend has fired; the second is still playing.
  expect(isSpeaking(performance.now() + 10_000)).toBe(true)
  queue[0]?.onend?.()
  expect(isSpeaking(performance.now() + 10_000)).toBe(false)
})
