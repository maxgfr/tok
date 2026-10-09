import { expect, test } from '@playwright/test'

test('one rally can be cut out of the recording and shared as an MP4', async ({ page }, info) => {
  test.skip(info.project.name !== 'beach-rackets', 'one recording run is enough')
  // The share sheet is the OS's: stand in for it and keep what it was handed.
  await page.addInitScript(() => {
    const w = window as unknown as { shared?: { size: number; type: string; name: string } }
    navigator.canShare = () => true
    navigator.share = async (data?: ShareData) => {
      const file = data?.files?.[0]
      if (file) w.shared = { size: file.size, type: file.type, name: file.name }
    }
  })

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
  await page.getByRole('button', { name: 'Share this rally' }).click()
  // The share sheet opens from its own tap, once the clip is cut.
  await page.getByRole('button', { name: 'Share the clip' }).click({ timeout: 30_000 })
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { shared?: unknown }).shared), {
      timeout: 30_000,
    })
    .toMatchObject({ type: 'video/mp4', name: expect.stringMatching(/-rally-1\.mp4$/) })
  const size = await page.evaluate(
    () => (window as unknown as { shared: { size: number } }).shared.size,
  )
  expect(size).toBeGreaterThan(0)
})
