import { expect, test } from '@playwright/test'
import { DEFAULT_THRESHOLD } from '../src/engine/onset.ts'
import { sensitivityToThreshold } from '../src/ui/thresholds.ts'

type Seen = { threshold?: number; type?: string; value?: number }

test('the sensitivity set during a session is kept for the sport', async ({ page }, info) => {
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

  const startSession = async () => {
    await page.getByRole('button', { name: 'Beach rackets', exact: true }).click()
    await page.getByText('Auto — listen').click()
    await page.getByRole('button', { name: /^start/i }).click()
    await expect(page.getByText('Listening')).toBeVisible({ timeout: 10_000 })
  }
  const lastPushed = async () => (await detector()).findLast((m) => m?.type === 'threshold')?.value
  const lastStarted = async () =>
    (await detector()).findLast((m) => m && 'threshold' in m && !m.type)?.threshold

  await page.goto('./')
  await startSession()
  expect(await lastStarted()).toBeCloseTo(DEFAULT_THRESHOLD)

  // The mic chip opens the sport's settings; the slider moves the detector live.
  await page.getByRole('button', { name: 'Microphone sensitivity' }).click()
  await expect(page.getByRole('heading', { name: 'Sensitivity · Beach rackets' })).toBeVisible()
  await page.getByRole('slider', { name: 'Sensitivity' }).fill('0')
  await expect.poll(lastPushed).toBeCloseTo(sensitivityToThreshold(0))
  await page.getByRole('button', { name: 'Done' }).click()

  // The next session of that sport starts where this one left it…
  await page.getByRole('button', { name: 'End session' }).click()
  await page.getByRole('button', { name: 'End', exact: true }).click()
  await page.getByRole('link', { name: 'Play' }).click()
  await startSession()
  expect(await lastStarted()).toBeCloseTo(sensitivityToThreshold(0))

  // …and Default brings it back, still live.
  await page.getByRole('button', { name: 'Microphone sensitivity' }).click()
  await page.getByRole('button', { name: 'Default' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect.poll(lastPushed).toBe(DEFAULT_THRESHOLD)
  await expect(page.getByRole('button', { name: 'Add a hit. Current rally: 10' })).toBeVisible({
    timeout: 30_000,
  })
})
