import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { clearAll, getSession, saveSession, type SessionRecord } from '../../store/db.ts'
import { SessionDetail } from './SessionDetail.tsx'

const hits = (n: number, start: number) =>
  Array.from({ length: n }, (_, i) => ({
    t: start + i * 600,
    sources: ['audio' as const],
    confidence: 1,
  }))
const rally = (n: number, start: number) => ({
  startedAt: start,
  endedAt: start + n * 600,
  hits: hits(n, start),
  endReason: 'manual' as const,
})
const session: SessionRecord = {
  id: 's1',
  sportId: 'beach-rackets',
  mode: 'rally',
  startedAt: 1000,
  endedAt: 60_000,
  sensors: ['audio'],
  rallies: [rally(5, 1000), rally(12, 20_000)],
  match: null,
}

beforeEach(async () => {
  await clearAll()
  await saveSession(session)
})

test("a rally's count can be corrected afterwards", async () => {
  const user = userEvent.setup()
  render(<SessionDetail id="s1" />)
  await user.click(await screen.findByRole('button', { name: 'Correct rally 2' }))
  const field = screen.getByRole('spinbutton', { name: 'Hits in rally 2' })
  await user.clear(field)
  await user.type(field, '10')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await expect.poll(async () => (await getSession('s1'))?.rallies[1]?.count).toBe(10)
  expect(screen.getByRole('cell', { name: '10' })).toBeTruthy()
})

test('a rally that was not one can be deleted', async () => {
  const user = userEvent.setup()
  render(<SessionDetail id="s1" />)
  await user.click(await screen.findByRole('button', { name: 'Correct rally 1' }))
  await user.click(screen.getByRole('button', { name: 'Delete rally' }))
  await expect.poll(async () => (await getSession('s1'))?.rallies.length).toBe(1)
})
