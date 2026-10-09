import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// Pure tests (engine, clock) run in Node, with no DOM to mock.
if (typeof window !== 'undefined') await import('./dom.ts')
