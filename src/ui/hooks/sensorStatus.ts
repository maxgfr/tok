/**
 * What a sensor shows: off when not wanted, starting until it has reported,
 * then what it reported. Only async outcomes are stored as `phase`.
 */
export const deriveStatus = <S extends string>(
  enabled: boolean,
  phase: S | 'off',
): S | 'off' | 'starting' => (!enabled ? 'off' : phase === 'off' ? 'starting' : phase)

/** A sensor that failed to start: refused by the user, or not there. */
export function failure(error: unknown): 'blocked' | 'unavailable' {
  const name = (error as DOMException | undefined)?.name
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : 'unavailable'
}
