import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearAll } from '../store/db.ts'
import { listMicrophones, loadMicDevice, saveMicDevice } from './micDevice.ts'

const device = (kind: string, deviceId: string, label = '') =>
  ({ kind, deviceId, label, groupId: '' }) as MediaDeviceInfo

let labels = false
const stop = vi.fn()
beforeEach(async () => {
  await clearAll()
  labels = false
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: async () => [
        device('audioinput', 'default', labels ? 'Default' : ''),
        device('audioinput', 'built-in', labels ? 'iPhone Microphone' : ''),
        device('audioinput', 'headset', labels ? 'AirPods' : ''),
        device('videoinput', 'cam', labels ? 'Back camera' : ''),
      ],
      getUserMedia: vi.fn(async () => {
        labels = true
        return { getTracks: () => [{ stop }] }
      }),
    },
  })
})
afterEach(() => {
  stop.mockClear()
})

test('the system default is used until a microphone is chosen', async () => {
  expect(await loadMicDevice()).toBe('')
  await saveMicDevice('headset')
  expect(await loadMicDevice()).toBe('headset')
})

test('lists the microphones, not the cameras nor the default alias', async () => {
  labels = true
  expect(await listMicrophones()).toEqual([
    { id: 'built-in', label: 'iPhone Microphone', named: true },
    { id: 'headset', label: 'AirPods', named: true },
  ])
})

test('names stay hidden until asked; asking opens the mic once and closes it', async () => {
  expect((await listMicrophones()).map((m) => m.label)).toEqual(['Microphone 1', 'Microphone 2'])
  expect((await listMicrophones({ ask: true })).map((m) => m.label)).toEqual([
    'iPhone Microphone',
    'AirPods',
  ])
  expect(stop).toHaveBeenCalled()
})
