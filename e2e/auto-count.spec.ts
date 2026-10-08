import { expect, test } from '@playwright/test'

const SPORTS = {
  'beach-rackets': { name: 'Beach rackets', hits: 10 },
  'table-tennis': { name: 'Table tennis', hits: 10 },
} as const

test('the live counter counts every hit of the recording on its own', async ({ page }, info) => {
  const sport = SPORTS[info.project.name as keyof typeof SPORTS]
  await page.goto('./')
  await page.getByRole('button', { name: sport.name, exact: true }).click()
  await page.getByText('Auto — listen').click()
  await page.getByRole('button', { name: /^start/i }).click()

  await expect(page.getByText('Listening')).toBeVisible({ timeout: 10_000 })
  // The rally ends on its own after the recording falls silent.
  await expect(page.getByText(new RegExp(`New record — ${sport.hits}!`))).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    page.getByRole('button', { name: `Add a hit. Current rally: ${sport.hits}` }),
  ).toBeVisible()
})
