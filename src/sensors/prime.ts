// Called inside the tap that starts a session: iOS only lets audio start and
// motion be read from a user gesture. Kept apart from the sensors themselves so
// the setup screen loads without them.

let context: AudioContext | null = null

/** Creates (or resumes) the shared AudioContext. */
export function primeAudio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  context ??= new AudioContext({ latencyHint: 'interactive' })
  if (context.state === 'suspended') void context.resume()
  return context
}

type PermissionFn = () => Promise<'granted' | 'denied'>

const requestPermission = (): PermissionFn | undefined =>
  (globalThis.DeviceMotionEvent as unknown as { requestPermission?: PermissionFn } | undefined)
    ?.requestPermission

let permission: Promise<boolean> | null = null

/** Resolves to whether motion may be read. */
export function primeMotion(): Promise<boolean> {
  if (typeof DeviceMotionEvent === 'undefined') return Promise.resolve(false)
  const ask = requestPermission()
  permission ??= ask
    ? ask()
        .then((r) => r === 'granted')
        .catch(() => false)
    : Promise.resolve(true)
  return permission
}
