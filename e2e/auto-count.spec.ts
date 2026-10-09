import { expect, test } from '@playwright/test'

const SPORTS = {
  'beach-rackets': { name: 'Beach rackets', hits: 10 },
  'table-tennis': { name: 'Table tennis', hits: 10 },
} as const

test('in Auto, every hit of the recording is counted on its own', async ({ page }, info) => {
  const sport = SPORTS[info.project.name as keyof typeof SPORTS]
  await page.goto('./')
  await page.getByRole('button', { name: sport.name, exact: true }).click()
  await page.getByText('Auto · experimental').click()
  await page.getByRole('button', { name: /^start/i }).click()

  await expect(page.getByText('Listening')).toBeVisible({ timeout: 10_000 })
  // Every hit of the recording is counted on its own; the player ends the rally.
  await expect(
    page.getByRole('button', { name: `Add a hit. Current rally: ${sport.hits}` }),
  ).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /end rally/i }).click()
  await expect(page.getByText(new RegExp(`New record — ${sport.hits}!`))).toBeVisible()
})
