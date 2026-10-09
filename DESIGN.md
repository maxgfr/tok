---
name: tok
description: Hands-free hit counter for two players. A slate board where every hit is a chalk stroke and the giant figure never lies.
colors:
  slate: '#16201c'
  slate-2: '#1d2924'
  slate-3: '#26352f'
  rule: '#34463e'
  chalk: '#eef0e6'
  chalk-dim: '#a3ada6'
  chalk-faint: '#6f7d75'
  best: '#f5d547'
  side-a: '#6fc3e8'
  side-b: '#f28c7a'
  live: '#8fe3a0'
  slate-plate: 'rgba(22, 32, 28, 0.82)'
typography:
  figure-live:
    fontFamily: "'Barlow Condensed', ui-sans-serif, system-ui, sans-serif"
    fontSize: 'clamp(8rem, min(42vh, 58vw), 26rem)'
    fontWeight: 800
    lineHeight: 0.82
    letterSpacing: '-0.02em'
    fontFeature: "'tnum' 1, 'lnum' 1"
  figure-match:
    fontFamily: "'Barlow Condensed', ui-sans-serif, system-ui, sans-serif"
    fontSize: 'clamp(8rem, min(34vh, 64vw), 22rem)'
    fontWeight: 800
    lineHeight: 0.82
    fontFeature: "'tnum' 1, 'lnum' 1"
  verdict:
    fontFamily: "'Barlow Condensed', ui-sans-serif, system-ui, sans-serif"
    fontSize: 'clamp(1.5rem, 4.5vh, 2.5rem)'
    fontWeight: 600
    fontFeature: "'tnum' 1, 'lnum' 1"
  display:
    fontFamily: "'Barlow Condensed', ui-sans-serif, system-ui, sans-serif"
    fontSize: '3rem'
    fontWeight: 800
    lineHeight: 1
    fontFeature: "'tnum' 1, 'lnum' 1"
  headline:
    fontFamily: "'Barlow Condensed', ui-sans-serif, system-ui, sans-serif"
    fontSize: '2.25rem'
    fontWeight: 800
    lineHeight: 1.11
    fontFeature: "'tnum' 1, 'lnum' 1"
  stat:
    fontFamily: "'Barlow Condensed', ui-sans-serif, system-ui, sans-serif"
    fontSize: '2.25rem'
    fontWeight: 800
    lineHeight: 1.11
    fontFeature: "'tnum' 1, 'lnum' 1"
  figure-inline:
    fontFamily: "'Barlow Condensed', ui-sans-serif, system-ui, sans-serif"
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.33
    fontFeature: "'tnum' 1, 'lnum' 1"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '1.25rem'
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
  body-large:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '1.125rem'
    fontWeight: 400
    lineHeight: 1.56
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.43
  label-small:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '0.75rem'
    fontWeight: 600
    lineHeight: 1.33
rounded:
  none: '0px'
  focus: '6px'
  lg: '8px'
  xl: '12px'
  2xl: '16px'
  full: '9999px'
spacing:
  gutter: '16px'
  section-tight: '8px'
  section: '12px'
  stack: '24px'
  page: '32px'
  target-min: '44px'
  target: '48px'
  target-large: '56px'
  target-start: '72px'
