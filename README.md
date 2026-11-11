# 🎸 Guitar Fretboard

An interactive guitar fretboard that shows the **accurate note names** for any root + scale,
mode, or basic chord — right across the neck. It defaults to the **G major scale**
(G A B C D E F♯), reproducing a printed "G Major Scale — Fretboard" diagram as a live web page.

There are **five interactive views**:
- **Scales** (`index.html`) — any root + scale/mode/chord across the neck.
- **Chords** (`chords.html`) — pick a root and see the major, minor, dominant, diminished,
  suspended, added, and augmented chords as full-neck maps, every tone **colored by interval**.
- **Progressions** (`progressions.html`) — choose a key and seven-note scale to see its diatonic
  triads or seventh chords, Roman numerals, and common progression sequences.
- **Modes** (`modes.html`) — choose a tonic and any of the seven diatonic modes. See its fretboard,
  complete W/H pattern, and note-to-note whole/half steps including the return to the octave.
- **Quiz** (`quiz.html`) — ten-question, untimed lessons for fretboard notes, intervals,
  chord tones, and Roman numerals, with explanations and separate missed-question review.

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

The browser suite checks all five views' control interactions, chord interval spelling,
progression calculations, keyboard navigation, and mobile-width layout. The fretboard itself remains horizontally scrollable on
narrow screens so every fret stays legible.

The visual system uses a compact Les Paul hero, larger fret/string labels, and a GitHub
Dark-inspired palette when the device requests dark mode. Chord and progression dots default
to **Both** (note above interval), so interval roles do not depend on color alone. The Dot labels
selector still offers note-only and interval-only views.

On **Modes**, the W/H summary stays visible above the neck. Expand **Explore the 7 note-to-note
steps** below the fretboard for numbered, directional transitions. This keeps the neck closer
to the controls, especially on phones.

On small screens, secondary diagram settings are collapsed by default; expand **Neck and
display settings** to change fret range, spelling, or dot labels. The active progression map appears
before its collapsible seven-chord reference. Collapsing settings does not reset their values.

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
  Azure Static Web Apps, and smoke-tests all five views plus `version.json`.
- `azure.yaml` and `infra/` define the reproducible Azure Developer CLI and Bicep deployment.
  Set `CUSTOM_DOMAIN` (azd environment variable and GitHub repository variable) to bind the apex
  and `www` hostnames and smoke-test them; the full DNS runbook is in
  `.azure/deployment-plan.md` under "Custom domain".
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
Each chord in the selected progression includes an interval-colored fretboard showing its tones
on all six strings in standard tuning. Choose 12–24 frets and note, interval, or combined dot labels.
These are full-neck tone maps rather than prescribed chord fingerings; on narrow screens the necks
scroll horizontally and can be focused with the keyboard.

## Quiz practice

Open `quiz.html` and choose **Fretboard notes**, **Intervals**, **Chord tones**, **Roman
numerals**, or **Modes**. Sessions are ten questions with no timer. Answer using the labeled buttons, or
select a position in the **Find a note** exercise. On the interactive neck, arrow keys move,
Home/End jump to the beginning/end, and Enter/Space submits. Feedback is announced and focus
moves to Next; the learner controls when to continue.

- **Notes:** start with natural notes on frets 0–5, on one or all strings. Expand to frets
  0–12 and chromatic targets. Sharp/flat equivalents share one choice; finding either octave
  position in the selected range is accepted. Standard six-string tuning only.
- **Intervals:** identify ascending simple intervals from an open-string root through the
  octave (0–12 semitones). Six semitones is called the tritone. These are visual questions,
  not ear training.
- **Chords:** start with major/minor triads. The harder setting adds diminished, augmented,
  and dominant-seventh chords. Note names follow the selected key/spelling context.
- **Roman numerals:** match degrees and chords in major or natural-minor keys using triads.
  Modal harmony and seventh-chord numeral questions are not included.
- **Modes:** name the mode from its W/H step pattern, from its degree of a parent major key,
  find the parent major of a given mode, or pick the characteristic tone that separates a mode
  from its parallel major or minor.

Scores count only unassisted first answers. A hint or reveal makes that question assisted.
The results explain missed skills and offer a separate retry round without changing the original
lesson score. A small question pool repeats only after exhaustion; the page explains when this
happens. **Practice missed skills** starts a new lesson using the most recent saved lesson with
misses. Ending a lesson early records no score.

Quiz settings and up to 40 completed lesson summaries are stored under the versioned
`fretboard-lab.quiz.v1` localStorage key. Review rounds are not added as new lesson scores.
No account, server storage, analytics, or cross-device sync is used. Localhost, Azure, and the
rollback site have separate storage. Private browsing, clearing site data, or switching browsers
can erase/isolate progress. Storage failures or invalid saved data produce a visible notice;
lessons can continue in memory. **Reset quiz progress** requires confirmation and removes only
Quiz-owned data. In-progress lessons are not restored on reload. Scores are not a mastery rating.

The shared theory engine preserves seven-note scale-degree spellings, including E♯ and B♯ in
C♯ major and contextual diatonic chord roots. Sounding pitch classes remain unchanged.

## Lessons and the mode order strip

Every theory page (Scales, Chords, Progressions, Modes) ends with a **Learn** panel: three
tabs — Beginner, Intermediate, Advanced — each built around a named mental model (the ladder,
house numbers, Nashville numbers, the brightness dial, …). Lesson text is generated live from
the engine for the key, scale, mode, or progression currently selected, so note examples are
never hand-typed. Each lesson ends with a **Practice in Quiz** link that preselects the matching
quiz activity and settings via URL query parameters (`quiz.html?activity=chords&key=2&advanced=true`);
Quiz validates presets and ignores invalid ones. The chosen level is remembered per page under the
`fretboard-lab.lessons.v1` localStorage key.

