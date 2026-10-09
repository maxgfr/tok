// Sport presets: how each game sounds, moves and is scored. The numbers are
// starting points — the mic panel in a session tunes sensitivity per sport and place.

import type { ScoringRules } from './scoring/index.ts'
import type { SensorKind } from './types.ts'

export type SportId =
  | 'beach-rackets'
  | 'volleyball'
  | 'beach-volley'
  | 'keepy-uppy'
  | 'table-tennis'
  | 'badminton'
  | 'tennis'
  | 'padel'
  | 'pickleball'
  | 'roundnet'
  | 'jump-rope'
  | 'custom'

export type Mode = 'rally' | 'match'

export type AutoSensor = Exclude<SensorKind, 'manual'>

export interface SportPreset {
  id: SportId
  name: string
  blurb: string
  modes: Mode[]
  /** What one count is called on screen. */
  unit: 'hits' | 'touches' | 'jumps'
  dominant: AutoSensor
  /** Trust in each sensor for this sport, 0..1 — feeds the fusion. */
  weights: Record<AutoSensor, number>
  refractoryMs: number
  rallyTimeoutMs: number
  /** Frequency band where this sport's contact sound lives. */
  bandHz: [number, number]
  /** Table tennis: the bounce on the table sounds like a hit too. */
  soundsPerHit: 1 | 2
  scoring: ScoringRules | null
}

const VOLLEYBALL_RULES: ScoringRules = {
  kind: 'rally',
  pointsToWin: 25,
  decidingSetPoints: 15,
  setsToWin: 3,
  winBy: 2,
  serve: 'winner',
  setStart: 'alternate',
}

const TENNIS_RULES: ScoringRules = {
  kind: 'tennis',
  setsToWin: 2,
  gamesPerSet: 6,
  tiebreakPoints: 7,
}