components:
  button-start:
    backgroundColor: '{colors.chalk}'
    textColor: '{colors.slate}'
    typography: '{typography.figure-inline}'
    rounded: '{rounded.2xl}'
    height: '72px'
    width: '100%'
  button-primary:
    backgroundColor: '{colors.chalk}'
    textColor: '{colors.slate}'
    typography: '{typography.body}'
    rounded: '{rounded.xl}'
    padding: '0 16px'
    height: '48px'
  button-secondary:
    backgroundColor: '{colors.slate-2}'
    textColor: '{colors.chalk}'
    typography: '{typography.body}'
    rounded: '{rounded.xl}'
    padding: '0 16px'
    height: '48px'
  button-secondary-disabled:
    backgroundColor: '{colors.slate-2}'
    textColor: '{colors.chalk-faint}'
  button-quiet:
    textColor: '{colors.chalk-dim}'
    rounded: '{rounded.lg}'
    padding: '0 12px'
    height: '44px'
  button-quiet-hover:
    textColor: '{colors.chalk}'
  button-destructive:
    backgroundColor: '{colors.side-b}'
    textColor: '{colors.slate}'
    rounded: '{rounded.lg}'
    padding: '0 16px'
    height: '44px'
  button-icon:
    textColor: '{colors.chalk-dim}'
    rounded: '{rounded.lg}'
    size: '44px'
  live-control:
    backgroundColor: '{colors.slate-2}'
    textColor: '{colors.chalk}'
    typography: '{typography.body-large}'
    rounded: '{rounded.xl}'
    height: '56px'
  segmented:
    textColor: '{colors.chalk-dim}'
    typography: '{typography.body}'
    rounded: '{rounded.none}'
    padding: '0 12px'
    height: '48px'
  segmented-active:
    backgroundColor: '{colors.chalk}'
    textColor: '{colors.slate}'
  segmented-disabled:
    textColor: '{colors.chalk-faint}'
  sport-cell:
    textColor: '{colors.chalk}'
    typography: '{typography.figure-inline}'
    rounded: '{rounded.none}'
    padding: '6px 12px'
    height: '52px'
  sport-cell-active:
    backgroundColor: '{colors.chalk}'
    textColor: '{colors.slate}'
  sport-cell-hover:
    backgroundColor: '{colors.slate-2}'
  tab:
    backgroundColor: '{colors.slate-2}'
    textColor: '{colors.chalk-dim}'
    rounded: '{rounded.lg}'
    padding: '0 16px'
    height: '44px'
  tab-active:
    backgroundColor: '{colors.chalk}'
    textColor: '{colors.slate}'
  sensor-chip-starting:
    backgroundColor: '{colors.slate-2}'
    textColor: '{colors.chalk-dim}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '0 10px'
    height: '32px'
  input-field:
    backgroundColor: '{colors.slate-2}'
    textColor: '{colors.chalk}'
    typography: '{typography.body-large}'
    rounded: '{rounded.lg}'
    padding: '0 12px'
    height: '48px'
  toggle-track:
    backgroundColor: '{colors.slate-3}'
    rounded: '{rounded.full}'
    height: '28px'
    width: '48px'
  nav-item:
    backgroundColor: '{colors.slate}'
    textColor: '{colors.chalk-faint}'
    typography: '{typography.label-small}'
    height: '56px'
  nav-item-active:
    textColor: '{colors.chalk}'
  stat-best:
    textColor: '{colors.best}'
    typography: '{typography.stat}'
  stat-plain:
    textColor: '{colors.chalk}'
    typography: '{typography.stat}'
  match-half-a:
    textColor: '{colors.side-a}'
    typography: '{typography.figure-match}'
  match-half-b:
    textColor: '{colors.side-b}'
    typography: '{typography.figure-match}'
  match-seam:
    backgroundColor: '{colors.slate-2}'
    textColor: '{colors.chalk-dim}'
    padding: '8px 16px'
  chart-surface:
    backgroundColor: '{colors.slate-2}'
    rounded: '{rounded.lg}'
    height: '176px'
---

# Design System: tok

## Overview

**Creative North Star: "The Beach-Bar Chalkboard"**

tok is the slate board outside a beach bar, the one that keeps today's specials and the volleyball ladder in tally strokes. The ground is a deep green-black slate. Every figure is chalk white, and the coloured chalk always has a job. The world lives in three things only: the palette, the heavy condensed figures, and the tally strokes. There is no chalk texture, no hand lettering, no wood frame and no smudge effect. Chalk drawn as a costume would cost legibility in direct sun, and legibility from 2–3 m is the reason the product exists.

The board is dense where the record lives (History is a hairline table) and enormous where the play lives (Live gives the count the upper half of the screen). The figures do the shouting. UI prose stays in a plain system sans, sentence case, short. Nothing on the board disappears without a trace: an undone stroke is struck through in coral before it fades, a changed digit rolls in alone, and a new record makes the record stat pulse.

The mark is the system in miniature: one tally gate (four uprights and the cross-stroke that closes a five) in chalk on a slate tile, and the ball in record yellow.

**Key Characteristics:**

- Slate ground, chalk figures, coloured chalk with one job each.
- Barlow Condensed for every figure, page title and celebration line; system sans for everything you read as a sentence.
- The tally gate is the signature: strokes that draw themselves, five to a gate.
- Square hairline grids for choices and tables; soft corners only on standalone buttons.
- Flat. Depth is three slate steps and a hairline rule, not shadows.
- Built for sun: chalk on slate is 14.5:1, and over a camera feed everything steps up to full chalk.

