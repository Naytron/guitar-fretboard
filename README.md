# 🎸 Guitar Fretboard

An interactive guitar fretboard that shows the **accurate note names** for any root + scale,
mode, or basic chord — right across the neck. It defaults to the **G major scale**
(G A B C D E F♯), reproducing a printed "G Major Scale — Fretboard" diagram as a live web page.

**▶ Live demo:** https://naytron.github.io/guitar-fretboard/

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
It's plain HTML/CSS/JS with **no build step and no dependencies** — just open `index.html`, or:

```bash
python -m http.server 8000   # then visit http://localhost:8000
```

## Files
| File | Purpose |
| --- | --- |
| `index.html` | Page + controls |
| `styles.css` | Fretboard + UI styling |
| `fretboard.engine.js` | Pure note engine (tuning, chromatic math, key-aware spelling, scale/chord formulas) + self-test |
| `fretboard.js` | Reads the controls and renders the neck |

## Notes on originality
All code and note data here are **original** and computed from music theory first principles. This
demo intentionally contains **no tablature, lyrics, or copyrighted diagrams**. It's a companion to
my personal (private) guitar practice library.

---
*MIT-style personal project — use it, learn from it, tune up. 🤘*
