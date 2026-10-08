import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

// Chromium plays a WAV file as the microphone, so the whole chain — getUserMedia,
// AudioWorklet, onset detector, rally machine, UI — runs on a known recording.
const fakeMic = (file: string) => ({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${resolve('fixtures', file)}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
})

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4174/tok/', viewport: { width: 390, height: 844 } },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4174 --strictPort',
    url: 'http://localhost:4174/tok/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'beach-rackets', use: { browserName: 'chromium', ...fakeMic('beach-rackets.wav') } },
    { name: 'table-tennis', use: { browserName: 'chromium', ...fakeMic('table-tennis.wav') } },
  ],
})
