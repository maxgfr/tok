// Which microphone tok listens with: the system default unless the player
// picks one (a headset, a clip-on mic). One choice for every sport.

import { getSetting, setSetting } from '../store/db.ts'

/** `''` means the system default. */
export const loadMicDevice = (): Promise<string> => getSetting('micDevice', '')

export const saveMicDevice = (id: string): Promise<void> => setSetting('micDevice', id)

export interface Microphone {
  id: string
  label: string
  /** False until the mic has been allowed: the label is then only "Microphone 2". */
  named: boolean
}

// 'default' and 'communications' are aliases of a device that is listed too.
const ALIASES = ['default', 'communications']

const inputs = async (): Promise<MediaDeviceInfo[]> =>
  (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'audioinput' && d.deviceId && !ALIASES.includes(d.deviceId),
  )

/**
 * The microphones this device has. Browsers hide their names until the mic has
 * been allowed once; with `ask`, tok opens it for a moment to learn them.
 */
export async function listMicrophones({ ask = false } = {}): Promise<Microphone[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  let devices = await inputs()
  if (ask && devices.some((d) => !d.label)) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    for (const track of stream.getTracks()) track.stop()
    devices = await inputs()
  }
  return devices.map((d, i) => ({
    id: d.deviceId,
    label: d.label || `Microphone ${i + 1}`,
    named: !!d.label,
  }))
}
