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

let users = 0

/**
 * Marks the shared context as in use (the mic, the coach's sounds) until the
 * returned release; the last release suspends it, so an idle context does
 * not keep the audio thread awake, nor cut a sound another user still plays.
 */
export function retainAudio(): () => void {
  users += 1
  let held = true
  return () => {
    if (!held) return
    held = false
    users -= 1
    if (users === 0 && context?.state === 'running') void context.suspend()
  }
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
