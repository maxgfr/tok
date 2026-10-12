import { render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { clearAll, saveSession, type SessionRecord } from '../../store/db.ts'
import { History } from './History.tsx'

const played = (id: string, startedAt: number, counts: number[]): SessionRecord => ({
  id,
  sportId: 'beach-rackets',
  mode: 'rally',
  startedAt,
  endedAt: startedAt + 60_000,
  sensors: ['manual'],
  rallies: counts.map((n, i) => ({
    startedAt: startedAt + i * 10_000,
    endedAt: startedAt + i * 10_000 + 5000,
    hits: Array.from({ length: n }, (_, k) => ({
      t: startedAt + i * 10_000 + k * 400,
      sources: ['manual' as const],
      confidence: 1,
    })),
    endReason: 'manual' as const,
  })),
  match: null,
})

beforeEach(async () => {
  await clearAll()
})

test('the record, average and sessions come from the summaries', async () => {
  await saveSession(played('a', Date.UTC(2026, 9, 10, 10), [4, 8]))
  await saveSession(played('b', Date.UTC(2026, 9, 11, 10), [6]))
  render(<History />)
  const progress = await screen.findByRole('region', { name: 'Beach rackets progress' })
  expect(progress.textContent).toMatch(/Record\s*8/)
  expect(progress.textContent).toMatch(/average\s*6\.0/)
  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
  expect(
    rows.map((r) =>
      within(r)
        .getAllByRole('cell')
        .slice(2)
        .map((c) => c.textContent),
    ),
  ).toEqual([
    ['1', '6'],
    ['2', '8'],
  ])
})

test('a best of 0 is not shown as the record', async () => {
  await saveSession({ ...played('z', Date.UTC(2026, 9, 10, 10), []), rallies: [] })
  render(<History />)
  const cells = within(await screen.findByRole('table')).getAllByRole('cell')
  const best = cells.at(-1)!
  expect(best.textContent).toBe('0')
  expect(best.className).not.toMatch(/text-best/)
})
