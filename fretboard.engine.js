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

/* ---- Chord qualities (for the chords diagram) ----
 * Each chord carries `steps` (semitones from root) and a parallel `labels`
 * array giving the correct interval name for each tone, so add9's 2-semitone
 * tone reads "9" and dim7's 9-semitone tone reads "♭♭7" (not raw semitones).
 * `family` drives sharp/flat spelling exactly like the scales do.
 */
const CHORDS = {
  major:      { name: 'Major',        symbol: '',     steps: [0, 4, 7],     labels: ['R', '3', '5'],           family: 'major', group: 'Triads' },
  minor:      { name: 'Minor',        symbol: 'm',    steps: [0, 3, 7],     labels: ['R', '♭3', '5'],          family: 'minor', group: 'Triads' },
  diminished: { name: 'Diminished',   symbol: 'dim',  steps: [0, 3, 6],     labels: ['R', '♭3', '♭5'],         family: 'minor', group: 'Triads' },
  augmented:  { name: 'Augmented',    symbol: 'aug',  steps: [0, 4, 8],     labels: ['R', '3', '♯5'],          family: 'major', group: 'Triads' },
  dom7:       { name: 'Dominant 7',   symbol: '7',    steps: [0, 4, 7, 10], labels: ['R', '3', '5', '♭7'],     family: 'major', group: 'Sevenths' },
  dim7:       { name: 'Diminished 7', symbol: '°7',   steps: [0, 3, 6, 9],  labels: ['R', '♭3', '♭5', '♭♭7'], family: 'minor', group: 'Sevenths' },
  sus2:       { name: 'Sus2',         symbol: 'sus2', steps: [0, 2, 7],     labels: ['R', '2', '5'],           family: 'major', group: 'Suspended & added' },
  sus4:       { name: 'Sus4',         symbol: 'sus4', steps: [0, 5, 7],     labels: ['R', '4', '5'],           family: 'major', group: 'Suspended & added' },
  add9:       { name: 'Add9',         symbol: 'add9', steps: [0, 4, 7, 2],  labels: ['R', '3', '5', '9'],      family: 'major', group: 'Suspended & added' },
};

const MODES = {
  major: { name: 'Ionian (major)', parentOffset: 0 },
  dorian: { name: 'Dorian', parentOffset: 2 },
  phrygian: { name: 'Phrygian', parentOffset: 4 },
  lydian: { name: 'Lydian', parentOffset: 5 },
  mixolydian: { name: 'Mixolydian', parentOffset: 7 },
  natural_minor: { name: 'Aeolian (natural minor)', parentOffset: 9 },
  locrian: { name: 'Locrian', parentOffset: 11 },
};

function modeStepPattern(steps) {
  return steps.map((step, index) => {
    const distance = (steps[index + 1] ?? 12) - step;
    if (distance !== 1 && distance !== 2) throw new Error(`Invalid modal step: ${distance}`);
    return distance === 2 ? 'W' : 'H';
  });
}

/* Map an interval label to a color category used by the chords diagram. */
function intervalCategory(label) {
  if (label === 'R') return 'root';
  if (label === '3' || label === '♭3') return 'third';
  if (label === '5' || label === '♭5' || label === '♯5') return 'fifth';
  if (label === '7' || label === '♭7' || label === '♭♭7') return 'seventh';
  return 'ext';
}

/* Build a pitch-class → interval-label map for a chord rooted at rootPc. */
function chordIntervals(rootPc, chord) {
  const map = new Map();
  chord.steps.forEach((s, i) => map.set((rootPc + s) % 12, chord.labels[i]));
  return map;
}

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

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PITCHES = [0, 2, 4, 5, 7, 9, 11];

function intervalDegree(label) {
  if (label === 'R') return 0;
  const interval = Number(label.match(/\d+/)?.[0]);
  const degrees = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 9: 1, 11: 3, 13: 5 };
  if (!degrees[interval]) throw new Error(`Unsupported chord interval: ${label}`);
  return degrees[interval];
}

function spellChord(rootPc, chord, useFlats) {
  const rootName = nameFor(rootPc, useFlats);
  const rootLetter = LETTERS.indexOf(rootName[0]);
  return chord.steps.map((step, index) => {
    const degree = intervalDegree(chord.labels[index]);
    if (degree === 0) return rootName;

    const letterIndex = (rootLetter + degree) % LETTERS.length;
    const naturalPitch = NATURAL_PITCHES[letterIndex];
    const targetPitch = (rootPc + step) % 12;
    const difference = ((targetPitch - naturalPitch + 12) % 12);
    const accidentalOffset = difference > 6 ? difference - 12 : difference;
    if (Math.abs(accidentalOffset) > 2) {
      throw new Error(`Cannot spell ${chord.labels[index]} from ${rootName}`);
    }
    const accidental = accidentalOffset < 0
      ? '♭'.repeat(-accidentalOffset)
      : '♯'.repeat(accidentalOffset);
    return `${LETTERS[letterIndex]}${accidental}`;
  });
}

