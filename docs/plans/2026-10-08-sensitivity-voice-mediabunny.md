---
status: approved
---

# tok — in-session sensitivity & resets, voice filter, Mediabunny recording, efficiency pass

## Goal

During a session, the player can tap the mic chip to set sensitivity, see what the mic hears, turn the voice filter on or off, and reset the sensitivity to its default. They can restart the current rally at 0 in one tap. The value chosen in the Lab is exactly the value Live counts with. The player's voice no longer counts as hits. Recordings are MP4 files with exact timing, a key frame at each rally, and a "share this rally" clip. The phone does less work per session, first load is lighter, and CI builds once and deploys only when it is green. `pnpm verify` and `pnpm e2e` pass.

## Locked constraints

- Q-001: all four areas (battery/CPU, first load, tests & CI, cleanup) → S-010…S-024
- Q-002: deploy only after a green CI, reusing its build → S-024
- Q-003: keep saving after every rally → non-goal (no debounce)
- Q-004: reset both the sensitivity (to default) and the current rally (to 0) → S-002, S-001, S-008
- Q-005: sensitivity panel opened from the mic chip → S-006, S-007, S-008
- Q-006: an in-session change is kept for that sport, shared with the Lab → S-005
- Q-007: sensitivity work first, then efficiency, in one plan → step order
- User: "once selected in the Lab it must apply" → Lab and Live share the same detector path and value; the Lab says which sport it applies to; E2E proves it → S-004, S-009
- Q-008: Mediabunny, falling back to MediaRecorder → S-016, S-017
- Q-009: "Share this rally" clip → S-018
- Q-010: acoustic voice filter, no ML model → S-003
- Q-011: voice filter on by default, can be turned off per sport → S-003, S-005, S-006
- User: "make it optimal" → hot paths allocation-free, heavy modules lazy-loaded, one build in CI

## Grounded facts

- `src/engine/onset.ts:103-104` `push()` allocates `out: Onset[]` on every 128-sample call; `:130` `Math.hypot` per band bin; `:142-148` two `Float32Array.sort()` per frame (~375/s); `:158,173` new `last`/`prev` objects per frame.
- `src/engine/onset.ts:41` `DEFAULT_THRESHOLD = 8`; `:183` `calibrateThreshold`.
- `src/engine/motionPeaks.ts:30` median copies and sorts; `:54` 3-argument `Math.hypot`; `:60-67` array map, push and `shift()` per sample.
- `src/sensors/onset.worklet.ts:59-62` posts a level message ~30/s on every screen; processor options come from `src/sensors/audio.ts:55-65`; `audio.ts:82` resumes again although `primeAudio` (`:18`) already did; `stop()` at `audio.ts:87` never suspends the shared `AudioContext` (`:9-19`).
- `src/ui/hooks/useLiveSession.ts:101-102` 200 ms `setInterval` tick for the whole session; `:73,91-92` keeps every past session in state; `:71-72` `startedAt`/`openedAt` duplicate; `:39` `sensors` field unused by callers.
- `src/engine/live.ts:24-25` `LiveAction` = `RallyEvent | point | undoPoint`; `:47` `liveStep`; `:81` `undoPoint`; `:93` default branch.
- `src/ui/screens/Lab.tsx:61` filters candidates by score while `:70` runs the worklet at `CALIBRATION_THRESHOLD` (3), so Lab ≠ Live counting; `:42` sport comes from `loadConfig`; `:45` `loadThreshold`; `:189-191` slider saves via `saveThreshold`.
- `src/ui/thresholds.ts:6,9,13-14,16,22` load/save/min/max/mappings; `src/store/db.ts` has `getSetting`/`setSetting` but no delete.
- `src/ui/hooks/useSensors.ts:154` `setThreshold` pushes live to the worklet; Live passes `useSensors` at `src/ui/screens/Live.tsx` (header `SensorChips` at `:167`; footer buttons `:291-306`; Goal `<Stat>` at `:277-281` missing `bright`).
- `src/ui/components/SensorChips.tsx:37` renders `<li>` chips, none clickable.
- `src/record/recorder.ts:35-41` rAF draws 1280×720 + overlay at display rate, `captureStream(30)`; the loop starts before `openVideoWriter`/`new MediaRecorder` (`:44-45`), so it leaks on error. `src/record/overlay.ts` re-sets `ctx.font` and `fillText` every frame.
- `src/sensors/vision.ts:18,43-61` 66 ms interval, `createImageBitmap` at 640 wide; `vision.worker.ts:51-55` `getContext`, `getImageData` and a new gray buffer per frame; `src/ui/hooks/useVision.ts:29-44` restarts the worker (and reloads the model) on every camera toggle.
- `src/ui/components/Tally.tsx:20,28,68,75` not memoised; layout and style objects recomputed every render.
- `src/ui/App.tsx:6-12` every screen imported statically → one 323 KB main chunk (`dist/assets/index-*.js`).
- `vite.config.ts:107` `includeAssets` duplicates `globPatterns` (`:137`); `:138` `globIgnores: ['models/**']` leaves the 154 KB vision worker precached; `:158-161` vitest `environment: 'jsdom'` for all tests.
- `playwright.config.ts:21-25` `webServer` runs `pnpm build`; `.github/workflows/ci.yml` builds in verify and again in e2e; `deploy.yml:31-33` installs and builds a third time, in parallel with CI.
- `src/engine/sports.ts:125` table tennis weights `{ audio: 1, motion: 0.3, vision: 0.1 }`; `:69` beach rackets `{ audio: 1, motion: 0.4, vision: 0.2 }`; `src/engine/fusion.ts:30` `accept = 0.6` → on these two sports video never adds a hit alone; `Live.tsx:69` ball-on-ground still ends a rally.
- Mediabunny (npm `mediabunny`, MPL-2.0, zero deps, WebCodecs): `Output` + `Mp4OutputFormat({ fastStart: 'fragmented' })` keeps memory bounded and is append-only; `StreamTarget(writable, { chunked: true })` emits `{ data, position }`; `CanvasSource.add(timestamp, duration, { keyFrame })`; `MediaStreamAudioTrackSource(track, …)`; `Conversion.init({ input, output, trim: { start, end } })` transcodes when `start` is set. Exact option and helper names (`canEncode*`, `QUALITY_*`, `BlobSource`, `ALL_FORMATS`) to be read from `node_modules/mediabunny/dist/*.d.ts` in S-016 (assumption until then).

