import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const theory = require('../fretboard.engine.js');
const quiz = require('../quiz.engine.js');
const lessons = require('../lessons.js');

// Mode order and degree/parent math for every tonic × mode pair.
assert.deepEqual(theory.MODE_ORDER, ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'natural_minor', 'locrian']);
for (const modeKey of theory.MODE_ORDER) {
  const degree = theory.modeDegree(modeKey);
  assert.equal(degree, theory.MODE_ORDER.indexOf(modeKey) + 1);
  for (let root = 0; root < 12; root++) {
    const parent = theory.parentMajorPc(root, modeKey);
    assert.equal((parent + theory.SCALES.major.steps[degree - 1]) % 12, root, `${modeKey} tonic sits on degree ${degree} of its parent`);
    const parentSet = new Set(theory.SCALES.major.steps.map(step => (parent + step) % 12));
    const modeSet = new Set(theory.SCALES[modeKey].steps.map(step => (root + step) % 12));
    assert.deepEqual([...modeSet].sort(), [...parentSet].sort(), `${modeKey} shares the parent pitch set`);
  }
}
assert.deepEqual(theory.scaleDegreeLabels(theory.SCALES.dorian), ['1', '2', '♭3', '4', '5', '6', '♭7']);
assert.deepEqual(theory.scaleDegreeLabels(theory.SCALES.lydian), ['1', '2', '3', '♯4', '5', '6', '7']);
const expectedCharacteristics = { major: [], dorian: ['6'], phrygian: ['♭2'], lydian: ['♯4'], mixolydian: ['♭7'], natural_minor: [], locrian: ['♭2', '♭5'] };
for (const [modeKey, labels] of Object.entries(expectedCharacteristics)) {
  assert.deepEqual(theory.modeCharacteristics(modeKey).labels, labels, `${modeKey} characteristic tones`);
}
assert.equal(theory.MODE_BRIGHTNESS[0], 'lydian');
assert.equal(theory.MODE_BRIGHTNESS.at(-1), 'locrian');

// Lesson structure.
assert.deepEqual(lessons.LEVELS, ['beginner', 'intermediate', 'advanced']);
assert.deepEqual(lessons.PAGES, ['scales', 'chords', 'progressions', 'modes']);
for (const page of lessons.PAGES) {
  for (const level of lessons.LEVELS) {
    const lesson = lessons.LESSONS[page][level];
    assert.ok(lesson.title && lesson.summary && lesson.mentalModel?.name && lesson.sections.length >= 2, `${page}/${level} has title, summary, model and sections`);
  }
}

// Every page/level resolves for every root, spelling, scale/mode/pattern, and produces a valid quiz preset.
const scaleKeys = Object.keys(theory.SCALES);
const patterns = [[0, 4, 5, 3], [0, 5, 3, 4], [1, 4, 0], [0, 3, 4], [5, 3, 0, 4]];
let resolved = 0;
for (const page of lessons.PAGES) {
  const variants = page === 'chords' ? [{}]
    : page === 'modes' ? theory.MODE_ORDER.map(scaleKey => ({ scaleKey }))
      : page === 'progressions' ? scaleKeys.filter(key => theory.SCALES[key].steps.length === 7).flatMap(scaleKey => patterns.map(pattern => ({ scaleKey, pattern })))
        : scaleKeys.map(scaleKey => ({ scaleKey }));
  for (const variant of variants) for (let rootPc = 0; rootPc < 12; rootPc++) for (const flats of [true, false]) {
    const ctx = lessons.context(page, { rootPc, flats, ...variant });
    for (const level of lessons.LEVELS) {
      const lesson = lessons.resolve(page, level, ctx);
      assert.ok(lesson.sections.every(section => section.paragraphs.every(p => p.length > 0)));
      assert.ok(lesson.quiz.href.startsWith('quiz.html?'));
      const settings = quiz.settings({ ...quiz.defaults, ...lesson.quiz.settings });
      for (const [key, value] of Object.entries(lesson.quiz.settings)) assert.equal(settings[key], value, `${page}/${level} preset ${key} survives validation`);
      resolved++;
    }
  }
}
assert.ok(resolved > 1000, `resolved ${resolved} lessons`);

// Mode context sanity: D Dorian is degree 2 of C major; its characteristic chord is G major (IV).
const dDorian = lessons.context('modes', { rootPc: 2, scaleKey: 'dorian', flats: false });
assert.equal(dDorian.degree, 2);
assert.equal(dDorian.parentName, 'C');
assert.deepEqual(dDorian.characteristicNotes, ['B']);
assert.deepEqual(dDorian.characteristicChord.notes, ['G', 'B', 'D']);
assert.equal(dDorian.characteristicChord.roman, 'IV');
const cLydian = lessons.context('modes', { rootPc: 0, scaleKey: 'lydian', flats: false });
assert.equal(cLydian.parentName, 'G');
assert.deepEqual(cLydian.characteristicChord.notes, ['D', 'F♯', 'A']);
const aMinor = lessons.context('modes', { rootPc: 9, scaleKey: 'natural_minor', flats: false });
assert.equal(aMinor.characteristicChord, null);

// Progressions context: V/V in C is D7; ♭VII is B♭.
const cProg = lessons.context('progressions', { rootPc: 0, scaleKey: 'major', flats: false, pattern: [0, 4, 5, 3] });
assert.deepEqual(cProg.secondaryDominant, ['D', 'F♯', 'A', 'C']);
assert.deepEqual(cProg.flatSeven, ['B♭', 'D', 'F']);
assert.deepEqual(cProg.borrowedFour, ['F', 'A♭', 'C']);

console.log(`PASS lessons: ${resolved} lesson resolutions, mode math, quiz presets`);
