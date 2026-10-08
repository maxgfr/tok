import { expect, test } from '@playwright/test'

test('after one visit tok opens with no network at all', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'beach-rackets', 'one offline run is enough')
  await page.goto('./')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // A first install does not take over the open page; the next load is served by it.
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 10_000 })
    .toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: /^start/i })).toBeVisible()
  await context.setOffline(false)
})
