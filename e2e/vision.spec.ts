import { expect, test } from '@playwright/test'

test('ball tracking starts on the camera and nothing leaves the device', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'beach-rackets', 'one vision run is enough')
  const outside: string[] = []
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http')) {
      outside.push(request.url())
    }
  })

  await page.goto('./')
  await page.getByRole('button', { name: 'Volleyball', exact: true }).click()
  await page.getByText('Auto — listen').click()
  await page.getByRole('button', { name: /^start/i }).click()
  await page.getByRole('button', { name: 'Film the session' }).click()

  await expect(page.getByText('Tracking')).toBeVisible({ timeout: 30_000 })
  const mode = await page.evaluate(() => document.documentElement.dataset.vision)
  expect(mode).toBe('mediapipe')
  await page.waitForTimeout(3000)
  expect(outside).toEqual([])
})
