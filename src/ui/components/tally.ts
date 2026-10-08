// Tally geometry: four uprights and a cross-stroke per gate of five, laid out
// in rows. Each stroke gets a small deterministic wobble so the marks read as
// strokes rather than a barcode — the same count always draws the same board.

export const GATE_W = 46
export const ROW_H = 54
const STROKE_GAP = 9
const TOP = 6
const BOTTOM = 42

export interface Stroke {
  index: number
  row: number
  kind: 'up' | 'cross'
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface TallyLayout {
  strokes: Stroke[]
  rows: number
  /** Hits not drawn because they filled earlier blocks. */
  carried: number
}

/** Cheap integer hash → [-1, 1]. */
const wobble = (n: number, salt: number): number => {
  let h = (n * 374761393 + salt * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (((h ^ (h >>> 16)) >>> 0) / 0xffffffff) * 2 - 1
}

export function tallyLayout(
  count: number,
  { gatesPerRow, capacity }: { gatesPerRow: number; capacity: number },
): TallyLayout {
  const carried = count > capacity ? Math.floor((count - 1) / capacity) * capacity : 0
  const shown = count - carried
  const strokes: Stroke[] = []
  for (let i = 0; i < shown; i += 1) {
    const gate = Math.floor(i / 5)
    const inGate = i % 5
    const row = Math.floor(gate / gatesPerRow)
    const gx = (gate % gatesPerRow) * GATE_W
    const gy = row * ROW_H
    const n = carried + i
    if (inGate < 4) {
      const x = gx + 4 + inGate * STROKE_GAP
      strokes.push({
        index: n,
        row,
        kind: 'up',
        x1: x + wobble(n, 1) * 1.2,
        y1: gy + TOP + wobble(n, 2) * 1.5,
        x2: x + wobble(n, 3) * 1.6,
        y2: gy + BOTTOM + wobble(n, 4) * 1.5,
      })
    } else {
      strokes.push({
        index: n,
        row,
        kind: 'cross',
        x1: gx - 1 + wobble(n, 5),
        y1: gy + BOTTOM - 8 + wobble(n, 6) * 2,
        x2: gx + 4 + 3 * STROKE_GAP + 6 + wobble(n, 7),
        y2: gy + TOP + 8 + wobble(n, 8) * 2,
      })
    }
  }
  const gates = Math.ceil(shown / 5)
  return { strokes, rows: Math.max(1, Math.ceil(gates / gatesPerRow)), carried }
}
