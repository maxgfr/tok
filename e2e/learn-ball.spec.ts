import { expect, test } from '@playwright/test'

test('tok learns the ball from a few hits, then counts it and only it', async ({ page }, info) => {
  test.skip(info.project.name !== 'beach-rackets', 'one sport is enough to prove it')
  await page.goto('./')
  await page.getByRole('button', { name: 'Beach rackets', exact: true }).click()
  await page.getByText('Auto · experimental').click()
  await page.getByRole('button', { name: /^start/i }).click()
  await expect(page.getByText('Listening')).toBeVisible({ timeout: 10_000 })

  // Six hits of the recording, on purpose: tok knows the ball.
  await page.getByRole('button', { name: 'Microphone sensitivity' }).click()
  await expect(page.getByText('Learning your ball: 0 of 8 hits')).toBeVisible()
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await expect(page.getByText('Got it: tok knows your ball')).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText(/^Not your ball: \d+$/)).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // From then on, only sounds like it count: the next rally is counted whole.
  await expect(page.getByRole('button', { name: 'Add a hit. Current rally: 10' })).toBeVisible({
    timeout: 30_000,
  })
})
