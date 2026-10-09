import { expect, test } from '@playwright/test'
import { DEFAULT_THRESHOLD } from '../src/engine/onset.ts'
import { sensitivityToThreshold } from '../src/ui/thresholds.ts'

type Seen = { threshold?: number; type?: string; value?: number }

test('the sensitivity set in the Lab is the one a session counts with', async ({ page }, info) => {
  test.skip(info.project.name !== 'beach-rackets', 'one sport is enough to prove it')
  // Keep what the page tells the onset detector: its options at start, then
  // every setting pushed to it while it runs.
  await page.addInitScript(() => {
    const seen: unknown[] = []
    Object.assign(window, { detector: seen })
    const Native = AudioWorkletNode
    window.AudioWorkletNode = class extends Native {
      constructor(context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
        super(context, name, options)
        seen.push(options?.processorOptions)
        const post = this.port.postMessage.bind(this.port)
        this.port.postMessage = (message: unknown) => {
          seen.push(message)
          post(message)
        }
      }
    } as typeof AudioWorkletNode
  })
  const detector = () => page.evaluate(() => (window as unknown as { detector: Seen[] }).detector)

  await page.goto('./#/lab')
  await page.getByRole('combobox', { name: 'Sport' }).selectOption({ label: 'Beach rackets' })
  await expect(page.getByText('Used in every Beach rackets session.')).toBeVisible()
  await page.getByRole('button', { name: 'Start listening' }).click()
  await page.getByRole('slider', { name: 'Sensitivity' }).fill('0')
  await expect(page.locator('output[for="sensitivity"]')).toHaveText('0')

  await page.getByRole('link', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'Beach rackets', exact: true }).click()
  await page.getByText('Auto — listen').click()
  await page.getByRole('button', { name: /^start/i }).click()
  await expect(page.getByText('Listening')).toBeVisible({ timeout: 10_000 })

  // The session's detector starts at the Lab's value…
  const started = (await detector()).filter((m) => m && 'threshold' in m).at(-1)
  expect(started?.threshold).toBeCloseTo(sensitivityToThreshold(0))

  // …and "Default" in the session's mic panel moves it live, without a restart.
  await page.getByRole('button', { name: 'Microphone sensitivity' }).click()
  await page.getByRole('button', { name: 'Default' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect
    .poll(async () => (await detector()).filter((m) => m?.type === 'threshold').at(-1)?.value)
    .toBe(DEFAULT_THRESHOLD)

  // Still counting every hit of the recording.
  await expect(page.getByRole('button', { name: 'Add a hit. Current rally: 10' })).toBeVisible({
    timeout: 30_000,
  })
})
