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
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.resetModules()
})

test('a new call cancelling the previous one keeps the mic muted until the new one ends', async () => {
  const { queue } = installSynth()
  const { speak } = await import('./speech.ts')
  const { isSelfNoise } = await import('./selfNoise.ts')
  speak('23. Best today, 41.')
  speak('New record! 42.')
  await new Promise((r) => setTimeout(r, 5))
  // The first call's onend has fired; the second is still playing.
  expect(isSelfNoise(Date.now() + 1000, 'audio')).toBe(true)
  queue[0]?.onend?.()
  expect(isSelfNoise(Date.now() + 300, 'audio')).toBe(true)
  expect(isSelfNoise(Date.now() + 1000, 'audio')).toBe(false)
})

test('when the end never comes, the mic reopens after the longest the phrase could take', async () => {
  installSynth()
  const { speak } = await import('./speech.ts')
  const { isSelfNoise } = await import('./selfNoise.ts')
  const at = Date.now()
  // 15 characters: 15 × 80 ms + 1 s.
  speak('New record! 42.')
  expect(isSelfNoise(at + 2100, 'audio')).toBe(true)
  expect(isSelfNoise(at + 2300, 'audio')).toBe(false)
})

test('a voice still talking past the estimate stays masked until it ends', async () => {
  const { queue } = installSynth()
  const { speak } = await import('./speech.ts')
  const { isSelfNoise } = await import('./selfNoise.ts')
  speak('142. Best today, 187.')
  const late = Date.now() + 10_000
  vi.spyOn(Date, 'now').mockReturnValue(late)
  queue[0]?.onend?.()
  expect(isSelfNoise(late + 300, 'audio')).toBe(true)
  expect(isSelfNoise(late + 500, 'audio')).toBe(false)
})
