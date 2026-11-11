import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const theory = require('../fretboard.engine.js');
const quiz = require('../quiz.engine.js');
const random = () => 0.37;

assert.deepEqual(theory.spellScale(1, theory.SCALES.major, false), ['C♯', 'D♯', 'E♯', 'F♯', 'G♯', 'A♯', 'B♯']);
assert.deepEqual(theory.diatonicChords(1, theory.SCALES.major, false, false).map(chord => chord.notes[0]), ['C♯', 'D♯', 'E♯', 'F♯', 'G♯', 'A♯', 'B♯']);
assert.deepEqual(theory.spellScale(6, theory.SCALES.major, false), ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯']);
assert.deepEqual(theory.spellScale(5, theory.SCALES.major, true), ['F', 'G', 'A', 'B♭', 'C', 'D', 'E']);
assert.deepEqual(theory.spellScale(7, theory.SCALES.minor_pentatonic, true), ['G', 'B♭', 'C', 'D', 'F']);
for (const key of Object.keys(theory.MODES)) {
  for (let root = 0; root < 12; root++) for (const flats of [true, false]) {
    const notes = theory.spellScale(root, theory.SCALES[key], flats);
    assert.equal(new Set(notes.map(note => note[0])).size, 7);
    const chords = theory.diatonicChords(root, theory.SCALES[key], true, flats);
    chords.forEach((chord, degree) => {
      assert.equal(chord.notes[0], notes[degree]);
      assert.deepEqual(chord.notes, [0, 2, 4, 6].map(offset => notes[(degree + offset) % 7]));
    });
  }
}
assert.equal(theory.scalePrefersFlats(2, 'dorian'), false);
assert.throws(() => quiz.settings({ frets: 0 }), /Invalid/);
assert.throws(() => quiz.settings({ string: '7' }), /Invalid/);
assert.throws(() => quiz.start({}, () => 1), /Random/);
assert.throws(() => quiz.start({}, random, ['nonexistent']), /No questions/);
for (const activity of Object.keys(quiz.activities)) {
  const session = quiz.start({ activity }, random);
  assert.equal(session.questions.length, 10);
  assert.deepEqual(session, quiz.start({ activity }, random));
  for (const question of session.questions) {
    assert.equal(new Set(question.options.map(item => item.id)).size, question.options.length);
    assert.ok(question.options.some(item => item.id === question.correct.id));
    assert.ok(question.options.length <= 4);
    assert.ok(question.explanation.length > 10);
  }
  const initialCycle = session.questions.slice(0, Math.min(10, session.poolSize));
  assert.equal(new Set(initialCycle.map(question => question.id)).size, initialCycle.length);
  assert.ok(session.questions.every((question, index) => !index || question.id !== session.questions[index - 1].id));
}
const find = quiz.start({ direction: 'find', string: '1', frets: 12 }, random);
const e = find.questions.find(question => question.correct.id === '4');
assert.deepEqual(e.valid, ['1:0', '1:12']);
for (const coordinate of e.valid) assert.equal(quiz.answer({ ...find, questions: [e] }, coordinate).results[0].correct, true);
const chromatic = quiz.start({ notes: 'chromatic', frets: 12 }, random);
assert.ok(chromatic.questions.some(question => question.correct.label.includes('/')));
const intervals = quiz.pool({ activity: 'intervals', string: '1' });
assert.equal(intervals[0].correct.label, 'Unison');
assert.equal(intervals[12].correct.label, 'Octave');
const roman = quiz.pool({ activity: 'roman', key: 6 });
assert.equal(roman.find(question => question.id === 'roman:6:false').correct.label, 'E♯ Diminished');
assert.ok(quiz.pool({ activity: 'chords', advanced: true }).some(question => question.prompt.includes('Dominant 7')));
let session = quiz.start({}, random);
assert.equal(quiz.next(session), session);
session = quiz.answer(session, '999');
const answered = session;
assert.equal(quiz.answer(session, session.questions[0].correct.id), answered);
session = quiz.next(session);
session = quiz.assist(session);
session = quiz.answer(session, session.questions[1].correct.id);
session = quiz.next(session);
while (session.index < session.questions.length) {
  session = quiz.next(quiz.answer(session, session.questions[session.index].correct.id));
}
assert.equal(quiz.answer(session, '0'), session);
const summary = quiz.summary(session);
assert.equal(summary.correct, 8);
assert.equal(summary.assisted, 1);
assert.equal(Object.values(summary.missed).reduce((a, b) => a + b, 0), 2);
let review = quiz.retry(session);
assert.equal(review.review, true);
assert.equal(review.questions.length, 2);
while (review.index < review.questions.length) review = quiz.next(quiz.answer(review, review.questions[review.index].correct.id));
assert.equal(quiz.summary(review).correct, 2);
assert.equal(quiz.summary(session).correct, 8);
assert.throws(() => quiz.retry(review), /no missed/);
const focused = quiz.start(session.settings, random, Object.keys(summary.missed));
assert.ok(focused.questions.every(question => Object.hasOwn(summary.missed, question.skill)));
for (const assistAll of [false, true]) {
  let zero = quiz.start({}, random);
  while (zero.index < 10) {
    if (assistAll) zero = quiz.assist(zero);
    zero = quiz.next(quiz.answer(zero, '999'));
  }
  assert.equal(quiz.summary(zero).correct, 0);
  assert.equal(quiz.retry(zero).questions.length, 10);
}
console.log('PASS contextual spelling across all modes/keys; quiz pools, grading, hints, retry, and deterministic generation');

// Modes activity: 26 questions per tonic, every parent key is correct, no option duplicates.
for (let key = 0; key < 12; key++) {
  const modes = quiz.pool({ activity: 'modes', key });
  assert.equal(modes.length, 26);
  for (const question of modes.filter(q => q.id.startsWith('mode:parent:'))) {
    const modeKey = question.id.split(':')[2];
    assert.equal(Number(question.correct.id), theory.parentMajorPc(key, modeKey));
  }
  const session = quiz.start({ activity: 'modes', key }, random);
  for (const question of session.questions) {
    assert.equal(new Set(question.options.map(option => option.id)).size, 4);
    assert.ok(question.options.some(option => option.id === question.correct.id));
  }
}
assert.equal(quiz.pool({ activity: 'modes', key: 0 }).filter(q => q.id.startsWith('mode:color:')).length, 5);
