# tok — compteur d'échanges & de score, local-first (PWA)

## Contexte

Maxime veut un outil qu'il utilise vraiment sur le terrain pour compter : (1) les **échanges coop** (touches d'affilée sans faire tomber : raquettes de plage, volley en pass, jongles…) et (2) le **score de match** (A vs B, règles du sport). Le comptage doit pouvoir être **automatique** : à chaque frappe (« tok »), le compteur avance et la session s'enregistre correctement, sans toucher le téléphone. Il doit exploiter tout ce que le navigateur offre — micro, accéléromètre, caméra, enregistrement vidéo — et rester **100 % local, front-only**, déployé sur `https://maxgfr.github.io/tok/` à chaque push.

Décisions prises avec l'utilisateur :
- Comptage : **les deux** modes (échanges coop + match).
- Téléphone : **polyvalent** — posé/trépied (caméra+micro), poche/bras (accéléro+micro), ou tenu par un tiers (saisie manuelle). Un **mode Auto** choisit et fusionne les capteurs disponibles.
- Nom du repo : **`tok`** (libre sur `maxgfr`). UI **en anglais uniquement**.

Interprétation à confirmer : « Auto » = détection auto des capteurs dispo + détection auto de début/fin d'échange (silence/balle au sol) + enregistrement automatique de chaque échange dans l'historique (et dans la vidéo si caméra active).

## Stack (reprise des conventions de `maxgfr/tick`)

Vite 8 + React 19 + TypeScript (strict) + Tailwind 4 + `vite-plugin-pwa` (registerType `prompt`), pnpm 10, vitest + jsdom, oxlint, prettier, `@vite-pwa/assets-generator`. `base: '/tok/'`, routing par hash. CSP injectée au build (copie du plugin `tick:csp` de `tick/vite.config.ts`) avec `connect-src 'self'`, plus `'wasm-unsafe-eval'` dans `script-src` et `media-src 'self' blob:` pour la vision et la relecture vidéo. Copie de `scripts/check-no-network.mjs` de tick (garde-fou : aucune requête sortante dans `dist`). Script `verify` = typecheck + lint + test + build + check:network.

