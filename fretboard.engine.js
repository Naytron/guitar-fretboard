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

/* The set of pitch classes belonging to root + scale formula */
function scaleSet(rootPc, steps) {
  return new Set(steps.map((s) => (rootPc + s) % 12));
}

/* Note at a given string/fret */
function noteAt(stringPc, fret) {
  return (stringPc + fret) % 12;
}

/* Build the diatonic triads for a major or natural-minor scale. */
function diatonicTriads(rootPc, scaleKey) {
  const scale = SCALES[scaleKey];
  if (!Number.isInteger(rootPc) || rootPc < 0 || rootPc > 11) {
    throw new RangeError('rootPc must be an integer from 0 through 11.');
  }
  if (!['major', 'natural_minor'].includes(scaleKey) || !scale) {
    throw new RangeError('Diatonic triads are supported for major and natural minor scales.');
  }

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const qualities = {
    '4,7': { name: 'Major', symbol: '', romanCase: 'upper', labels: ['R', '3', '5'] },
    '3,7': { name: 'Minor', symbol: 'm', romanCase: 'lower', labels: ['R', '♭3', '5'] },
    '3,6': { name: 'Diminished', symbol: 'dim', romanCase: 'lower', labels: ['R', '♭3', '♭5'] },
  };
  const steps = scale.steps;

  return steps.map((rootStep, degreeIndex) => {
    const thirdIndex = (degreeIndex + 2) % steps.length;
    const fifthIndex = (degreeIndex + 4) % steps.length;
    const thirdStep = steps[thirdIndex] + (thirdIndex <= degreeIndex ? 12 : 0);
    const fifthStep = steps[fifthIndex] + (fifthIndex <= degreeIndex ? 12 : 0);
    const intervals = [0, thirdStep - rootStep, fifthStep - rootStep];
    const quality = qualities[`${intervals[1]},${intervals[2]}`];

    if (!quality) {
      throw new Error(`Unsupported diatonic triad intervals: ${intervals.join(',')}.`);
    }

    const roman = romanNumerals[degreeIndex];
    const romanNumeral = quality.romanCase === 'lower' ? roman.toLowerCase() : roman;
    const root = (rootPc + rootStep) % 12;

    return {
      degree: degreeIndex + 1,
      rootPc: root,
      quality: quality.name,
      qualitySymbol: quality.symbol,
      name: `${nameFor(root, keyPrefersFlats(rootPc, scale.family))} ${quality.name}`,
      symbol: `${nameFor(root, keyPrefersFlats(rootPc, scale.family))}${quality.symbol}`,
      romanNumeral: `${romanNumeral}${quality.name === 'Diminished' ? '°' : ''}`,
      notes: intervals.map((interval) => (rootPc + rootStep + interval) % 12),
      steps: intervals,
      labels: quality.labels,
      family: scale.family,
    };
  });
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
    [0, 'dim7',       'C E♭ G♭ A'], // dim family → flats (relative-major E♭)
    [2, 'sus2',       'D E A'],
    [2, 'sus4',       'D G A'],
    [0, 'add9',       'C E G D'],
  ];

  cases.forEach(([rootPc, key, want]) => {
    const chord = CHORDS[key];
    const flats = keyPrefersFlats(rootPc, chord.family);
    const got = chord.steps.map((s) => nameFor((rootPc + s) % 12, flats)).join(' ');
    check(`${nameFor(rootPc, flats)} ${chord.name}`, got, want);
  });

  const passed = results.every((r) => r.ok);
  results.forEach((r) => {
    if (!r.ok) console.error(`Chord self-test FAILED: ${r.label} → got "${r.got}", want "${r.want}"`);
  });
  return { passed, results };
}

/* ---- Diatonic progression self-test ---- */
function runDiatonicSelfTest() {
  const results = [];
  const check = (label, got, want) => results.push({ label, ok: got === want, got, want });
  const summarize = (triads) => triads.map((chord) => chord.romanNumeral).join(' ');

  check('C major Roman numerals', summarize(diatonicTriads(0, 'major')), 'I ii iii IV V vi vii°');
  check('A natural minor Roman numerals', summarize(diatonicTriads(9, 'natural_minor')), 'i ii° III iv v VI VII');
  check(
    'C major chord notes',
    diatonicTriads(0, 'major').map((chord) => chord.notes.map((pc) => nameFor(pc, false)).join(' ')).join(' | '),
    'C E G | D F A | E G B | F A C | G B D | A C E | B D F',
  );

  const passed = results.every((r) => r.ok);
  results.forEach((r) => {
    if (!r.ok) console.error(`Diatonic progression self-test FAILED: ${r.label} → got "${r.got}", want "${r.want}"`);
  });
  return { passed, results };
}

/* Expose for Node-based testing while staying browser-friendly */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SHARP, FLAT, STRINGS, SCALES, CHORDS,
    keyPrefersFlats, nameFor, scaleSet, noteAt,
    intervalCategory, chordIntervals, diatonicTriads,
    runSelfTest, runChordSelfTest, runDiatonicSelfTest,
  };
}
