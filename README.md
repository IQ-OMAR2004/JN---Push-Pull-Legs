# PPL Tracker

A mobile-first workout tracker for **Jeff Nippard's Push / Pull / Legs Hypertrophy Program**, built as a no-build, vanilla-JS web app. All program data lives in a single `program.json` (generated from the PDF); logged sets, 1RMs, swaps, and settings persist in `localStorage`.

## Project layout

```
ppl-tracker/
├── index.html                       # the app shell
├── styles.css                       # red / black / white poster theme
├── app.js                           # all UI + state + persistence
├── program.json                     # the entire program (parsed from PDF)
├── exercise-image-overrides.json    # name → free-exercise-db slug map
├── placeholder.svg                  # branded fallback image
└── scripts/
    └── build-program.js             # regenerates program.json from source tables
```

## Running it

The app is plain static files — no build step.

**Option A — direct file open:** double-click `index.html`. The app will load `program.json` via `fetch()`; on some browsers (notably Safari and certain Chrome configurations) `file://` fetches are blocked. If you see a blank page, use Option B.

**Option B — local server (recommended):** from inside this folder run any of:

```sh
python3 -m http.server 8000          # then open http://localhost:8000
# or
npx serve .                          # if you have node + npx
```

On your phone, point your mobile browser at `http://<your-laptop-ip>:8000`. Add to home screen for a near-native experience.

## What the app does

- **Block → Week → Day** sticky selectors at the top; the heading reads e.g. `Block 1 · Week 3 · Day 3 — Pull #1`. The last position is remembered across reloads.
- One **exercise card per movement** showing an **animated start/end-frame demo** of the lift, the prescribed sets × reps @ intensity, rest, coach notes, and **muscle chips** (primary muscles in red, secondary in grey).
- **Tap the animated thumb** to open the *Form demo* modal: larger flipbook animation + full muscle list + Jeff Nippard's actual YouTube form video (where the PDF lists one), or a "Search YouTube" link-out if it doesn't.
- One **input row per set** (weight + reps), plus a check button that marks the set done and auto-starts the rest timer. Day progress shows `done/total sets`.
- A single **Last-set RPE** field per exercise (matches the PDF's LSRPE column).
- **%1RM auto-target**: for exercises prescribed as a percentage, enter your 1RM once and the app computes & displays the target working weight, rounded to the nearest 2.5 kg/lb. You can still override the actual logged weight.
- **Swap** opens the exercise's approved substitutions (extracted from the PDF's *Exercise Substitutions* section). Picking one replaces the displayed name and image; prescribed sets/reps/intensity stay the same. *Reset to original* and a *View on MuscleWiki* link-out are both available.
- **Per-exercise "Mark done"** toggle (independent of set checks); the card highlights when all sets are logged.
- **Rest timer overlay** that parses the prescribed rest range (e.g. `2-3min`, `30sec`, `0min`) and counts down. Buttons: skip, +30s. Vibrates on completion (mobile).
- **Settings**: *Sets per exercise* (PDF / 2 / 3 / 4 / 5 — default **3**), units (kg/lb), exercise images on/off, and a "wipe" button.

### A note on "3D animation"

True per-exercise 3D character models aren't openly available, so the app uses the closest practical approach with open data: **the thumb cycles the start and end positions of the movement** (frame 0 and frame 1 from [free-exercise-db](https://github.com/yuhonas/free-exercise-db)), producing a flipbook-style animation that shows the motion arc. Combined with the **embedded YouTube form video** from the program PDF, you get an actual demo of how to execute each lift.

### Sets per exercise override

The app defaults to **3 working sets per exercise** regardless of what the PDF prescribes. To switch back to the PDF's exact prescription (2, 4 or 5 sets where it differs), open **Settings → Sets per exercise → PDF**. When an override is active, the card shows both the overridden count and the original PDF count in parentheses (e.g. `3 (PDF: 4)`), and the day's TSV pill shows `3/ex` so you always know you're not on the prescribed numbers.

## Images

Exercise images are pulled from **[yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db)**, an openly-licensed exercise media database:

```
https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<id>/0.jpg
```

Program-exercise → free-exercise-db ID mappings live in `exercise-image-overrides.json`. To add or change a mapping, edit that file and reload — no rebuild needed. When no match exists (or an image 404s), the app shows a branded `PPL` placeholder card and offers a *View on MuscleWiki* link-out (link-only — **never** embedded). MuscleWiki's media is copyrighted and not used in this app.

## Editing the program

`program.json` is the single source of truth at runtime. You can edit it directly, or modify `scripts/build-program.js` (which holds the per-week tables and a fixed exercise template per block-day) and regenerate:

```sh
node scripts/build-program.js
```

The generator validates that each week's row count matches the day's template and exits with an error if they don't, which makes it hard to introduce silent shape bugs.

## Data verified

The numbers were checked against the PDF for several spot weeks; sample:

| Where | Exercise | Sets × Reps @ Load |
|------|---------|---|
| B1 W3 D1 | Back Squat | 4 × 5 @ 77.5% 1RM |
| B1 W3 D1 | Deadlift | 2 × 8 @ 70% 1RM |
| B1 W5 D2 | Low-to-High Cable Flye | 4 × 12-15 @ RPE 9 (TSV bumps to 23) |
| B2 W1 D5 | Mil. Press / Push Press Complex | 3 × 4,4 @ 72.5% 1RM (deload) |
| B2 W8 D2 | Barbell Bench Press | 1 × AMRAP @ 85% 1RM (peaking) |

## Privacy

Everything is local to your browser. Nothing is uploaded. To clear it all: **Settings → Wipe**.

## Credits

- Program: **Jeff Nippard — *Push / Pull / Legs Hypertrophy Program***. App is for personal training use only; the program itself is © STRCNG Incorporated.
- Exercise images: **yuhonas/free-exercise-db** (open license).
