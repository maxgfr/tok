import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom ships none of the browser APIs the runtime touches. They are mocked
// here once; the engine never imports them, so tests stay deterministic.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia

if (!('randomUUID' in crypto)) {
  Object.defineProperty(crypto, 'randomUUID', {
    value: vi.fn(() => '00000000-0000-4000-8000-000000000000'),
  })
}

// -- Web Audio ---------------------------------------------------------------
// The cheapest context that answers the runtime's questions: it starts
// "running" and its nodes are no-ops.
class MockAudioContext {
  currentTime = 0
  state = 'running'

  async resume(): Promise<void> {}

  createOscillator(): OscillatorNode {
    return {
      type: 'sine',
      frequency: { value: 0 },
      connect: () => {},
      start: () => {},
      stop: () => {},
    } as unknown as OscillatorNode
  }

  createGain(): GainNode {
    const node = {
      gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
      connect: () => {},
    }
    return node as unknown as GainNode
  }

  get destination(): AudioDestinationNode {
    return {} as AudioDestinationNode
  }
}

globalThis.AudioContext ??= MockAudioContext as unknown as typeof AudioContext

// -- Notifications -----------------------------------------------------------
class MockNotification extends EventTarget {
  static permission: NotificationPermission = 'default'

  static async requestPermission(): Promise<NotificationPermission> {
    return MockNotification.permission
  }

  title: string

  constructor(title: string, _options?: NotificationOptions) {
    super()
    this.title = title
  }
}

globalThis.Notification ??= MockNotification as unknown as typeof Notification

// -- Wake Lock ---------------------------------------------------------------
Object.defineProperty(navigator, 'wakeLock', {
  value: {
    request: vi.fn(async () => ({
      release: async () => {},
      addEventListener: () => {},
    })),
  },
  configurable: true,
})

// -- requestAnimationFrame ---------------------------------------------------
// jsdom only has rAF in "visual" mode; the stopwatch tenths need it.
if (typeof window.requestAnimationFrame !== 'function') {
  window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
    window.setTimeout(() => callback(performance.now()), 16)
  window.cancelAnimationFrame = (handle: number): void => window.clearTimeout(handle)
}
