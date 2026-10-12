import { expect, test } from '@playwright/test'

const SPORTS = {
  // One sound per hit: a rally opens on its second sound, straight at 2.
  'beach-rackets': { name: 'Beach rackets', hits: 10, opens: [2, 3] },
  // Paddle and table: two sounds make the first hit.
  'table-tennis': { name: 'Table tennis', hits: 10, opens: [1, 2, 3] },
} as const

test('in Auto, every hit of the recording is counted on its own', async ({ page }, info) => {
  const sport = SPORTS[info.project.name as keyof typeof SPORTS]
  // Every count the screen shows, in order, however briefly.
  await page.addInitScript(() => {
    const seen: number[] = []
    Object.assign(window, { __counts: seen })
    new MutationObserver(() => {
      const label = document
        .querySelector('[aria-label^="Add a hit. Current rally:"]')
        ?.getAttribute('aria-label')
      const n = label ? Number(label.split(': ')[1]) : NaN
      if (!Number.isNaN(n) && seen.at(-1) !== n) seen.push(n)
    }).observe(document, { subtree: true, childList: true, attributes: true })
  })
  await page.goto('./')
  await page.getByRole('button', { name: sport.name, exact: true }).click()
  await page.getByText('Auto · experimental').click()
  await page.getByRole('button', { name: /^start/i }).click()

  await expect(page.getByText('Listening')).toBeVisible({ timeout: 10_000 })
  // Every hit of the recording is counted on its own, and the rally ends after
  // the sport's recommended silence.
  await expect(page.getByText(new RegExp(`New record — ${sport.hits}!`))).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('button', { name: `Add a hit. Current rally: ${sport.hits}` }),
  ).toBeVisible()

  // The recording loops: its opening pop comes back alone between two
  // rallies, then the next rally starts. The pop never shows as a hit.
  const rally = Array.from(
    { length: sport.hits - sport.opens[0] + 1 },
    (_, i) => sport.opens[0] + i,
  )
  const expected = [0, ...rally, ...sport.opens]
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (window as unknown as { __counts: number[] }).__counts)).slice(
          0,
          expected.length,
        ),
      { timeout: 20_000 },
    )
    .toEqual(expected)
})