Each Learn panel ends with a **learning path** footer: the latest first-attempt score from the
matching quiz activity (read from the Quiz's saved history), a **Mark as learned** toggle per
level (a ✓ appears on the tab), and a "*N* of 3 levels learned" progress line. Learned levels are
stored alongside the level preference under `fretboard-lab.lessons.v1`.

The Modes page also shows **the seven modes in order** (Ionian → Locrian): each chip lists its
degree, the tonic it starts on inside the current parent major key, its W/H step pattern, and its
characteristic tone(s). Clicking a chip selects that mode and tonic; the sentence above it states
"*X Mode* is degree *N* of *Y* major — same seven notes, new home."

## Practice tools

- **Shareable URLs.** Every control on the theory pages is mirrored into the query string
  (`modes.html?key=2&mode=dorian&compare=true&pos=1`). Defaults are omitted, invalid values are
  ignored and cleaned from the address bar, and **Copy link** puts the current URL on the
  clipboard (with a text-selection fallback).
- **Playback.** Scales, modes, each chord card, each diatonic chord, and the selected progression
  have a **Play** button backed by the Web Audio API — a short plucked tone per note, generated
  from the engine's pitch classes. No audio files are shipped; nothing plays until you press Play.
- **Compare with parallel major** (Modes). Marks degrees lowered or raised relative to the major
  scale on the same tonic (amber), ghosts the notes that exist only in the parallel major (dashed),
  and summarises the difference ("♭3 = F ♭7 = C — 2 degrees lowered").
- **Dot labels** (Scales, Modes). Like Chords and Progressions, the **Dot labels** card in
  **Neck and display settings** offers
  **Note names**, **Intervals**, or **Both** (the default, with the note above its interval).
  Intervals are relative to the parallel major: E Lydian reads `1 2 3 ♯4 5 6 7`, the root
  still reads `1` in the root colour, lowered degrees get a purple ring and raised degrees a pink
  ring (hover a dot for its note name). Seven-note scales use proper degree spelling (`♯4`, `♭5`);
  pentatonic, blues, and chord formulas label each semitone conventionally. Chord necks in
  interval mode mark `♭`/`♯` intervals with the same rings. Switching labels keeps the readout,
  legend, and fretboard in place. Outside-scale dots use conventional semitone intervals.
  URL parameter: `labels=notes|intervals|both`; older `labels=degrees` links still open Intervals.
- **Position filter** (Scales, Modes). Choose Whole neck or Positions 1–5: a five-fret window
  anchored on the low-E root in CAGED order dims every other note so you can learn one shape
  at a time.
- **Print.** A print stylesheet strips navigation, controls, and buttons, fits the fretboard to
  the page, and keeps the current lesson and the mode strip, so any view prints as a handout.

## Files
| File | Purpose |
| --- | --- |
| `index.html` | Scales page + controls |
| `chords.html` | Chords page (interval-colored, full-neck) |
| `progressions.html` | Diatonic chords and progression view |
| `modes.html` | Modal fretboard, whole-step/half-step patterns, and mode order strip |
| `quiz.html`, `quiz.css` | Accessible Quiz page and practice-specific styling |
| `quiz.engine.js` | Pure question pools, grading, scoring, and review rounds |
| `quiz.js` | Quiz UI, keyboard interaction, URL presets, and browser-only progress |
| `lessons.js` | Lesson content (12 lessons), live context builder, and quiz-preset links |
| `lessons.ui.js`, `lessons.css` | Accessible three-level lesson tab panel and mode strip styling |
| `practice-layout.js` | Responsive native disclosures for diagram controls |
| `page-state.js` | Mirrors validated control state to the URL and powers Copy link |
| `playback.js` | Web Audio plucked-tone playback for scales, chords, and progressions |
| `les-paul.svg` | Locally served CC0 Les Paul illustration used in every hero |
| `styles.css` | Fretboard + UI styling (all views) |
| `theme.js` | Applies the light/dark theme before rendering |
| `fretboard.engine.js` | Pure note engine (tuning, chromatic math, key-aware spelling, scale **and chord** formulas) + self-tests |
| `fretboard.js` | Renders the scales neck |
| `chords.js` | Renders the chords gallery |
| `chord-fretboard.js` | Shared interval-colored neck renderer for chords and progressions |
| `progressions.js` | Generates diatonic chords and progression maps |
| `staticwebapp.config.json` | Azure Static Web Apps security headers |
| `scripts/` | Accuracy tests, deterministic packaging, and deployment-boundary verification |
| `.github/workflows/` | Continuous integration and version-labeled production deployment |
| `azure.yaml`, `infra/` | Azure Developer CLI and Bicep infrastructure |

## Notes on originality
The application code and note data here are **original** and computed from music theory first principles. This
demo intentionally contains **no tablature, lyrics, or copyrighted diagrams**. It's a companion to
my personal (private) guitar practice library.

The hero illustration is **Gibson Les Paul** by **piemaster**, originally from Open Clip Art and
available on [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Gibson_Les_Paul.svg).
It is released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/),
and adapted here with a sunburst body finish on a transparent background.
The illustration is served locally, without third-party image requests. Guitar names identify
the instrument depicted; this project is not affiliated with or endorsed by Gibson.

---
*MIT-style personal project — use it, learn from it, tune up. 🤘*
