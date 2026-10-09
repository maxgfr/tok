---
status: approved
---

# tok — manual first, player-ended rallies, live mode switch, mic picker, corrections

## Goal

tok is useful even when detection misses: Manual (taps) is the default mode and Auto (every sensor, marked experimental) is one tap away, during a session too. Rallies end only when the player says so. The microphone can be chosen. A rally's count can be corrected or deleted afterwards, and every record follows. The pocket-mode button reads as a lock.

## Locked constraints

- Q-001 — the player ends every rally, in Auto too → no silence timeout and no "ball on the ground" ending → S-001
- Q-002 — two modes, "Manual" (default) and "Auto · experimental" → S-002
- Q-003 — Auto keeps every sensor (mic, motion, camera ball tracking), experimental → S-002 (labels only, sensors unchanged)
- Q-004 — the mode can be switched during a session → S-003
- Q-005 — a microphone picker, in Settings at least → S-005 (Settings and the mic panel)
- Q-006 — the moon is unclear → a lock → S-004
- Q-007 — all four: manual first, earbud clicker promoted, corrections after the fact, honest Auto with "Switch to manual" → S-002, S-006, S-007, S-008

## Grounded facts

- `src/engine/rally.ts:59-63` a `tick` past `timeoutMs` closes the rally; `src/ui/hooks/useLiveSession.ts` arms that tick.
- `src/ui/screens/Live.tsx` passes `onGround` to `useVision`, which dispatches `{ type: 'end', reason: 'ground' }`.
- `src/ui/config.ts:6,19` `InputMode = 'auto' | 'manual'`, default `'auto'`.
- `src/ui/App.tsx` keys `<Live>` on `JSON.stringify(config)`: changing `config` remounts the session.
- `src/sensors/audio.ts` calls `getUserMedia` with no `deviceId`.
- `src/engine/stats.ts:14` `countHits`; called from `stats.ts:58,86`, `record/chapters.ts:26`, `useLiveSession.ts`, `SessionDetail.tsx:35`, `History.tsx:118`.
- `src/engine/types.ts:23-30` `Rally` has no count override.
- `src/ui/screens/Settings.tsx:111-117` "Earbuds as a clicker" toggle, hint starts "Experimental."

## Non-goals

- No change to detection, fusion weights or scoring rules.
- `rally.ts` keeps its timeout logic (tested, harmless); the app just stops ticking.

## Steps

### S-001 — Rallies end only when the player ends them

- **Files:** Modify `src/ui/hooks/useLiveSession.ts`, `src/ui/screens/Live.tsx`, `src/ui/hooks/useVision.ts` · Test `src/ui/hooks/useLiveSession.test.tsx`, `e2e/auto-count.spec.ts`, `e2e/sensitivity.spec.ts`
- **Depends on:** none
- **Change:** remove the timeout timer effect; make `useVision`'s `onGround` optional and stop passing it from Live. Tests: "a rally waits for End rally, however long the silence"; the future-stamp test asserts the stored hit is clamped to now. E2E: wait for `Current rally: 10`, then click End rally, then expect "New record — 10!".
- **Preserve:** End rally, Undo, Restart, match points, finish() closing an open rally.
- **Verify:** `pnpm vitest run src/ui/hooks/useLiveSession` → pass

### S-002 — Manual by default; Auto marked experimental

- **Files:** Modify `src/ui/config.ts`, `src/ui/screens/Home.tsx` · Test `src/ui/config.test.ts`, `src/ui/App.test.tsx`
- **Depends on:** none
- **Change:** `DEFAULT_CONFIG.input = 'manual'`; Home options "Manual" / "Auto · experimental" with one hint each (manual: tap anywhere, earbuds can click; auto: mic, motion and camera listen, you end each rally).
- **Verify:** `pnpm vitest run src/ui/config src/ui/App` → pass

### S-003 — Switch Manual / Auto during a session

- **Files:** Modify `src/ui/screens/Live.tsx` · Test `src/ui/App.test.tsx`
- **Depends on:** S-001, S-002
- **Change:** Live keeps `input` in state (from `config.input`); a header button `aria-label="Counting by hand. Switch to Auto"` / `"Counting with sensors. Switch to Manual"` toggles it, primes audio and motion inside the tap, saves `lastConfig.input`. Sensors, vision and `useLiveSession` use the effective input.
- **Preserve:** the session (no remount), its rallies.
- **Verify:** `pnpm vitest run src/ui/App` → pass

### S-004 — Pocket mode button is a lock

- **Files:** Modify `src/ui/screens/Live.tsx`
- **Depends on:** S-003
- **Change:** `Moon` → `Lock`, label "Lock the screen".
- **Verify:** `pnpm typecheck` → pass

### S-005 — Choose the microphone

- **Files:** Create `src/ui/micDevice.ts` · Modify `src/sensors/audio.ts`, `src/ui/hooks/useSensors.ts`, `src/ui/screens/Settings.tsx`, `src/ui/components/SensitivityPanel.tsx`, `src/ui/screens/Live.tsx` · Test `src/ui/micDevice.test.ts`, `src/ui/screens/Settings.test.tsx`
- **Depends on:** S-003
- **Change:** setting `micDevice` (global, `''` = system default); `startAudio({ deviceId })` asks for `{ deviceId: { ideal } }`; `useSensors({ micDevice })` restarts the mic when it changes; `listMicrophones()` enumerates `audioinput`s, asking permission first when labels are hidden; Settings "Microphone" select; the mic panel gets the same select.
- **Verify:** `pnpm vitest run src/ui/micDevice src/ui/screens/Settings` → pass

### S-006 — "Switch to manual" from the mic panel

- **Files:** Modify `src/ui/components/SensitivityPanel.tsx`, `src/ui/screens/Live.tsx` · Test `src/ui/components/SensitivityPanel.test.tsx`
- **Depends on:** S-003
- **Change:** panel says Auto is experimental and offers "Switch to manual" (`onManual`).
- **Verify:** `pnpm vitest run src/ui/components/SensitivityPanel` → pass

### S-007 — Correct or delete a rally afterwards

- **Files:** Modify `src/engine/types.ts`, `src/engine/stats.ts`, `src/record/chapters.ts`, `src/ui/hooks/useLiveSession.ts`, `src/ui/screens/SessionDetail.tsx`, `src/ui/screens/History.tsx` · Test `src/engine/stats.test.ts`, Create `src/ui/screens/SessionDetail.test.tsx`
- **Depends on:** S-001
- **Change:** `Rally.count?: number` (the player's correction); `rallyCount(rally, soundsPerHit)` = `count ?? countHits(hits)`, used everywhere a rally is counted. SessionDetail: per row an edit button → number field, Save, Delete rally; saves the session.
- **Verify:** `pnpm vitest run src/engine/stats src/ui/screens/SessionDetail` → pass

### S-008 — Earbud clicker as a first-class way to play; docs

- **Files:** Modify `src/ui/screens/Settings.tsx`, `README.md`, `DESIGN.md`
- **Depends on:** S-002, S-005
- **Change:** toggle "Earbuds or a remote as a clicker", hint without "Experimental" but honest about browsers; README/DESIGN describe the modes, player-ended rallies, mic picker and corrections.
- **Verify:** `pnpm verify` → pass

## Verification (end to end)

`pnpm verify` and `pnpm e2e` pass; CI green; deployed to github.io.
