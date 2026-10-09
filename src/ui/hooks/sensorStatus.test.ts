import { expect, test } from 'vitest'
import { deriveStatus, failure } from './sensorStatus.ts'

test('a sensor is off when disabled, starting until it reports, then what it reported', () => {
  expect(deriveStatus(false, 'on')).toBe('off')
  expect(deriveStatus(true, 'off')).toBe('starting')
  expect(deriveStatus(true, 'recording')).toBe('recording')
})

test('a refused permission is blocked, anything else unavailable', () => {
  expect(failure(new DOMException('no', 'NotAllowedError'))).toBe('blocked')
  expect(failure(new DOMException('no', 'SecurityError'))).toBe('blocked')
  expect(failure(new DOMException('no', 'NotFoundError'))).toBe('unavailable')
  expect(failure(undefined)).toBe('unavailable')
})