function diatonicChords(rootPc, scale, useSevenths = false, useFlats = keyPrefersFlats(rootPc, scale.family)) {
  if (scale.steps.length !== 7) {
    throw new Error(`Diatonic progressions require a seven-note scale: ${scale.name}`);
  }

  const romanDegrees = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const scaleStepAt = (degree) => scale.steps[degree % 7] + Math.floor(degree / 7) * 12;

  return romanDegrees.map((roman, degree) => {
    const rootStep = scaleStepAt(degree);
    const third = scaleStepAt(degree + 2) - rootStep;
    const fifth = scaleStepAt(degree + 4) - rootStep;
    const seventh = scaleStepAt(degree + 6) - rootStep;
    const steps = [0, third, fifth];
    const labels = ['R', third === 3 ? '♭3' : '3', fifth === 6 ? '♭5' : fifth === 8 ? '♯5' : '5'];
    const diminished = fifth === 6;
    const augmented = fifth === 8;
    const minor = third === 3;
    let numeral = minor || diminished ? roman.toLowerCase() : roman;
    if (diminished) numeral += '°';
    else if (augmented) numeral += '+';

    let name = diminished ? 'Diminished' : augmented ? 'Augmented' : minor ? 'Minor' : 'Major';
    if (useSevenths) {
      steps.push(seventh);
      labels.push(seventh === 9 ? '♭♭7' : seventh === 10 ? '♭7' : '7');
      if (diminished) {
        if (seventh === 10) numeral = `${roman.toLowerCase()}ø7`;
        else numeral = `${roman.toLowerCase()}°7`;
        name = seventh === 10 ? 'Half-diminished 7' : 'Diminished 7';
      } else {
        numeral += seventh === 11 ? 'maj7' : '7';
        name = seventh === 11
          ? `${name} 7`
          : minor ? 'Minor 7' : augmented ? 'Augmented 7' : 'Dominant 7';
      }
    }

    const root = (rootPc + rootStep) % 12;
    const chord = { steps, labels };
    return {
      degree,
      root,
      roman: numeral,
      name,
      steps,
      labels,
      notes: spellChord(root, chord, useFlats),
    };
  });
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

/* ---- Chord self-test: prove the chord spellings are correct ---- */
function runChordSelfTest() {
  const results = [];
  const check = (label, got, want) => results.push({ label, ok: got === want, got, want });

  // rootPc, chord key, expected spelled notes (hand-verified, auto spelling by key)
  const cases = [
    [0, 'major',      'C E G'],
    [9, 'minor',      'A C E'],
    [7, 'dom7',       'G B D F'],
    [3, 'major',      'E♭ G B♭'],   // flat-root chord spells with flats
    [0, 'augmented',  'C E G♯'],
    [11, 'diminished','B D F'],
    [0, 'dim7',       'C E♭ G♭ B♭♭'], // interval spelling preserves the diminished seventh degree
    [2, 'sus2',       'D E A'],
    [2, 'sus4',       'D G A'],
    [0, 'add9',       'C E G D'],
  ];

  cases.forEach(([rootPc, key, want]) => {
    const chord = CHORDS[key];
    const flats = keyPrefersFlats(rootPc, chord.family);
    const got = spellChord(rootPc, chord, flats).join(' ');
    check(`${nameFor(rootPc, flats)} ${chord.name}`, got, want);
  });
  check('C dominant 7 interval spelling', spellChord(0, CHORDS.dom7, false).join(' '), 'C E G B♭');
  check('F diminished interval spelling', spellChord(5, CHORDS.diminished, true).join(' '), 'F A♭ C♭');
  check('C diminished 7 interval spelling', spellChord(0, CHORDS.dim7, true).join(' '), 'C E♭ G♭ B♭♭');
  check(
    'G major diatonic triads',
    diatonicChords(7, SCALES.major).map((chord) => chord.roman).join(' '),
    'I ii iii IV V vi vii°',
  );
  check(
    'C natural minor diatonic sevenths',
    diatonicChords(0, SCALES.natural_minor, true).map((chord) => chord.roman).join(' '),
    'i7 iiø7 IIImaj7 iv7 v7 VImaj7 VII7',
  );

  const passed = results.every((r) => r.ok);
  results.forEach((r) => {
    if (!r.ok) console.error(`Chord self-test FAILED: ${r.label} → got "${r.got}", want "${r.want}"`);
  });
  return { passed, results };
}

/* Expose for Node-based testing while staying browser-friendly */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SHARP, FLAT, STRINGS, SCALES, CHORDS, MODES, modeStepPattern,
    keyPrefersFlats, nameFor, spellChord, diatonicChords, scaleSet, noteAt,
    intervalCategory, chordIntervals, runSelfTest, runChordSelfTest,
  };
}
