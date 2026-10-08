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

function plate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.fillStyle = SLATE
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: OverlayState,
): void {
  const u = Math.min(w, h) / 100 // one "unit" scales with the frame
  const pad = 3 * u
  ctx.textBaseline = 'alphabetic'

  if (s.match) {
    const pw = 46 * u
    const ph = 26 * u
    const x = pad
    const y = h - ph - pad
    plate(ctx, x, y, pw, ph, 2 * u)
    const row = (side: 'A' | 'B', yy: number, color: string) => {
      ctx.fillStyle = color
      ctx.font = `600 ${5.5 * u}px ${FIGURES}`
      ctx.textAlign = 'left'
      ctx.fillText(s.match!.names[side].slice(0, 12), x + 3 * u, yy)
      ctx.fillStyle = DIM
      ctx.textAlign = 'right'
      ctx.fillText(String(s.match!.sets[side]), x + pw - 15 * u, yy)
      ctx.fillStyle = color
      ctx.font = `800 ${8.5 * u}px ${FIGURES}`
      ctx.fillText(s.match!.points[side], x + pw - 3 * u, yy + 0.8 * u)
    }
    row('A', y + 11 * u, SIDE_A)
    row('B', y + 22 * u, SIDE_B)
    return
  }

  const pw = 40 * u
  const ph = 24 * u
  const x = pad
  const y = h - ph - pad
  plate(ctx, x, y, pw, ph, 2 * u)
  ctx.textAlign = 'left'
  ctx.fillStyle = s.count > 0 && s.count >= s.best ? BEST : CHALK
  ctx.font = `800 ${17 * u}px ${FIGURES}`
  ctx.fillText(String(s.count), x + 3 * u, y + 18.5 * u)
  ctx.fillStyle = DIM
  ctx.font = `600 ${4.5 * u}px ${FIGURES}`
  ctx.textAlign = 'right'
  ctx.fillText(s.title, x + pw - 3 * u, y + 7 * u)
  ctx.fillText(s.unit, x + pw - 3 * u, y + 13 * u)
  if (s.best > 0) {
    ctx.fillStyle = BEST
    ctx.fillText(`best ${s.best}`, x + pw - 3 * u, y + 19.5 * u)
  }
}
