# 🎸 Guitar Fretboard

An interactive guitar fretboard that shows the **accurate note names** for any root + scale,
mode, or basic chord — right across the neck. It defaults to the **G major scale**
(G A B C D E F♯), reproducing a printed "G Major Scale — Fretboard" diagram as a live web page.

There are **three interactive views**:
- **Scales** (`index.html`) — any root + scale/mode/chord across the neck.
- **Chords** (`chords.html`) — pick a root and see the major, minor, dominant, diminished,
  suspended, added, and augmented chords as full-neck maps, every tone **colored by interval**.
- **Progressions** (`progressions.html`) — choose a key and seven-note scale to see its diatonic
  triads or seventh chords, Roman numerals, and common progression sequences.

**▶ Azure production:** https://orange-grass-0f2e6e11e.7.azurestaticapps.net/ &nbsp;·&nbsp;
**Chords:** https://orange-grass-0f2e6e11e.7.azurestaticapps.net/chords.html &nbsp;·&nbsp;
**Progressions:** https://orange-grass-0f2e6e11e.7.azurestaticapps.net/progressions.html

**GitHub Pages rollback:** https://naytron.github.io/guitar-fretboard/

## What it does
- Pick a **root** and a **scale/mode/chord**; the fretboard highlights the notes.
- **Root** notes and **scale tones** are colour-coded; toggle "show every note" to see the whole
  neck with out-of-scale notes dimmed.
- Choose **1–24 frets**, and **sharp/flat spelling** (Auto picks the right one for the key, e.g.
  G major → F♯, F major → B♭).
- A built-in **self-test** verifies the note math on every load.

## How the notes are computed (accuracy)
Everything is calculated — nothing is copied from any chart or sheet music:

- Standard tuning, low→high: **E A D G B E**, encoded as chromatic pitch classes (C = 0 … B = 11).
- Note at any position: `note = (openString + fret) mod 12`.
- Scales/chords are semitone formulas from the root (e.g. major = `0 2 4 5 7 9 11`).
- Names are spelled with sharps or flats to match the selected key.

The self-test asserts the essentials: open strings read **E A D G B E**, the 12th fret equals the
open string (octave), **G major = G A B C D E F♯**, the low‑E string reads **E F F♯ G G♯ A** at
frets 0–5, and **F major = F G A B♭ C D E**.

## Run it locally
The application is plain HTML/CSS/JS with **no runtime dependencies**. Open `index.html` directly,
or run the same accuracy tests, browser checks, and versioned packaging used by continuous integration:

```powershell
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite checks all three views' control interactions, chord interval spelling,
progression calculations, keyboard navigation, and mobile-width layout. The fretboard itself remains horizontally scrollable on
narrow screens so every fret stays legible.

```powershell
python -m http.server 8000 --directory dist
```

Then visit http://localhost:8000. The footer and `version.json` identify the exact packaged
version.

## Continuous integration and Azure deployment

- `.github/workflows/ci.yml` tests every pull request and `main` push, creates a deployment label
  such as `v1.0.0+309bc9b`, and uploads the verified `dist/` artifact.
- `.github/workflows/deploy.yml` is a reusable production workflow. A successful `main` CI run
  passes it the exact tested artifact, labels the deployment with the same version, deploys to
  Azure Static Web Apps, and smoke-tests all three views plus `version.json`.
- `azure.yaml` and `infra/` define the reproducible Azure Developer CLI and Bicep deployment.
- `.azure/deployment-plan.md` records the Azure context, validation evidence, and rollback plan.

The Azure deployment token is stored only as the
`AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub secret. GitHub Pages remains available as the rollback
host while the Azure endpoint is validated.

Production runs on Azure Static Web Apps Free in `rg-fretboard-lab-prod` (West US 2), with an
expected hosting cost of $0/month for this personal-site workload.

## The chords diagram
Open **Chords** (or `chords.html`) and pick a root — it draws each chord quality on its own
full-neck map, with every tone **colored by interval** so you see a chord's shape, not just one box:

- **Triads:** major, minor, diminished, augmented
- **Sevenths:** dominant 7, diminished 7
- **Suspended & added:** sus2, sus4, add9

Each tone is labelled with its true interval (an add9's ninth reads `9`, a diminished 7th reads
`♭♭7`), and chord tones are spelled from their interval degrees (for example, C7 uses B♭ and C dim7
uses B♭♭). A chord **self-test** checks spellings on load.

## Chord progressions
Open **Progressions** (`progressions.html`), select a key and a seven-note scale or mode, then
choose triads or seventh chords and a common progression pattern. The view lays out all seven
diatonic chords with their Roman numerals and correctly spelled chord tones, then maps the selected
sequence in order. Progression tones are computed from the same scale and interval engine.

## Files
| File | Purpose |
| --- | --- |
| `index.html` | Scales page + controls |
| `chords.html` | Chords page (interval-colored, full-neck) |
| `progressions.html` | Diatonic chords and progression view |
| `styles.css` | Fretboard + UI styling (all views) |
| `theme.js` | Applies the light/dark theme before rendering |
| `fretboard.engine.js` | Pure note engine (tuning, chromatic math, key-aware spelling, scale **and chord** formulas) + self-tests |
| `fretboard.js` | Renders the scales neck |
| `chords.js` | Renders the chords gallery |
| `progressions.js` | Generates diatonic chords and progression maps |
| `staticwebapp.config.json` | Azure Static Web Apps security headers |
| `scripts/` | Accuracy tests, deterministic packaging, and deployment-boundary verification |
| `.github/workflows/` | Continuous integration and version-labeled production deployment |
| `azure.yaml`, `infra/` | Azure Developer CLI and Bicep infrastructure |

## Notes on originality
All code and note data here are **original** and computed from music theory first principles. This
demo intentionally contains **no tablature, lyrics, or copyrighted diagrams**. It's a companion to
my personal (private) guitar practice library.

---
*MIT-style personal project — use it, learn from it, tune up. 🤘*