## Non-goals

- No change to how video counts hits or ends rallies (it answers the user's question; weights stay as they are).
- No debounced saves (Q-003). No ML speech model (Q-010). No change to scoring rules, the visual world or DESIGN.md tokens.

## Steps

### S-001 — Engine: `discard` action restarts the current rally at 0

- **Files:** Modify `src/engine/live.ts` · Test `src/engine/live.test.ts`
- **Depends on:** none
- **Change:** add `| { type: 'discard' }` to `LiveAction`. In `liveStep`, add a `case 'discard'` that returns `{ ...state, rally: idleRally(), lastEnded: null }`; `rallies` and `awaitingWinner` are unchanged. Tests: "discard drops the rally in progress without recording it"; "discard when idle keeps completed rallies".
- **Preserve:** `undo`, `undoPoint`, and tick identity (a no-op tick returns the same state).
- **Verify:** `pnpm vitest run src/engine/live`

### S-002 — Store: delete a setting; thresholds reset to default

- **Files:** Modify `src/store/db.ts`, `src/ui/thresholds.ts` · Test `src/store/db.test.ts`, Create `src/ui/thresholds.store.test.ts`
- **Depends on:** none
- **Change:** `deleteSetting(key)`; `resetThreshold(sportId)`; `loadVoiceFilter(sportId)` (default `true`) and `saveVoiceFilter(sportId, on)` under `voiceFilter:<sportId>`. Tests: save 20 → reset → default; voice filter defaults true and round-trips false.
- **Preserve:** existing keys and `importAll`/`exportAll` behaviour.
- **Verify:** `pnpm vitest run src/store src/ui/thresholds`

### S-003 — Onset detector: acoustic voice filter (decay test), allocation-free hot path

- **Files:** Modify `src/engine/onset.ts`, `src/test/synth.ts` · Test `src/engine/onset.test.ts`, `src/engine/fixtures.test.ts`
- **Depends on:** none
- **Change:** `voiceFilter` (default true), `decayMs` (80), `decayRatio` (0.3); band energy; pending onset confirmed when band energy decays below `decayRatio × peak` within `decayMs`, else rejected (`rejected` counter); refractory from pending `t`; median/MAD every 4th frame; mutate `last`/`prev` in place; shared empty array from `push()`; `speech()` synth; tests for syllables rejected, filter off counts them, hits counted next to talking.
- **Preserve:** the `Onset` shape; `t` stays the onset time; `level()` keeps `median` and `spread`.
- **Verify:** `pnpm vitest run src/engine/onset src/engine/fixtures`

### S-004 — Worklet & audio sensor: live threshold, voice filter, levels only on demand

- **Files:** Modify `src/sensors/onset.worklet.ts`, `src/sensors/audio.ts`, `src/ui/hooks/useSensors.ts`
- **Depends on:** S-003
- **Change:** processor options `voiceFilter`, `levels`; port messages `threshold`/`voiceFilter`/`levels`; levels only while enabled, carrying `rejected`; `setVoiceFilter`/`setLevels` on `AudioSensor`; drop redundant resume; suspend on stop; `useSensors` loads the voice filter, exposes the setters, takes `levels`.
- **Preserve:** `agedPerf` timestamps, the network-free worklet.
- **Verify:** `pnpm typecheck && pnpm vitest run src/ui`

### S-005 — `useSensitivity(sportId)`: one source of truth for Lab and Live

- **Files:** Create `src/ui/hooks/useSensitivity.ts` · Test `src/ui/hooks/useSensitivity.test.tsx`
- **Depends on:** S-002
- **Change:** `{ threshold, sensitivity, voiceFilter, setSensitivity, setVoiceFilter, reset }` with optional `onChange`.
- **Preserve:** the storage keys from S-002.
- **Verify:** `pnpm vitest run src/ui/hooks/useSensitivity`

### S-006 — `SensitivityPanel` component

- **Files:** Create `src/ui/components/SensitivityPanel.tsx` · Test `src/ui/components/SensitivityPanel.test.tsx`
- **Depends on:** S-005
- **Change:** native `<dialog>` sheet with LevelTrace, range, "Ignore voices" toggle, rejected count, Default and Done.
- **Preserve:** the chalkboard tokens.
- **Verify:** `pnpm vitest run src/ui/components/SensitivityPanel`

### S-007 — Mic chip opens the panel

- **Files:** Modify `src/ui/components/SensorChips.tsx` · Test `src/ui/components/SensorChips.test.tsx`
- **Depends on:** none
- **Change:** optional `onAudio`; the audio chip becomes a button "Microphone sensitivity" with a chevron.
- **Preserve:** status texts and hidden secondary failures.
- **Verify:** `pnpm vitest run src/ui/components/SensorChips`

### S-008 — Live: panel, live threshold, restart-at-0, Goal label fix

- **Files:** Modify `src/ui/screens/Live.tsx`, `src/ui/hooks/useLiveSession.ts`, `src/ui/components/Tally.tsx` · Test `src/ui/App.test.tsx`, `src/ui/components/Tally.test.tsx`
- **Depends on:** S-001, S-004, S-006, S-007
- **Change:** `restartRally()`; panel wiring; Restart footer button; Goal `bright`; Tally strikes through on any decrease.
- **Preserve:** `End`, Undo, pocket and camera flows, `close()`.
- **Verify:** `pnpm vitest run src/ui`

### S-009 — Lab counts exactly like Live; says what it applies to; E2E proof

- **Files:** Modify `src/ui/screens/Lab.tsx` · Create `e2e/sensitivity.spec.ts`
- **Depends on:** S-004, S-005, S-006
- **Change:** `useSensitivity`; worklet at the player's threshold; no score filter; calibration at `CALIBRATION_THRESHOLD`; levels on; voice toggle and rejected count; "Used in every <Sport> session."; E2E.
- **Preserve:** calibration via `calibrateThreshold`, per-sport storage.
- **Verify:** `pnpm exec playwright test e2e/sensitivity.spec.ts`

### S-010 — Tick only when a rally can time out

- **Files:** Modify `src/ui/hooks/useLiveSession.ts` · Test `src/ui/hooks/useLiveSession.test.tsx`
- **Depends on:** S-008
- **Change:** a `setTimeout` armed at the rally timeout instead of a 200 ms interval.
- **Preserve:** the timeout semantics of `rally.ts`.
- **Verify:** `pnpm vitest run src/ui/hooks/useLiveSession`

### S-011 — Live session keeps a summary, not every past session

- **Files:** Modify `src/ui/hooks/useLiveSession.ts`
- **Depends on:** S-010
- **Change:** `before: Summary`; drop `openedAt`; reuse `sessionBest`; drop `sensors`.
- **Preserve:** verdicts; `best`/`todayBest`.
- **Verify:** `pnpm vitest run src/ui`

### S-012 — Motion peaks: ring buffer, cached stats

- **Files:** Modify `src/engine/motionPeaks.ts`
- **Depends on:** none
- **Change:** ring buffer, cached median/MAD, `Math.sqrt`, `prev` in place.
- **Preserve:** the API and existing tests.
- **Verify:** `pnpm vitest run src/engine/motionPeaks`

### S-013 — Vision: smaller frames, frame-paced, worker kept per session

- **Files:** Modify `src/sensors/vision.ts`, `src/sensors/vision.worker.ts`, `src/ui/hooks/useVision.ts`
- **Depends on:** none
- **Change:** 320/96 px frames; `requestVideoFrameCallback` pacing; module worker singleton; cached context and gray buffers.
- **Preserve:** network lock; message shapes.
- **Verify:** `pnpm exec playwright test e2e/vision.spec.ts`

### S-014 — Tally memoised

- **Files:** Modify `src/ui/components/Tally.tsx`
- **Depends on:** S-008
- **Change:** `memo`, `useMemo`, hoisted styles.
- **Preserve:** `Tally.test.tsx` behaviour.
- **Verify:** `pnpm vitest run src/ui/components/Tally`

### S-015 — LevelTrace draws only when new data arrives

- **Files:** Modify `src/ui/components/LevelTrace.tsx`
- **Depends on:** none
- **Change:** skip unchanged frames; `ResizeObserver`; binary search.
- **Preserve:** visuals and props.
- **Verify:** `pnpm typecheck && pnpm vitest run src/ui`

### S-016 — Mediabunny recorder (MP4, exact time, key frame per rally) with MediaRecorder fallback

- **Files:** `pnpm add mediabunny` · Create `src/record/encoder.ts` · Modify `src/record/recorder.ts`, `src/record/overlay.ts`, `src/record/videoStore.ts`, `src/ui/hooks/useCamera.ts` · Test `src/record/overlay.test.ts`
- **Depends on:** none
- **Change:** see the approved plan text: encoder, positioned sink, lazy import, frame-paced loop started after the sink, `markRally()`, cached overlay plate.
- **Preserve:** `VideoRef`, multi-part videos, chapters/VTT, privacy gate.
- **Verify:** `pnpm vitest run src/record && pnpm build && pnpm check:network`

### S-017 — Key frame at each rally start

- **Files:** Modify `src/ui/screens/Live.tsx`
- **Depends on:** S-016, S-008
- **Verify:** `pnpm exec playwright test e2e/recording.spec.ts`

### S-018 — "Share this rally" clip

- **Files:** Create `src/record/clip.ts` · Modify `src/ui/screens/Replay.tsx` · Create `e2e/clip.spec.ts`
- **Depends on:** S-016
- **Verify:** `pnpm exec playwright test e2e/clip.spec.ts`

### S-019 — Lazy-load screens

- **Files:** Modify `src/ui/App.tsx`
- **Depends on:** S-008, S-009, S-018
- **Verify:** `pnpm verify` and main chunk < 250 KB

### S-020 — PWA precache: vision worker on demand, no duplicates

- **Files:** Modify `vite.config.ts`
- **Depends on:** none
- **Verify:** `pnpm build && grep -c "vision.worker" dist/sw.js` and `pnpm exec playwright test e2e/offline.spec.ts`

### S-021 — `useLatest` hook and shared sensor-status helpers

- **Depends on:** S-008, S-009, S-013, S-016
- **Verify:** `pnpm vitest run`

### S-022 — Small cleanups

- **Depends on:** S-014, S-015
- **Verify:** `pnpm verify`

### S-023 — Engine tests in Node

- **Depends on:** S-003, S-012
- **Verify:** `pnpm test`

### S-024 — One CI pipeline: build once, E2E on that build, deploy after green

- **Files:** Modify `.github/workflows/ci.yml`, `playwright.config.ts` · Delete `.github/workflows/deploy.yml`
- **Depends on:** S-019, S-020
- **Verify:** push the branch → `gh run watch` → `verify`, `e2e`, `deploy` succeed on main; `curl -sI https://maxgfr.github.io/tok/` → 200.

## Verification (end to end)

1. `pnpm verify` → pass; main chunk < 250 KB; `check:network` zero outbound origins.
2. `pnpm e2e` → all pass.
3. On a phone: talk between hits, count must not move; mic chip panel; Restart mid-rally; Share this rally.
4. CI: one workflow run, three jobs green, then the site deploys.
