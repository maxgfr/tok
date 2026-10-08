# tok

Local-first rally & score counter for volleyball, beach rackets, table tennis and more — counts every hit from sound, motion and camera, records your sessions. No account, no server.

**Live:** https://maxgfr.github.io/tok/

## What it does

- **Rally mode** — counts touches in a row (beach rackets, volleyball passing, keep-ups, jump rope…) and remembers your best.
- **Match mode** — A vs B with each sport's rules: rally-point scoring (volleyball, beach volley, badminton, table tennis, pickleball, roundnet) and tennis/padel scoring with games, sets and tie-breaks.
- **Auto counting** — every hit ("tok") is picked up from the microphone, the accelerometer and/or the camera, fused into one count. Rallies start and end on their own.
- **Recording** — the camera feed is recorded with the score burned in, chaptered by rally, stored on the device.

Everything runs in the browser. Audio and video never leave the device; a Content-Security-Policy with `connect-src 'self'` and a build-time privacy gate make sure of it.

## Develop

```sh
pnpm install
pnpm dev
pnpm verify   # typecheck, lint, format, unit tests, build, privacy gate
```

## License

MIT
