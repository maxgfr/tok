# tok

Local-first rally & score counter for volleyball, beach rackets, table tennis and more — count every hit by hand or with earbuds, let sound, motion and camera try it for you (experimental), and film your sessions. No account, no server.

**Live:** https://maxgfr.github.io/tok/ — install it from the browser menu ("Add to Home Screen") and it works offline.

## What it does

- **Manual (the default)**: tap anywhere for each hit, or click with Bluetooth earbuds or a remote (play = +1, next = end rally, previous = undo). You end each rally; a click and a chime confirm every hit and every rally end. Settings can end rallies on their own after 3, 5 or 8 s without a hit.
- **Rally mode** counts touches in a row (beach rackets, table tennis, volleyball passing, keep-ups, jump rope…). It celebrates today's best, your record and your goal.
- **Match mode** keeps the score with each sport's rules:
  - rally-point scoring for volleyball, beach volley, badminton, table tennis, pickleball and roundnet;
  - tennis and padel with games, sets and tie-breaks.

  One tap on a half of the screen gives the point.

- **Auto (experimental)** hears every "tok" through the microphone, with a spectral-flux onset detector in an AudioWorklet. It can also feel impacts through the accelerometer, and on camera it follows the ball with MediaPipe's EfficientDet-Lite0 in a worker. The sensors are fused, so one hit counts once; taps still add what they miss, and you end each rally. Switch between Manual and Auto at any time during a session. Pick the microphone in Settings.
- **Mic settings, during play**: tap the mic chip to see what the detector hears, set the sensitivity, turn the voice filter on or off (your own voice is not a hit), or go back to the default. It is kept per sport. **Restart** puts the rally in progress back at 0.
- **Recording** films the session with the score burned in, as an MP4 with exact timing (WebCodecs, MediaRecorder where it is missing). Recordings are stored on the device (OPFS), chaptered and captioned by rally, with a jump to the best rally. You can share or save them, or cut any rally into its own clip.
- **Corrections**: in a session's detail, fix any rally's count or delete it; records, averages and replay chapters follow.
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
- The reference recordings in `fixtures/` are synthetic. Thresholds were tuned on them, not on real courts, so tune the sensitivity from the mic chip for your place.

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