export const SPORTS: readonly SportPreset[] = [
  {
    id: 'beach-rackets',
    name: 'Beach rackets',
    blurb: 'Matkot, frescobol — keep the ball in the air together.',
    modes: ['rally'],
    unit: 'hits',
    dominant: 'audio',
    weights: { audio: 1, motion: 0.4, vision: 0.2 },
    refractoryMs: 250,
    rallyTimeoutMs: 2500,
    bandHz: [1500, 6000],
    soundsPerHit: 1,
    scoring: null,
  },
  {
    id: 'volleyball',
    name: 'Volleyball',
    blurb: 'Passing in a circle, or a full indoor match.',
    modes: ['rally', 'match'],
    unit: 'touches',
    dominant: 'vision',
    weights: { audio: 0.7, motion: 0.2, vision: 1 },
    refractoryMs: 300,
    rallyTimeoutMs: 4000,
    bandHz: [300, 3000],
    soundsPerHit: 1,
    scoring: VOLLEYBALL_RULES,
  },
  {
    id: 'beach-volley',
    name: 'Beach volley',
    blurb: 'Two against two in the sand, sets to 21.',
    modes: ['rally', 'match'],
    unit: 'touches',
    dominant: 'vision',
    weights: { audio: 0.6, motion: 0.2, vision: 1 },
    refractoryMs: 300,
    rallyTimeoutMs: 4000,
    bandHz: [300, 3000],
    soundsPerHit: 1,
    scoring: { ...VOLLEYBALL_RULES, pointsToWin: 21, setsToWin: 2 },
  },
  {
    id: 'keepy-uppy',
    name: 'Keepy-uppy',
    blurb: 'Football juggling or footvolley touches.',
    modes: ['rally'],
    unit: 'touches',
    dominant: 'vision',
    weights: { audio: 0.6, motion: 0.3, vision: 1 },
    refractoryMs: 250,
    rallyTimeoutMs: 2500,
    bandHz: [200, 2500],
    soundsPerHit: 1,
    scoring: null,
  },
  {
    id: 'table-tennis',
    name: 'Table tennis',
    blurb: 'Counts paddle hits by ear; matches to 11.',
    modes: ['rally', 'match'],
    unit: 'hits',
    dominant: 'audio',
    weights: { audio: 1, motion: 0.3, vision: 0.1 },
    refractoryMs: 100,
    rallyTimeoutMs: 1500,
    bandHz: [2000, 8000],
    soundsPerHit: 2,
    scoring: {
      kind: 'rally',
      pointsToWin: 11,
      setsToWin: 3,
      winBy: 2,
      serve: { every: 2, deuceEvery: 1 },
    },
  },
  {
    id: 'badminton',
    name: 'Badminton',
    blurb: 'Rallies by the sound of the shuttle; games to 21, capped at 30.',
    modes: ['rally', 'match'],
    unit: 'hits',
    dominant: 'audio',
    weights: { audio: 1, motion: 0.3, vision: 0.3 },
    refractoryMs: 300,
    rallyTimeoutMs: 3000,
    bandHz: [1000, 6000],
    soundsPerHit: 1,
    scoring: { kind: 'rally', pointsToWin: 21, setsToWin: 2, winBy: 2, cap: 30, serve: 'winner' },
  },
  {
    id: 'tennis',
    name: 'Tennis',
    blurb: 'Against the wall, or a match with games, sets and tie-breaks.',
    modes: ['rally', 'match'],
    unit: 'hits',
    dominant: 'audio',
    weights: { audio: 1, motion: 0.4, vision: 0.3 },
    refractoryMs: 300,
    rallyTimeoutMs: 3500,
    bandHz: [800, 5000],
    soundsPerHit: 1,
    scoring: TENNIS_RULES,
  },
  {
    id: 'padel',
    name: 'Padel',
    blurb: 'Tennis scoring, glass walls, lots of rallies.',
    modes: ['rally', 'match'],
    unit: 'hits',
    dominant: 'audio',
    weights: { audio: 1, motion: 0.4, vision: 0.3 },
    refractoryMs: 300,
    rallyTimeoutMs: 3500,
    bandHz: [800, 5000],
    soundsPerHit: 1,
    scoring: TENNIS_RULES,
  },
  {
    id: 'pickleball',
    name: 'Pickleball',
    blurb: 'That pock is easy to hear; rally scoring to 11.',
    modes: ['rally', 'match'],
    unit: 'hits',
    dominant: 'audio',
    weights: { audio: 1, motion: 0.3, vision: 0.3 },
    refractoryMs: 250,
    rallyTimeoutMs: 3000,
    bandHz: [1000, 5000],
    soundsPerHit: 1,
    scoring: { kind: 'rally', pointsToWin: 11, setsToWin: 2, winBy: 2, serve: 'winner' },
  },
  {
    id: 'roundnet',
    name: 'Roundnet',
    blurb: 'Spikeball — touches and net hits, games to 21.',
    modes: ['rally', 'match'],
    unit: 'touches',
    dominant: 'audio',
    weights: { audio: 1, motion: 0.2, vision: 0.6 },
    refractoryMs: 200,
    rallyTimeoutMs: 3000,
    bandHz: [500, 4000],
    soundsPerHit: 1,
    scoring: { kind: 'rally', pointsToWin: 21, setsToWin: 1, winBy: 2, serve: 'winner' },
  },
  {
    id: 'jump-rope',
    name: 'Jump rope',
    blurb: 'Keep the phone in a pocket; every jump counts.',
    modes: ['rally'],
    unit: 'jumps',
    dominant: 'motion',
    weights: { audio: 0.4, motion: 1, vision: 0 },
    refractoryMs: 180,
    rallyTimeoutMs: 1500,
    bandHz: [1000, 6000],
    soundsPerHit: 1,
    scoring: null,
  },
  {
    id: 'custom',
    name: 'Custom',
    blurb: 'Your own game: pick the sensors, the timeout and the rules.',
    modes: ['rally', 'match'],
    unit: 'hits',
    dominant: 'audio',
    weights: { audio: 1, motion: 1, vision: 1 },
    refractoryMs: 200,
    rallyTimeoutMs: 3000,
    bandHz: [500, 6000],
    soundsPerHit: 1,
    scoring: { kind: 'rally', pointsToWin: 21, setsToWin: 2, winBy: 2, serve: 'winner' },
  },
]

export function sport(id: SportId): SportPreset {
  const found = SPORTS.find((s) => s.id === id)
  if (!found) throw new Error(`Unknown sport: ${id}`)
  return found
}
