// In-place iterative radix-2 FFT. Small and allocation-free per call: it runs
// inside the audio worklet ~190 times a second.

export class FFT {
  readonly size: number
  private readonly cos: Float32Array
  private readonly sin: Float32Array
  private readonly rev: Uint32Array

  constructor(size: number) {
    if (size & (size - 1)) throw new Error('FFT size must be a power of two')
    this.size = size
    this.cos = new Float32Array(size / 2)
    this.sin = new Float32Array(size / 2)
    for (let i = 0; i < size / 2; i += 1) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size)
      this.sin[i] = -Math.sin((2 * Math.PI * i) / size)
    }
    this.rev = new Uint32Array(size)
    const bits = Math.log2(size)
    for (let i = 0; i < size; i += 1) {
      let r = 0
      for (let b = 0; b < bits; b += 1) r |= ((i >> b) & 1) << (bits - 1 - b)
      this.rev[i] = r
    }
  }

  /** Transforms `re`/`im` in place. */
  transform(re: Float32Array, im: Float32Array): void {
    const n = this.size
    for (let i = 0; i < n; i += 1) {
      const j = this.rev[i]!
      if (j > i) {
        const tr = re[i]!
        re[i] = re[j]!
        re[j] = tr
        const ti = im[i]!
        im[i] = im[j]!
        im[j] = ti
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1
      const step = n / len
      for (let start = 0; start < n; start += len) {
        for (let k = 0; k < half; k += 1) {
          const wr = this.cos[k * step]!
          const wi = this.sin[k * step]!
          const a = start + k
          const b = a + half
          const xr = re[b]! * wr - im[b]! * wi
          const xi = re[b]! * wi + im[b]! * wr
          re[b] = re[a]! - xr
          im[b] = im[a]! - xi
          re[a] = re[a]! + xr
          im[a] = im[a]! + xi
        }
      }
    }
  }
}