## Colors

A dark slate ground in three steps with one hairline rule, chalk in three strengths, and four coloured chalks that are never decoration.

### Primary

- **Chalk White** (`chalk`): every figure, page titles, body text that matters, the filled state of primary buttons and selected segments, the tally strokes during a rally. 14.5:1 on slate.

### Secondary

- **Record Yellow** (`best`): best and record only. The record and today's-best stats, the best rally in every chart and table, the live count and verdict line when a rally sets a new record, a new best today or reaches the goal, set point and match point on the match board, and "best N" on the burned-in plate. It is also the system's interaction affordance colour: the focus ring, text selection, caret and native accent.

### Tertiary

- **Side A Blue** (`side-a`): player A, everywhere a side is named: the A half of the match board (score, name, an 8% tint, 20% while pressed), A's sets on the seam, the A name and final score in a session, the A name label on Home and the plate.
- **Side B Coral** (`side-b`): player B, mirrored on all the same places. Coral also carries the cancel: the strike-through over an undone tally stroke, the recording dot, a blocked or missing main sensor chip (at 15% fill), a failed calibration or unreadable recording, and the fill of the final destructive confirmation ("Delete for good").
- **Live Green** (`live`): a working sensor and a detected hit. The sensor chip while it is counting (15% fill, green icon and label) and each detected hit drawn as a green stroke in the sensitivity panel's trace. Nothing else is green.

### Neutral

- **Slate** (`slate`): the board. Page ground, bottom nav, the Live screen, the hollow centre of average rings in charts. Also the PWA theme and background colour.
- **Slate Raised** (`slate-2`): the one raised surface. Secondary buttons, inputs and selects, the match seam, unselected tabs, row hover, the level trace canvas, the update bar.
- **Slate Deep Raised** (`slate-3`): the toggle track at rest and the storage meter track.
- **Hairline Rule** (`rule`): every 1px border and gridline: segmented controls, the sport grid, table rows, header and footer rules on Live, chart gridlines, the scrollbar thumb.
- **Chalk Dim** (`chalk-dim`): secondary text: section labels, hints, units, table headers, average lines and rings. 7.2:1 on slate.
- **Chalk Faint** (`chalk-faint`): the quietest layer: disabled labels, inactive nav items, non-best rally bars, the tally between rallies, the chart crosshair, the "sets" seam label. 3.9:1, so never for text a player must read mid-rally.
- **Slate Plate** (`slate-plate`): the 82% slate behind the score burned into recordings.

### Named Rules

**The Chalk Has a Job Rule.** Each coloured chalk means one thing. Yellow is best and record, blue is side A, coral is side B (and the cancel), green is a working sensor and a detected hit. If a colour cannot say which of those it means, it is chalk or chalk-dim.

**The No Colour Alone Rule.** Every colour pairing is backed by a second channel: the chart average is dashed with hollow rings against the solid best line, sensor chips carry a distinct icon (Mic / MicOff, Eye / EyeOff), sides carry their names.

## Typography

**Display Font:** Barlow Condensed 600 and 800 (self-hosted via @fontsource, latin subset), falling back to ui-sans-serif, system-ui, sans-serif
**Body Font:** the system sans stack (ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial)

**Character:** A scoreboard figure and a quiet voice. Barlow Condensed is tall, heavy and narrow, so a two-digit count fills the screen and stays readable across a court. The system sans keeps prose neutral and native, so the board never looks like a theme.

Every Barlow Condensed use goes through the `figures` utility, which sets tabular lining numerals (`tnum`, `lnum`). Digits sit in fixed cells and the count never jitters as it grows.

### Hierarchy

