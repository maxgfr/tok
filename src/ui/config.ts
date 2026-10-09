import type { Side } from '../engine/scoring/index.ts'
import { sport, type Mode, type SportId } from '../engine/sports.ts'
import { getSetting, setSetting } from '../store/db.ts'

/** How hits are counted: taps (the default, always right), or every sensor (experimental). */
export type InputMode = 'auto' | 'manual'

export interface LiveConfig {
  sportId: SportId
  mode: Mode
  input: InputMode
  names: { A: string; B: string }
  firstServer: Side
}

export const DEFAULT_CONFIG: LiveConfig = {
  sportId: 'table-tennis',
  mode: 'rally',
  input: 'manual',
  names: { A: 'Me', B: 'You' },
  firstServer: 'A',
}

/** Keeps a stored config valid after presets change. */
export function normalizeConfig(config: Partial<LiveConfig>): LiveConfig {
  const merged = { ...DEFAULT_CONFIG, ...config }
  let preset
  try {
    preset = sport(merged.sportId)
  } catch {
    return DEFAULT_CONFIG
  }
  if (!preset.modes.includes(merged.mode)) merged.mode = preset.modes[0] ?? 'rally'
  return merged
}

export async function loadConfig(): Promise<LiveConfig> {
  return normalizeConfig(await getSetting<Partial<LiveConfig>>('lastConfig', {}))
}

export async function saveConfig(config: LiveConfig): Promise<void> {
  await setSetting('lastConfig', config)
}
