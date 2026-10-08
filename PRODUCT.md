# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two people: Maxime and his playing partner. They use it while playing **table tennis** and **beach rackets** ("ping-pong de plage", matkot-style) together. The phone is propped on a bag, a table edge or a tripod, sometimes in a pocket, sometimes held by one of them. Their hands hold paddles; they read the screen from 2–3 m, often in bright beach sun, sometimes indoors.

Other sports (volleyball, badminton, tennis, padel, pickleball, roundnet, keepy-uppy, jump rope) are supported presets but are secondary.

## Product Purpose

Count every hit of a rally automatically — from the sound of the ball first, then motion and camera — so the two players never stop to count, and keep match score with each sport's rules. Every session is recorded locally; the history (best rally, today's best, records over time, the replay of the best rally) is the reason to come back.

Success: a count they trust without touching the phone, and a record they want to beat.

## Positioning

Fully local: microphone, accelerometer and camera are processed on the device; nothing is uploaded, no account. A PWA installed from https://maxgfr.github.io/tok/.

## Operating Context

- Outdoor sand and wind (beach rackets), indoor table (table tennis). Ambient noise: wind, waves, other players.
- One quick tap to start; between rallies the app must not need attention. In a match, one tap (or a Bluetooth remote) to give the point.
- Screen must stay on (Wake Lock); iOS cuts mic/camera when locked.

## Capabilities and Constraints

- Rally (coop) mode and Match mode. Auto counting from audio onsets (table tennis: paddle + table bounce = 2 sounds per hit), accelerometer, camera ball tracking; manual tap fallback with ±1 correction.
- Video recording with the score burned in, chaptered by rally, stored in OPFS.
- No network at runtime beyond its own origin; CSP `connect-src 'self'`. Speech recognition excluded (cloud); speech synthesis allowed for announcing the score.
- UI in English only.

## Brand Commitments

- Name: **tok** (the sound of a hit). Lowercase.
- Voice: playful coach — short, warm, a bit cheeky ("New record — 142!", "Again?"). Never verbose.

## Evidence on Hand

No real recordings, users or testimonials. Hit-sound fixtures are synthetic until real recordings are made; do not claim accuracy figures.

## Product Principles

1. The count is sacred: legible from 3 m, never ambiguous, always correctable.
2. Hands-free first: anything needed mid-rally works without touching the phone.
3. Local or nothing: no feature that needs a server.
4. Celebrate progress: records and streaks are the payoff.

## Accessibility & Inclusion

Readable in direct sunlight (very high contrast), large touch targets usable with a sandy thumb, haptic + sound + optional voice feedback so the count can be followed without looking.
