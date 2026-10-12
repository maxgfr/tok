// Writes the synthetic hit recordings used by tests and the E2E run.
// Synthetic, not recorded: replace with real recordings when we have them.
// Run: node scripts/make-fixtures.ts

import { writeFileSync } from 'node:fs'
import { encodeWav } from '../src/record/wav.ts'
import { steady, synth, type Tok } from '../src/test/synth.ts'

const SR = 48_000

const wav = (samples: Float32Array): Buffer => Buffer.from(encodeWav(samples, SR))

// Both start after a 3 s lead-in: the mic opens before the detector is attached.
// Both open with a pop at 0.1 s, like a mic switching on; the recording loops,
// so mid-session it also comes back between two rallies, alone: never a hit.
const pop: Tok = { at: 0.1, freq: 3000, gain: 0.6, decayMs: 5, click: 1 }

// Beach rackets: 10 hits, 0.55 s apart, over wind-and-waves rumble.
const rackets = [pop, ...steady(10, 3, 0.55, { freq: 2600, gain: 0.45, decayMs: 30 })]
writeFileSync(
  'fixtures/beach-rackets.wav',
  wav(synth({ sampleRate: SR, seconds: 11, toks: rackets, noise: 0.004, rumble: 0.05, seed: 7 })),
)

// Table tennis: 10 hits, each a paddle "tok" then a table bounce.
const table: Tok[] = [pop]
for (let i = 0; i < 10; i += 1) {
  const at = 3 + i * 0.42
  table.push({ at, freq: 3400, gain: 0.4, decayMs: 14 })
  table.push({ at: at + 0.21, freq: 2100, gain: 0.3, decayMs: 12 })
}
writeFileSync(
  'fixtures/table-tennis.wav',
  wav(synth({ sampleRate: SR, seconds: 10, toks: table, noise: 0.003, seed: 11 })),
)

console.log('fixtures written: beach-rackets.wav (10 hits), table-tennis.wav (10 hits, 20 sounds)')