Volontairement exclu : Web Speech **Recognition** (Chrome envoie l'audio à Google → viole le « tout local »). La **synthèse** vocale (`speechSynthesis`, voix locales) est gardée pour annoncer le score.

## Architecture

```
src/
  engine/              # TS pur, sans DOM → 100 % testé en vitest
    types.ts           # HitCandidate{t, source, confidence}, Hit, Rally, Session, SportPreset
    onset.ts           # détection d'onsets audio : flux spectral bande 1–6 kHz, seuil adaptatif médiane+k·MAD, période réfractaire
    motionPeaks.ts     # pics de jerk/|a| sur l'accéléromètre, seuil adaptatif
    ballTrack.ts       # suivi de la balle (centroïdes → vitesse, inversion de trajectoire = frappe, balle basse/perdue = fin)
    fusion.ts          # fusion des candidats multi-sources (fenêtre ±120 ms, poids par sport) → Hit
    rally.ts           # machine à états idle → rally → ended (timeout sans frappe par sport, ou balle au sol)
    scoring/           # règles de match : rallyPoint (volley 25/15, beach 21/15, badminton 21, ping-pong 11, pickleball, roundnet), tennis (15-30-40, jeux, sets, tie-break, padel)
    sports.ts          # presets (voir liste) : poids capteurs, réfractaire, timeout, scoring
  sensors/             # adaptateurs navigateur → engine
    audio.ts + onset.worklet.ts   # getUserMedia audio + AudioWorklet (calcul hors main thread)
    motion.ts          # DeviceMotionEvent (+ requestPermission iOS sur geste)
    camera.ts          # getUserMedia vidéo, sélection caméra, résolution
    vision.worker.ts   # MediaPipe Tasks Vision ObjectDetector (EfficientDet-Lite0, classe « sports ball »), wasm+modèle auto-hébergés sous /models, chargés à la demande (pas dans le precache initial) ; fallback différence d'images
  record/
    compositor.ts      # caméra + overlay score dessinés sur canvas → canvas.captureStream() → MediaRecorder (webm/mp4 selon navigateur) : la vidéo exportée contient le compteur incrusté
    opfs.ts            # écriture en flux des chunks vidéo dans OPFS (pas en RAM)
  store/               # IndexedDB (lib `idb`) : sessions, rallies, hits, records, réglages ; navigator.storage.persist() ; export/import JSON ; jauge d'espace
  device/              # Wake Lock, vibration, fullscreen, orientation, speechSynthesis, sons de feedback, Media Session (télécommande Bluetooth/AirPods → point A/B, expérimental)
  ui/                  # écrans (ci-dessous), design via impeccable
```

Flux de données : capteurs → `HitCandidate` → `fusion` → `Hit` → `rally` (compte, fin d'échange) → en mode match, fin d'échange → invite « point pour A / B » (deux énormes boutons, ou télécommande) → `scoring` → `store` + overlay vidéo + annonce vocale.

## Sports (presets)

Raquettes de plage (matkot/frescobol), Volleyball (pass coop + match indoor), Beach-volley, Jongles foot / footvolley, Tennis de table, Badminton, Tennis & padel (mur ou match), Pickleball, Roundnet (Spikeball), Corde à sauter (accéléro compte les sauts), Personnalisé (l'utilisateur règle capteurs, timeout, règles). Chaque preset déclare la source dominante (ex. ping-pong/matkot → audio ; volley/jongles → vision + audio ; corde → accéléro).

## Écrans

1. **Home** : choix du sport, mode (Rally coop / Match), capteurs (Auto ou manuel), reprise de la dernière config en 1 tap.
2. **Live** : compteur géant lisible à 3 m, échange en cours / meilleur du jour / record, indicateurs capteurs actifs, aperçu caméra plein écran optionnel, tap n'importe où = +1 manuel (correction ±), Wake Lock. **Pocket mode** : écran noir, touches verrouillées (swipe pour déverrouiller), économie de batterie.
3. **Match** : score A/B, sets, service, annulation, prompt de fin d'échange.
4. **Calibrate / Lab** : courbes live audio/accéléro/vision avec frappes détectées, réglage de sensibilité, test « fais 10 frappes » qui ajuste le seuil — indispensable pour rendre l'auto fiable.
5. **History** : sessions, échanges, graphiques SVG maison (record dans le temps, moyenne, tempo frappes/min), records personnels avec célébration.
6. **Replay** : vidéo de la session avec chapitres par échange (saut direct au meilleur échange), partage via Web Share API, export.
7. **Settings** : sauvegarde/restauration JSON, stockage utilisé, suppression, objectifs (« atteindre 100 »), annonces vocales on/off.

## Jalons (chacun livrable et déployé)

- **M0 — Bootstrap** : `~/Downloads/tok`, `git init`, scaffold stack, CI (`ci.yml` : verify sur toutes branches) + `deploy.yml` (Pages via `actions/deploy-pages`, sur push `main`), `.gitignore` incluant `.impeccable/`. `gh repo create maxgfr/tok --public`, description, homepage, topics, Pages en `build_type=workflow`. Ce plan copié en `docs/superpowers/specs/2026-10-08-tok-design.md`. Commits signés, aucune attribution d’outil.
- **M1 — Comptage manuel + match + stockage** : presets sports, `scoring/` (TDD), IndexedDB, Live/Match/History. Design system posé avec **impeccable** (shape → craft) avant l'UI.
- **M2 — Auto audio** : `onset.ts` + worklet + `rally.ts` (TDD sur signaux synthétiques et fichiers WAV de frappes), écran Lab.
- **M3 — Accéléro + fusion + pocket mode** : `motionPeaks.ts`, `fusion.ts`, permission iOS.
- **M4 — Caméra & enregistrement** : compositor avec overlay, OPFS, Replay avec chapitres, partage.
- **M5 — Vision** : worker MediaPipe chargé à la demande, `ballTrack.ts`, intégration à la fusion.
- **M6 — Stats & finitions** : records, objectifs, annonces vocales, Media Session, export/import ; passe **impeccable** (audit + polish), icônes PWA.

## GitHub

- Description : « Local-first rally & score counter for volleyball, beach rackets, table tennis and more — counts every hit from sound, motion and camera, records your sessions. No account, no server. »
- Homepage : `https://maxgfr.github.io/tok/`
- Topics (20) : pwa, typescript, react, vite, local-first, offline-first, no-backend, privacy, github-pages, sports, score-counter, rally-counter, volleyball, beach-volleyball, table-tennis, matkot, web-audio-api, accelerometer, mediapipe, computer-vision

## Vérification

- `pnpm verify` vert à chaque jalon (et skill `/verify` avant chaque commit).
- Tests unitaires engine : onsets sur WAV de référence (compte exact attendu ± tolérance), machine à états d'échange, règles de score (fins de set, avantage, tie-break).
- E2E Playwright sous Chromium avec `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=fixtures/<sport>.wav` : le compteur Live doit afficher le nombre de frappes du fichier.
- Déploiement : `gh run watch` sur le workflow deploy, puis `curl -I https://maxgfr.github.io/tok/` et vérif du manifest + service worker ; installation PWA et test terrain réel sur iPhone/Android (micro, accéléro, caméra, Wake Lock).
- `git log --format='%h %G? %GS'` → `G` sur chaque commit.

## Limites connues (à dire franchement)

- iOS coupe micro/caméra écran verrouillé → l'écran doit rester allumé (Wake Lock + pocket mode).
- Petites balles rapides (matkot, ping-pong) mal vues par la vision à 30 fps → l'audio y fait foi ; la vision sert surtout au volley/jongles.
- Qui gagne le point en match n'est pas détectable automatiquement de façon fiable → 1 tap (ou télécommande) en fin d'échange.
