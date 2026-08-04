/*
 * Guitar Fretboard — an original, dependency-free interactive fretboard.
 *
 * Every note is COMPUTED from the open-string tuning by chromatic math
 * (note = (openSemitone + fret) % 12). Nothing here is copied from any
 * sheet music, diagram, or copyrighted source.
 */

/* ---- Pitch-class model (C = 0 ... B = 11) ---- */
const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/* Standard tuning, 6th string (low E) → 1st string (high E) */
const STRINGS = [
  { label: '6 · E', pc: 4 },
  { label: '5 · A', pc: 9 },
  { label: '4 · D', pc: 2 },
  { label: '3 · G', pc: 7 },
  { label: '2 · B', pc: 11 },
  { label: '1 · e', pc: 4 },
];

/* Fingerboard inlay positions */
const SINGLE_MARKERS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const DOUBLE_MARKERS = new Set([12, 24]);

/* ---- Scale / chord formulas (semitones from the root) ---- */
const SCALES = {
  major:            { name: 'Major (Ionian)',      steps: [0, 2, 4, 5, 7, 9, 11], family: 'major' },
  natural_minor:    { name: 'Natural minor (Aeolian)', steps: [0, 2, 3, 5, 7, 8, 10], family: 'minor' },
  major_pentatonic: { name: 'Major pentatonic',    steps: [0, 2, 4, 7, 9], family: 'major' },
  minor_pentatonic: { name: 'Minor pentatonic',    steps: [0, 3, 5, 7, 10], family: 'minor' },
  blues:            { name: 'Blues (minor)',       steps: [0, 3, 5, 6, 7, 10], family: 'minor' },
  dorian:           { name: 'Dorian',              steps: [0, 2, 3, 5, 7, 9, 10], family: 'minor' },
  phrygian:         { name: 'Phrygian',            steps: [0, 1, 3, 5, 7, 8, 10], family: 'minor' },
  lydian:           { name: 'Lydian',              steps: [0, 2, 4, 6, 7, 9, 11], family: 'major' },
  mixolydian:       { name: 'Mixolydian',          steps: [0, 2, 4, 5, 7, 9, 10], family: 'major' },
  locrian:          { name: 'Locrian',             steps: [0, 1, 3, 5, 6, 8, 10], family: 'minor' },
  major_triad:      { name: 'Major triad',         steps: [0, 4, 7], family: 'major' },
  minor_triad:      { name: 'Minor triad',         steps: [0, 3, 7], family: 'minor' },
  maj7:             { name: 'Major 7th',           steps: [0, 4, 7, 11], family: 'major' },
  min7:             { name: 'Minor 7th',           steps: [0, 3, 7, 10], family: 'minor' },
  dom7:             { name: 'Dominant 7th',        steps: [0, 4, 7, 10], family: 'major' },
  chromatic:        { name: 'Chromatic (all notes)', steps: [0,1,2,3,4,5,6,7,8,9,10,11], family: 'major' },
};

/*
 * Enharmonic preference. For a given key, decide whether note names should
 * read with sharps or flats — the same choice a printed fretboard chart makes
 * (e.g. G major → F♯, F major → B♭). Major-key flat roots: F Bb Eb Ab Db.
 * Minor-like scales borrow the preference of their relative major (root + 3).
 */
const MAJOR_FLAT_ROOTS = new Set([5, 10, 3, 8, 1]); // F, B♭, E♭, A♭, D♭

function keyPrefersFlats(rootPc, family) {
  const referencePc = family === 'minor' ? (rootPc + 3) % 12 : rootPc;
  return MAJOR_FLAT_ROOTS.has(referencePc);
}

/* Name a pitch class using the chosen accidental convention */
function nameFor(pc, useFlats) {
  return (useFlats ? FLAT : SHARP)[((pc % 12) + 12) % 12];
}

/* The set of pitch classes belonging to root + scale formula */
function scaleSet(rootPc, steps) {
  return new Set(steps.map((s) => (rootPc + s) % 12));
}

/* Note at a given string/fret */
function noteAt(stringPc, fret) {
  return (stringPc + fret) % 12;
}

/* ---- Self-test: prove the note math is correct ---- */
function runSelfTest() {
  const results = [];
  const check = (label, got, want) => results.push({ label, ok: got === want, got, want });

  // Open strings, low → high, must read E A D G B E
  check('open strings', STRINGS.map((s) => nameFor(s.pc, false)).join(' '), 'E A D G B E');

  // 12th fret equals the open string (octave) on every string
  const octaveOk = STRINGS.every((s) => noteAt(s.pc, 12) === s.pc);
  check('12th fret = octave', octaveOk, true);

  // G major scale spells G A B C D E F♯
  const g = 7;
  const gMajor = SCALES.major.steps
    .map((s) => nameFor((g + s) % 12, keyPrefersFlats(g, 'major')))
    .join(' ');
  check('G major spelling', gMajor, 'G A B C D E F♯');

  // Low-E string, frets 0–5, read E F F♯ G G♯ A
  const lowE = [0, 1, 2, 3, 4, 5].map((f) => nameFor(noteAt(4, f), false)).join(' ');
  check('low-E frets 0–5', lowE, 'E F F♯ G G♯ A');

  // F major should prefer flats: F G A B♭ C D E
  const fMajor = SCALES.major.steps
    .map((s) => nameFor((5 + s) % 12, keyPrefersFlats(5, 'major')))
    .join(' ');
  check('F major spelling', fMajor, 'F G A B♭ C D E');

  const passed = results.every((r) => r.ok);
  results.forEach((r) => {
    if (!r.ok) console.error(`Self-test FAILED: ${r.label} → got "${r.got}", want "${r.want}"`);
  });
  return { passed, results };
}

/* Expose for Node-based testing while staying browser-friendly */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SHARP, FLAT, STRINGS, SCALES, keyPrefersFlats, nameFor, scaleSet, noteAt, runSelfTest };
}
