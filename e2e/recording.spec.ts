import { expect, test } from '@playwright/test'

test('a filmed session can be replayed, chaptered by rally', async ({ page }, info) => {
  test.skip(info.project.name !== 'beach-rackets', 'one recording run is enough')
  await page.goto('./')
  await page.getByRole('button', { name: 'Beach rackets', exact: true }).click()
  await page.getByText('Auto — listen').click()
  await page.getByRole('button', { name: /^start/i }).click()
  await page.getByRole('button', { name: 'Film the session' }).click()
  await expect(page.getByLabel('recording')).toBeVisible({ timeout: 10_000 })

  await expect(page.getByText('New record — 10!')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'End session' }).click()
  await page.getByRole('button', { name: 'End', exact: true }).click()

  await page.getByRole('link', { name: /watch the replay/i }).click()
  const video = page.getByLabel('Session recording')
  await expect
    .poll(() => video.evaluate((v) => (v as unknown as { readyState: number }).readyState), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: /best rally — 10/i })).toBeVisible()
})
