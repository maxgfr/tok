import { expect, test } from 'vitest'
import { FFT } from './fft.ts'

test('a pure tone lands in its bin', () => {
  const n = 256
  const fft = new FFT(n)
  const re = new Float32Array(n)
  const im = new Float32Array(n)
  for (let i = 0; i < n; i += 1) re[i] = Math.cos((2 * Math.PI * 10 * i) / n)
  fft.transform(re, im)
  const mags = Array.from(re, (r, i) => Math.hypot(r, im[i]!))
  const peak = mags.slice(0, n / 2).indexOf(Math.max(...mags.slice(0, n / 2)))
  expect(peak).toBe(10)
  expect(mags[10]).toBeCloseTo(n / 2, 1)
})

test('rejects sizes that are not powers of two', () => {
  expect(() => new FFT(300)).toThrow()
})
