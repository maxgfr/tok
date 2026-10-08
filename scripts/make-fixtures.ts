// Writes the synthetic hit recordings used by tests and the E2E run.
// Synthetic, not recorded: replace with real recordings when we have them.
// Run: node scripts/make-fixtures.ts

import { writeFileSync } from 'node:fs'
import { steady, synth, type Tok } from '../src/test/synth.ts'

const SR = 48_000

function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]!))
    data.writeInt16LE(Math.round(v * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(SR, 24)
  header.writeUInt32LE(SR * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

// Beach rackets: 10 hits, 0.55 s apart, over wind-and-waves rumble.
const rackets = steady(10, 1, 0.55, { freq: 2600, gain: 0.45, decayMs: 30 })
writeFileSync(
  'fixtures/beach-rackets.wav',
  wav(synth({ sampleRate: SR, seconds: 9, toks: rackets, noise: 0.004, rumble: 0.05, seed: 7 })),
)

// Table tennis: 10 hits, each a paddle "tok" then a table bounce.
const table: Tok[] = []
for (let i = 0; i < 10; i += 1) {
  const at = 1 + i * 0.42
  table.push({ at, freq: 3400, gain: 0.4, decayMs: 14 })
  table.push({ at: at + 0.21, freq: 2100, gain: 0.3, decayMs: 12 })
}
writeFileSync(
  'fixtures/table-tennis.wav',
  wav(synth({ sampleRate: SR, seconds: 8, toks: table, noise: 0.003, seed: 11 })),
)

console.log('fixtures written: beach-rackets.wav (10 hits), table-tennis.wav (10 hits, 20 sounds)')
