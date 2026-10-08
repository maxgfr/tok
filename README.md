# tok

Local-first rally & score counter for volleyball, beach rackets, table tennis and more — counts every hit from sound, motion and camera, records your sessions. No account, no server.

**Live:** https://maxgfr.github.io/tok/ — install it from the browser menu ("Add to Home Screen") and it works offline.

## What it does

- **Rally mode** counts touches in a row (beach rackets, table tennis, volleyball passing, keep-ups, jump rope…). It celebrates today's best, your record and your goal.
- **Match mode** keeps the score with each sport's rules:
  - rally-point scoring for volleyball, beach volley, badminton, table tennis, pickleball and roundnet;
  - tennis and padel with games, sets and tie-breaks.

  One tap on a half of the screen gives the point.

- **Auto counting** hears every "tok" through the microphone, with a spectral-flux onset detector in an AudioWorklet. It can also feel impacts through the accelerometer, and on camera it follows the ball with MediaPipe's EfficientDet-Lite0 in a worker. The sensors are fused, so one hit counts once, and rallies start and end on their own.
- **Lab** shows what the detector hears, adjusts sensitivity per sport and calibrates itself from ten hits.
- **Recording** films the session with the score burned in. Recordings are stored on the device (OPFS), chaptered and captioned by rally, with a jump to the best rally. You can share or save them.
- **History** shows your record, daily best and average on one fixed scale, and every rally of every session.
- **Coach** (optional) calls the count or the score out loud, using on-device voices only. Earbuds or a Bluetooth remote can act as a clicker (experimental).

## Privacy, enforced

Everything runs in the browser, and audio and video never leave the device. This is backed by three mechanisms, not just stated here:

- a Content-Security-Policy with `connect-src 'self'` is injected at build time;
- `scripts/check-no-network.mjs` fails the build if anything in `dist/` can reach another origin;
- an end-to-end test asserts that no request leaves the origin while camera tracking runs.

MediaPipe Tasks sends usage metrics to Google by default. The build turns that logger into a no-op, and it stops with an error if a library upgrade changes the code being patched. A page's `<meta>` CSP does not reach a dedicated worker, so the worker that runs MediaPipe also locks its own `fetch`, `XMLHttpRequest` and beacons to tok's origin. Its wasm runtime and model are self-hosted under `models/` and only downloaded when the camera is turned on. Speech recognition is deliberately not used, because browsers send the audio to a cloud service.

## Known limits

- iOS stops the microphone and camera when the screen locks. tok keeps the screen on (Wake Lock), and pocket mode blacks it out to save battery.
- Small fast balls (matkot, table tennis) are hard to see at 30 fps, so sound is what counts for those; vision helps most for volleyball and keep-ups.
- Who won a point is not detected: one tap, or the earbud clicker, gives it.
- The reference recordings in `fixtures/` are synthetic. Thresholds were tuned on them, not on real courts, so use the Lab to tune for your place.

## Develop

```sh
pnpm install
pnpm dev
pnpm verify     # typecheck, lint, format, unit tests, build, privacy gate
pnpm e2e        # Chromium with a fake mic/camera fed from fixtures/*.wav
pnpm fixtures   # regenerate the synthetic recordings
```

## License

MIT
