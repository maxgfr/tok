export const fmtDate = (t: number): string =>
  new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export const fmtTime = (t: number): string =>
  new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** Trailing zeros say nothing: 10 GB, 2.5 GB. */
const trim = (value: string) => value.replace(/\.?0+$/, '')

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${trim((n / 1024 ** 2).toFixed(1))} MB`
  return `${trim((n / 1024 ** 3).toFixed(2))} GB`
}

/** A video position: 0:02, 12:40, 1:02:05. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** "1 rally", "3 rallies" — counts read as words do. */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
