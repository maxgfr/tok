import type { Chapter } from './chapters.ts'

const stamp = (seconds: number): string => {
  const ms = Math.round(seconds * 1000)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`
}

/** WebVTT captions naming each rally while it plays. */
export function chaptersVtt(list: readonly Chapter[], unit: string): string {
  const cues = list.map(
    (c) =>
      `${stamp(c.start)} --> ${stamp(c.end)}\nRally ${c.index + 1} — ${c.count} ${unit}${c.best ? ' (best)' : ''}\n`,
  )
  return `WEBVTT\n\n${cues.join('\n')}`
}
