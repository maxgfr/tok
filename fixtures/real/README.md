# Real recordings

Sound from real games, for testing the detector on real hits rather than synthetic ones.

1. In a session in Auto, open the mic panel (tap the mic chip) and tap **Save last 20 s**. You get two files: `tok-<sport>-<date>.wav` (the sound) and `tok-<sport>-<date>.json` (what tok heard in it).
2. Listen to the WAV and count the real hits. Write that number in the JSON's `"hits"` field (it is `null` when saved).
3. Put both files here, with the same name.

`src/engine/fixtures.test.ts` runs the detector over every pair here and expects that many hits. A JSON whose `hits` is still `null` is ignored.
