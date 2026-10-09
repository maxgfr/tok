// Synthetic hit sounds for tests and fixtures. Not recordings: a "tok" here is
// a short decaying resonance plus a click of broadband noise, which is what a
// paddle or a racket contact looks like to an onset detector.

export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Tok {
  at: number
  /** Resonance in Hz. */
  freq?: number
  gain?: number
  decayMs?: number
  /** Amplitude of the broadband contact click (0 = a pure resonance). */
  click?: number
  /** Rise time of the envelope. Paddles are near-instant; a ball in sand is soft. */
  attackMs?: number
}

export interface SynthOptions {
  sampleRate: number
  seconds: number
  toks: Tok[]
  /** Background noise amplitude (white). */
  noise?: number
  /** Low rumble (wind, waves): amplitude of a slow 60–120 Hz drone. */
  rumble?: number
  /** Spoken syllables mixed in: the player calling the score. */
  speech?: Syllable[]
  seed?: number
}

export interface Syllable {
  at: number
  gain?: number
  /** Pitch of the voice in Hz. */
  f0?: number
  /** Length of the vowel. */
  ms?: number
}

// Formants of an open /a/: centre and bandwidth in Hz, relative weight.
const FORMANTS: readonly (readonly [number, number, number])[] = [
  [700, 110, 1],
  [1220, 120, 0.6],
  [2600, 160, 0.45],
  [3300, 200, 0.3],
]

/**
 * A spoken syllable mixed into `out`: a 10 ms plosive burst, then a voiced
 * vowel (f0 plus every harmonic up to 4 kHz, shaped by the formants). Unlike a
 * hit, its energy holds for the whole vowel.
 */
export function speech(
  out: Float32Array,
  sampleRate: number,
  { at, gain = 0.5, f0 = 140, ms = 250 }: Syllable,
  rand: () => number = rng(3),
): void {
  const start = Math.round(at * sampleRate)
  const burst = Math.round(0.01 * sampleRate)
  for (let j = 0; j < burst && start + j < out.length; j += 1) {
    out[start + j]! += gain * 0.4 * (rand() * 2 - 1)
  }
  const harmonics: [number, number][] = []
  for (let f = f0; f <= 4000; f += f0) {
    let a = 0
    for (const [centre, width, weight] of FORMANTS) a += weight / (1 + ((f - centre) / width) ** 2)
    harmonics.push([f, a])
  }
  const norm = harmonics.reduce((sum, [, a]) => sum + a, 0)
  const length = Math.round((ms / 1000) * sampleRate)
  const attack = 0.005 * sampleRate
  const release = 0.03 * sampleRate
  for (let j = 0; j < length && start + burst + j < out.length; j += 1) {
    const t = j / sampleRate
    const env = Math.min(1, j / attack, (length - j) / release)
    let v = 0
    for (const [f, a] of harmonics) v += a * Math.sin(2 * Math.PI * f * t)
    out[start + burst + j]! += (gain * env * v) / norm
  }
}

export function synth({
  sampleRate,
  seconds,
  toks,
  noise = 0.003,
  rumble = 0,
  speech: syllables = [],
  seed = 1,
}: SynthOptions): Float32Array {
  const out = new Float32Array(Math.round(sampleRate * seconds))
  const rand = rng(seed)
  for (let i = 0; i < out.length; i += 1) {
    const t = i / sampleRate
    out[i] = (rand() * 2 - 1) * noise + rumble * Math.sin(2 * Math.PI * (80 + 30 * Math.sin(t)) * t)
  }
  for (const { at, freq = 3000, gain = 0.5, decayMs = 35, click = 0.6, attackMs = 0.5 } of toks) {
    const start = Math.round(at * sampleRate)
    const length = Math.round((decayMs / 1000) * sampleRate * 5)
    for (let j = 0; j < length && start + j < out.length; j += 1) {
      const t = j / sampleRate
      const env =
        Math.exp(-t / (decayMs / 1000)) * Math.min(1, j / ((attackMs / 1000) * sampleRate))
      const burst = j < 0.002 * sampleRate ? (rand() * 2 - 1) * click : 0
      out[start + j]! += gain * env * (Math.sin(2 * Math.PI * freq * t) + burst)
    }
  }
  for (const syllable of syllables) speech(out, sampleRate, syllable, rand)
  return out
}

/** Hits at a steady pace: `count` toks starting at `start`, `gap` seconds apart. */
export const steady = (
  count: number,
  start: number,
  gap: number,
  tok: Omit<Tok, 'at'> = {},
): Tok[] => Array.from({ length: count }, (_, i) => ({ ...tok, at: start + i * gap }))