- **Live figure** (800, `figure-live`, line-height 0.82, -0.02em): the rally count on Live. Fills the upper half; chalk, or record yellow while celebrating.
- **Match figure** (800, `figure-match`, line-height 0.82): each side's score, in that side's colour.
- **Verdict** (600, `verdict`): the line under the count: the unit mid-rally, "New record — 31!", "3 off today's best. Again?". The celebration lines are figures, not prose.
- **Display** (800, 3rem): page titles (tok, History, Settings) and empty-state headlines ("Nothing on the board yet").
- **Headline** (800, 2.25rem): detail titles (sport name on a session, Replay, "This session is gone").
- **Stat** (800, 2.25rem): Today / Record / Goal / Rallies on Live; record figures in summary lines run 1.875rem.
- **Figure inline** (600, 1.5rem): sport names in the sport grid, set and point labels, figures embedded in sentences and tables (1.25rem in table cells, 800 for best columns). The Start button uses figures at 1.875rem 800, uppercase.
- **Title** (system sans 600, 1.25rem): section headings in Settings and the sensitivity panel ("Coach", "Sensitivity").
- **Body** (system sans 400, 1rem / 1.125rem for the summary and empty-state lines): explanations, hints, toggle labels (600).
- **Label** (system sans 600, 0.875rem, chalk-dim, sentence case): section labels over controls ("Mode", "Count with", "Sport", "Sessions") and sensor chip text. Stat labels and table headers use 0.75rem.

### Named Rules

**The Figures Rule.** Anything that is a number, a page title or a celebration is Barlow Condensed through `figures`, with tabular lining numerals. Anything you read as a sentence is the system sans. A stat label sitting on a figure explicitly switches back to sans.

**The Sentence Case Rule.** Labels are sentence case, never letter-spaced capitals. The only uppercase string in the app is the Start button.

## Layout

One column, centred, with a 16px minimum gutter that grows with the safe-area insets (`safe-x`, `safe-top`, `safe-bottom`). Column widths by screen: 36rem for Home, Settings and empty states; 42rem for the sensitivity panel and the Live footer; 48rem for History, Session and Replay and the Live tally. Vertical rhythm: 32px between sections on Home and Settings, 24px on History and Session, 20px on Replay; 12px inside a section, 8px between a label and a table or chart.

Touch targets: 44px minimum for quiet and icon buttons, 48px for buttons, inputs, segments and table rows, 52px for sport cells, 56px for Live controls and nav items, 72px for Start.

Every screen except Live sits above a three-item bottom nav (Play, History, Settings). Live takes the whole viewport (fixed, no nav).

### Per-mode layouts

- **Home (setup):** title row (tok, "Every hit counts."), then Mode, Count with (Manual first, Auto · experimental, one hint line under it), Players (match only: two name fields in A blue and B coral, then a first-server segmented control), Sport (two-column square grid, table tennis and beach rackets first). A sticky footer restates the choice in one line over the full-width Start button.
- **Live, rally:** a 56px header (close, sport · mode, sensor chips — the mic chip opens the sensitivity panel — the Manual/Auto switch as a hand or a waveform, camera, lock) over a hairline. The whole middle is one tap target (+1) holding the count, the verdict line and the tally gates (10 gates a row, 4 rows, then the block is carried as "+N"). The footer, over a hairline, holds the three-stat strip (Today, Record, then Goal or Rallies) and three 56px controls in the thumb zone: Undo hit, Restart and End rally.
- **Live, match:** two halves, each a whole-half tap target giving the point (A blue on top, B coral below; side by side in landscape). A slate-2 seam between them is the scorer's column: server dot (chalk), sets (and games for tennis), finished sets, status line and Undo point. In landscape the seam turns vertical.
- **Pocket mode:** pure black, touches swallowed, a faint "Swipe up to unlock" at the bottom.
- **History:** title, sport tabs (only when more than one sport has sessions), a summary sentence with the record in yellow, the day chart, then the sessions table (When, Mode, Rallies, Best).
- **Session:** back + headline, final score in side colours for matches, the summary sentence, Watch the replay, rally bars, the rallies table (a pencil per row opens an inline correction: count field, Save, Cancel, Delete rally), delete at the foot.
- **Replay:** back + headline, part tabs, the video, Best rally / Share / Save, then the rally chapter list.
- **Sensitivity panel:** a sheet from the bottom of Live, opened from the mic chip: "Sensitivity · sport", the level trace, the sensitivity slider, the "Ignore voices" toggle with its count, then Default and Done.
- **Settings:** Counting (Sounds, End a rally on its own, Microphone), Coach (toggles and goal), Backup, Storage, Start over, a one-line footer.

### Named Rules

**The Upper Half Rule.** On Live, the count owns the middle of the screen and the thumb zone owns the controls. Nothing a player needs mid-rally sits in the top bar except status.

## Elevation & Depth

Flat. Depth is tonal: slate, then slate-2 for anything raised or interactive, then slate-3 for tracks, with a 1px hairline rule doing the separating. There is one shadow in the whole build, under the Start button, and it reads as weight on the primary action rather than as a layer.

