// Test double for vite-plugin-pwa's virtual module. Tests flip `state` to
// simulate a waiting service worker.
import { useState } from 'react'
import { vi } from 'vitest'

export const state = { needRefresh: false, offlineReady: false }
export const updateServiceWorker = vi.fn(async () => {})

export function useRegisterSW() {
  const needRefresh = useState(state.needRefresh)
  const offlineReady = useState(state.offlineReady)
  return { needRefresh, offlineReady, updateServiceWorker }
}
