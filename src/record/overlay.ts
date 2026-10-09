// The score burned into the recording, in the app's own chalkboard language:
// a slate plate, chalk figures, yellow for the best.

export interface OverlayState {
  title: string
  unit: string
  count: number
  best: number
  match: {
    names: { A: string; B: string }
    points: { A: string; B: string }
    sets: { A: number; B: number }
  } | null
}

const SLATE = 'rgba(22, 32, 28, 0.82)'
const CHALK = '#eef0e6'
const DIM = '#a3ada6'
const BEST = '#f5d547'
const SIDE_A = '#6fc3e8'
const SIDE_B = '#f28c7a'
const FIGURES = '"Barlow Condensed", system-ui, sans-serif'

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function plate(ctx: Ctx2D, w: number, h: number, r: number) {
  ctx.fillStyle = SLATE
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, r)
  ctx.fill()
}

/** Plate size in units of 1% of the frame's short side. */
const size = (s: OverlayState) => (s.match ? { w: 46, h: 26 } : { w: 40, h: 24 })

/** Paints the plate for `s` with its top-left corner at the origin. */
function paint(ctx: Ctx2D, u: number, s: OverlayState): void {
  const { w, h } = size(s)
  const pw = w * u
  ctx.clearRect(0, 0, pw, h * u)
  plate(ctx, pw, h * u, 2 * u)
  ctx.textBaseline = 'alphabetic'

  if (s.match) {
    const row = (side: 'A' | 'B', yy: number, color: string) => {
      ctx.fillStyle = color
      ctx.font = `600 ${5.5 * u}px ${FIGURES}`
      ctx.textAlign = 'left'
      ctx.fillText(s.match!.names[side].slice(0, 12), 3 * u, yy)
      ctx.fillStyle = DIM
      ctx.textAlign = 'right'
      ctx.fillText(String(s.match!.sets[side]), pw - 15 * u, yy)
      ctx.fillStyle = color
      ctx.font = `800 ${8.5 * u}px ${FIGURES}`
      ctx.fillText(s.match!.points[side], pw - 3 * u, yy + 0.8 * u)
    }
    row('A', 11 * u, SIDE_A)
    row('B', 22 * u, SIDE_B)
    return
  }

  ctx.textAlign = 'left'
  ctx.fillStyle = s.count > 0 && s.count >= s.best ? BEST : CHALK
  ctx.font = `800 ${17 * u}px ${FIGURES}`
  ctx.fillText(String(s.count), 3 * u, 18.5 * u)
  ctx.fillStyle = DIM
  ctx.font = `600 ${4.5 * u}px ${FIGURES}`
  ctx.textAlign = 'right'
  ctx.fillText(s.title, pw - 3 * u, 7 * u)
  ctx.fillText(s.unit, pw - 3 * u, 13 * u)
  if (s.best > 0) {
    ctx.fillStyle = BEST
    ctx.fillText(`best ${s.best}`, pw - 3 * u, 19.5 * u)
  }
}

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

// The plate only changes when the score does: it is painted once into its own
// canvas, and every video frame just copies it.
let cache: {
  state: OverlayState
  u: number
  canvas: OffscreenCanvas | HTMLCanvasElement
  ctx: Ctx2D
} | null = null

export function drawOverlay(ctx: Ctx2D, w: number, h: number, s: OverlayState): void {
  const u = Math.min(w, h) / 100 // one "unit" scales with the frame
  if (cache?.state !== s || cache.u !== u) {
    const { w: pw, h: ph } = size(s)
    const width = Math.ceil(pw * u)
    const height = Math.ceil(ph * u)
    let canvas = cache?.canvas
    let plateCtx = cache?.ctx ?? null
    if (!canvas || canvas.width !== width || canvas.height !== height) {
      canvas = makeCanvas(width, height)
      plateCtx = canvas.getContext('2d') as Ctx2D | null
    }
    if (!plateCtx) return
    paint(plateCtx, u, s)
    cache = { state: s, u, canvas, ctx: plateCtx }
  }
  const pad = 3 * u
  ctx.drawImage(cache.canvas, pad, h - cache.canvas.height - pad)
}