Over a camera feed the system adds a scrim, not a shadow (see the Camera Legibility Rule under Components).

### Shadow Vocabulary

- **Start weight** (`box-shadow: 0 8px 24px -12px rgb(0 0 0 / 0.6)`): the Start button only.

### Named Rules

**The Flat Board Rule.** A board has no depth. Separate with a hairline or a slate step; the Start button's shadow is the single exception and is not a pattern.

## Shapes

Two families, used on purpose. **Grids are square:** segmented controls, the sport grid, tables and the chapter list are 0-radius cells divided by 1px hairlines, like ruled columns on the board. **Standalone buttons are softly rounded:** 8px for quiet, icon, tab and confirm buttons and for inputs and the trace canvas; 12px for primary, secondary and Live controls; 16px for Start. Pills (full radius) are reserved for sensor chips, the toggle and the storage meter. The focus ring is a 3px yellow outline, 3px offset, with a 6px corner.

The tally stroke is the one hand-made form: a 4.2-unit round-capped line with a small deterministic wobble (the same count always draws the same board). Strokes are 9 units apart, gates 46 units wide, rows 54 units tall; the fifth stroke crosses the four on a rising diagonal.

The burned-in plate is a slate rectangle with a corner of 2% of the frame's short side.

## Components

### Buttons

Solid chalk or quiet slate; no outlines, no gradients.

- **Shape:** softly rounded (12px), quiet and confirm buttons 8px, Start 16px.
- **Primary:** chalk fill, slate text, 600 sans, 48px tall (Export, Watch the replay, Start listening, Best rally, Reload).
- **Start:** full width, 72px, chalk fill, figures 800 uppercase with a filled play icon; presses to 98% scale.
- **Secondary:** slate-2 fill, chalk text (Import, Share, Save, Undo hit, End rally). Disabled drops the text to chalk-faint.
- **Quiet / icon:** no fill, chalk-dim, chalk on hover (Keep playing, Undo point, close, back).
- **Destructive:** two steps. First a quiet button that turns coral on hover ("Delete session", "Delete everything…"); then an inline confirm pair: a quiet "Keep it" and a coral-filled, slate-text "Delete for good".

### Segmented controls

- **Style:** native radios drawn as one square bar: a 1px hairline frame, hairline dividers, 0 radius, 48px cells, 600 sans.
- **State:** selected cell is solid chalk with slate text; others chalk-dim, chalk on hover; disabled chalk-faint with a not-allowed cursor. Focus puts the yellow outline on the cell. 150ms colour transition.
- **The sport grid** is the same idea in two columns: square hairline cells, sport names in figures, the selected sport filled chalk.

### Tabs

History's sport filter and Replay's parts are rounded (8px) slate-2 buttons that fill chalk when selected.

### Sensor chips

- **Style:** 32px pills, 16px icon plus a 600 label; below 460px wide the label is screen-reader only and the colour and icon carry the state.
- **State:** counting = live green on a 15% green fill; starting = chalk-dim on slate-2; blocked or missing = coral on a 15% coral fill. Only the sport's main sensor gets a failure chip.

### Inputs / Fields

- **Style:** slate-2 fill, 1px hairline border, 8px corners, 48px tall, chalk text, chalk-faint placeholder. The goal number field uses figures, right-aligned.
- **Focus:** the border lifts to chalk-dim, plus the global yellow focus ring.

### Toggle

A native checkbox drawn as a 48×28px pill switch; the whole row (label and hint) is the hit area. Track slate-3 at rest; the knob is chalk and slides 20px over 150ms.

### Navigation

Bottom nav: three equal columns, 56px tall, 22px icons over a 0.75rem 600 label, on slate behind a top hairline. Active item chalk, others chalk-faint (chalk-dim on hover). History stays active through Session and Replay.

### The Tally Gate (signature)

The rally drawn as chalk tally marks under the count. Four uprights and a cross-stroke per gate of five, ten gates a row, four rows; past 200 the filled block is carried as a yellow "+N" figure beside the board. Strokes are chalk during a rally and step down to chalk-faint between rallies.

Motion grammar, the same everywhere:

