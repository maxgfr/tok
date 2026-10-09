import { expect, test } from '@playwright/test'

test('a filmed session can be replayed, chaptered by rally', async ({ page }, info) => {
  test.skip(info.project.name !== 'beach-rackets', 'one recording run is enough')
  // Taps only: what is under test is the film and its chapters. Counting from
  // the mic is auto-count.spec's job, and the fake camera's moving ball would
  // add its own hits.
  await page.goto('./')
  await page.getByRole('button', { name: 'Beach rackets', exact: true }).click()
  await page.getByText('Taps only').click()
  await page.getByRole('button', { name: /^start/i }).click()
  await page.getByRole('button', { name: 'Film the session' }).click()
  await expect(page.getByLabel('recording')).toBeVisible({ timeout: 10_000 })

  const tap = page.getByRole('button', { name: /add a hit/i })
  for (const hits of [4, 6]) {
    for (let i = 0; i < hits; i += 1) {
      await page.waitForTimeout(300)
      await tap.click()
    }
    await page.getByRole('button', { name: /end rally/i }).click()
    await page.waitForTimeout(800)
  }
  await page.getByRole('button', { name: 'End session' }).click()
  await page.getByRole('button', { name: 'End', exact: true }).click()

  await page.getByRole('link', { name: /watch the replay/i }).click()
  const video = page.getByLabel('Session recording')
  await expect
    .poll(() => video.evaluate((v) => (v as unknown as { readyState: number }).readyState), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: /best rally — 6/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Jump to rally/ })).toHaveCount(2)
})