- **The stroke draws itself:** each new stroke animates its dash offset from 1 to 0 in 220ms on the expo-out curve.
- **Only the changed digit rolls:** count digits are keyed by position and value, so only the cell that changed rises 0.1em and fades in, 180ms expo-out.
- **Undo is struck through in coral before fading:** the removed stroke stays at half strength with a coral slash across it (3.4 units), holds for 60% of 900ms, then fades out. Nothing silently vanishes.
- **The record stat pulses:** on a new record the Record stat scales to 1.28 and back, 700ms expo-out, twice.
- State colour changes take 150ms. Under `prefers-reduced-motion` every animation and transition collapses to 1ms.

### Live stat strip

Three centred columns: a 0.75rem sans label over a 2.25rem figure. Today and Record are always yellow; Goal turns yellow once today's best reaches it; Rallies is chalk.

### Match board

Each half is a button: the name (1.25rem sans) over the score (`figure-match`) in the side colour, on an 8% side tint that deepens to 20% while pressed. "Set point" and "Match point" appear under the score in yellow figures.

### Charts

- **Day chart (History):** best and average rally per day on one fixed scale, 0 to the all-time best, with three hairline gridlines (0, half, top). Best is a solid 2px yellow line with filled yellow dots ringed in slate; the average is a 2px chalk-dim line dashed 6/5 with hollow rings (slate fill, chalk-dim stroke). Hover or touch draws a chalk-faint crosshair and states the day in figures in the caption. Axis labels are figures in CSS pixels so they never shrink with the drawing.
- **Rally bars (Session):** one bar per rally, oldest first, on a fixed y-scale; the longest is yellow, the rest chalk-faint; a few rallies stay narrow bars on the left instead of stretching.
- **Level trace (sensitivity panel):** a canvas on slate-2: the sound in chalk (1.5px), the bar a hit has to clear in yellow (2px), every detected hit as a 3px green stroke.

### Camera legibility

When the camera films a session the preview fills the screen under a 70% slate scrim; the header and footer turn into near-solid slate bars (90%); secondary labels (stat labels, the verdict line) step up from chalk-dim to full chalk.

### Burned-in score plate

The recording carries the board's own language: a slate plate at 82% in the lower-left corner, sized from the frame's short side. Rally: the count in figures 800 (chalk, yellow when it equals or beats the best), sport and unit in chalk-dim figures 600, "best N" in yellow. Match: one row per side in its colour, name, sets in chalk-dim, points in figures 800.

### Named Rules

**The Cancel, Don't Vanish Rule.** Any removal on the board is shown before it is gone: struck through in coral, held, then faded.

**The Camera Legibility Rule.** Over a camera feed: a 70% slate scrim, solid slate bars top and bottom, and every label at full chalk. Figures never sit on raw video.

**The Fixed Scale Rule.** Charts keep one scale across days and sessions (0 to the all-time best, or a passed-in top) so a good day looks good next to every other day.

## Do's and Don'ts

### Do:

- **Do** set every number, page title and celebration line in Barlow Condensed through `figures` (tabular lining numerals); everything else in the system sans.
- **Do** give each coloured chalk its one job: yellow for best and record, blue for side A, coral for side B and the cancel, green for a working sensor and a detected hit.
- **Do** draw choices as square hairline grids (0 radius, 1px `rule` dividers, selected cell filled chalk).
- **Do** keep charts on a fixed scale, with the average dashed and hollow-ringed against a solid yellow best.
- **Do** strike an undone stroke through in coral before it fades; roll only the digit that changed.
- **Do** put a 70% slate scrim and solid slate bars under anything drawn over the camera, and lift labels to full chalk.
- **Do** keep targets at 44px or more, and 56px for the Live controls in the thumb zone.
- **Do** honour `prefers-reduced-motion` (all motion collapses to 1ms).

### Don't:

- **Don't** add chalk texture, smudges, hand-lettered type or a wood frame; the world lives in palette, figures and strokes.
- **Don't** use yellow, blue, coral or green as decoration or for anything outside their job.
- **Don't** build the black-screen-with-neon counter or the white minimal tracker.
- **Don't** let a colour carry meaning alone; pair it with a dash, an icon or a name.
- **Don't** let a count jitter: no proportional digits, no animating the whole number.
- **Don't** make anything silently disappear.
- **Don't** add shadows to separate surfaces; use a slate step or a hairline.
- **Don't** set labels in letter-spaced capitals.
- **Don't** put chalk-faint (3.9:1) on text a player must read mid-rally.
- **Don't** rescale a chart to the data on screen.
