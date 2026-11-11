/* Pure question generation and session scoring; shared theory remains the source of truth. */
const QuizEngine = (() => {
  const theory = typeof module !== 'undefined' && module.exports
    ? require('./fretboard.engine.js')
    : { STRINGS, CHORDS, SCALES, MODES, MODE_ORDER, SHARP, FLAT, noteAt, nameFor, spellChord, diatonicChords, scalePrefersFlats, modeStepPattern, modeDegree, parentMajorPc, modeCharacteristics, scaleDegreeLabels };
  const defaults = { activity: 'notes', direction: 'name', string: 'all', frets: 5, notes: 'natural', key: 7, scale: 'major', advanced: false };
  const activities = { notes: 'Fretboard notes', intervals: 'Intervals', chords: 'Chord tones', roman: 'Roman numerals', modes: 'Modes' };
  const intervals = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave'];
  const naturalPitches = [0, 2, 4, 5, 7, 9, 11];
  const pitchLabel = pc => theory.SHARP[pc] === theory.FLAT[pc] ? theory.SHARP[pc] : `${theory.SHARP[pc]} / ${theory.FLAT[pc]}`;
  const strings = settings => [1, 2, 3, 4, 5, 6].filter(n => settings.string === 'all' || String(n) === settings.string);
  const open = string => theory.STRINGS[6 - string].pc;
  const option = (id, label) => ({ id: String(id), label });

  function settings(value = {}) {
    const result = { ...defaults, ...value };
    if (!Object.hasOwn(activities, result.activity) || !['name', 'find'].includes(result.direction) ||
        !['all', '1', '2', '3', '4', '5', '6'].includes(result.string) ||
        ![5, 12].includes(result.frets) || !['natural', 'chromatic'].includes(result.notes) ||
        !Number.isInteger(result.key) || result.key < 0 || result.key > 11 ||
        !['major', 'natural_minor'].includes(result.scale) || typeof result.advanced !== 'boolean') {
      throw new Error('Invalid quiz settings. Choose a supported activity, string, range, and key.');
    }
    return result;
  }

  function shuffle(items, random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const sample = random();
      if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error('Random samples must be between 0 and 1.');
      const target = Math.floor(sample * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function choices(correct, candidates, random) {
    const unique = [...new Map(candidates.map(item => [item.id, item])).values()].filter(item => item.id !== correct.id);
    return shuffle([correct, ...shuffle(unique, random).slice(0, 3)], random);
  }

  function pool(input) {
    const s = settings(input);
    const questions = [];
    const pitches = s.notes === 'natural' ? naturalPitches : Array.from({ length: 12 }, (_, i) => i);
    const pitchOptions = Array.from({ length: 12 }, (_, pc) => option(pc, pitchLabel(pc)));
    if (s.activity === 'notes') {
      for (const string of strings(s)) {
        const positions = Array.from({ length: s.frets + 1 }, (_, fret) => ({ string, fret, pc: theory.noteAt(open(string), fret) }));
        if (s.direction === 'name') {
          for (const position of positions.filter(p => pitches.includes(p.pc))) {
            questions.push({
              id: `note:${string}:${position.fret}`, skill: `String ${string}: ${pitchLabel(position.pc)}`,
              prompt: `What note is on string ${string}, fret ${position.fret}?`,
              correct: option(position.pc, pitchLabel(position.pc)), candidates: pitches.map(pc => option(pc, pitchLabel(pc))),
              board: { strings: [string], frets: s.frets, marks: [{ ...position, text: '?' }] },
              explanation: `String ${string} is tuned to ${pitchLabel(open(string))}. Count ${position.fret} semitone(s) up to ${pitchLabel(position.pc)}. Fret 12 repeats the open-string note.`,
            });
          }
        } else {
          for (const pc of pitches) {
            const valid = positions.filter(p => p.pc === pc);
            if (!valid.length) continue;
            questions.push({
              id: `find:${string}:${pc}`, skill: `String ${string}: ${pitchLabel(pc)}`,
              prompt: `Find ${pitchLabel(pc)} on string ${string}, frets 0–${s.frets}.`,
              correct: option(pc, pitchLabel(pc)), valid: valid.map(p => `${p.string}:${p.fret}`),
              board: { strings: [string], frets: s.frets, marks: [] },
              explanation: `${pitchLabel(pc)} is at fret ${valid.map(p => p.fret).join(' or ')} on string ${string}. Any of these positions is correct.`,
            });
          }
        }
      }
    } else if (s.activity === 'intervals') {
      for (const string of strings(s)) for (let distance = 0; distance <= 12; distance++) {
        questions.push({
          id: `interval:${string}:${distance}`, skill: intervals[distance],
          prompt: 'What interval is the target above the open-string root?',
          correct: option(distance, intervals[distance]), candidates: intervals.map((label, id) => option(id, label)),
          board: { strings: [string], frets: 12, marks: distance === 0
            ? [{ string, fret: 0, text: 'R+?' }]
            : [{ string, fret: 0, text: 'R' }, { string, fret: distance, text: '?' }] },
          explanation: `${distance} semitone(s) above the root is ${intervals[distance].toLowerCase()}. Each fret is one semitone. We use ascending simple intervals; 6 semitones is called the tritone here.`,
        });
      }
    } else if (s.activity === 'chords') {
      const qualities = s.advanced ? ['major', 'minor', 'diminished', 'augmented', 'dom7'] : ['major', 'minor'];
      for (const quality of qualities) {
        const chord = theory.CHORDS[quality];
        const flats = theory.scalePrefersFlats(s.key, s.scale);
        const names = theory.spellChord(s.key, chord, flats);
        chord.steps.forEach((step, index) => {
          const pc = (s.key + step) % 12;
          questions.push({
            id: `chord:${quality}:${index}`, skill: `${chord.name}: ${chord.labels[index]}`,
            prompt: `Which note is ${chord.labels[index] === 'R' ? 'the root' : `interval ${chord.labels[index]}`} of ${names[0]} ${chord.name}?`,
            correct: option(pc, names[index]),
            candidates: pitchOptions.map(item => {
              const toneIndex = chord.steps.findIndex(tone => (s.key + tone) % 12 === Number(item.id));
              return toneIndex === -1 ? item : option(item.id, names[toneIndex]);
            }),
            explanation: `${names[0]} ${chord.name} is ${names.join(' · ')}. Formula: ${chord.labels.join(' · ')}. ${names[index]} is ${chord.labels[index]}.`,
          });
        });
      }
    } else if (s.activity === 'modes') {
      const modeOptions = theory.MODE_ORDER.map(key => option(key, theory.MODES[key].name));
      const ordinal = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
      const degreeLabels = ['♭2', '♭3', '♯4', '♭5', '6', '♭6', '♭7', '7'];
      for (const modeKey of theory.MODE_ORDER) {
        const mode = theory.MODES[modeKey];
        const degree = theory.modeDegree(modeKey);
        const pattern = theory.modeStepPattern(theory.SCALES[modeKey].steps).join(' ');
        const correct = option(modeKey, mode.name);
        questions.push({
          id: `mode:pattern:${modeKey}`, skill: `Mode pattern: ${mode.name}`,
          prompt: `Which mode has the step pattern ${pattern}?`,
          correct, candidates: modeOptions,
          explanation: `${pattern} is ${mode.name}: it is the major-scale pattern rotated to start on degree ${degree}. W is a whole step (2 frets) and H a half step (1 fret).`,
        });
        questions.push({
          id: `mode:degree:${modeKey}`, skill: `Mode order: ${mode.name}`,
          prompt: `Which mode starts on the ${ordinal[degree - 1]} degree of the major scale?`,
          correct, candidates: modeOptions,
          explanation: `The modes in order are Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian. Degree ${degree} is ${mode.name}.`,
        });
        const flats = theory.scalePrefersFlats(s.key, modeKey);
        const tonic = theory.nameFor(s.key, flats);
        const parent = theory.parentMajorPc(s.key, modeKey);
        questions.push({
          id: `mode:parent:${modeKey}`, skill: `Parent key: ${mode.name}`,
          prompt: `${tonic} ${mode.name} uses the notes of which major scale?`,
          correct: option(parent, pitchLabel(parent)), candidates: pitchOptions,
          explanation: `${tonic} ${mode.name} is degree ${degree} of its parent major scale, so count down ${degree - 1} scale step(s) from ${tonic}: the parent is ${pitchLabel(parent)} major. Same seven notes, new home.`,
        });
        const characteristic = theory.modeCharacteristics(modeKey).labels;
        if (characteristic.length) {
          const labels = theory.scaleDegreeLabels(theory.SCALES[modeKey]);
          questions.push({
            id: `mode:color:${modeKey}`, skill: `Characteristic tone: ${mode.name}`,
            prompt: `Which scale degree gives ${mode.name} its distinctive color?`,
            correct: option(characteristic[0], characteristic[0]),
            candidates: degreeLabels.map(label => option(label, label)),
            explanation: `${mode.name} spelled against the major scale is ${labels.join(' ')}. The ${characteristic.join(' and ')} is what separates it from the plain ${theory.SCALES[modeKey].family === 'minor' ? 'natural minor' : 'major'} scale.`,
          });
        }
      }
    } else {
      const flats = theory.scalePrefersFlats(s.key, s.scale);
      const chords = theory.diatonicChords(s.key, theory.SCALES[s.scale], false, flats);
      const keyName = `${theory.nameFor(s.key, flats)} ${s.scale === 'major' ? 'major' : 'natural minor'}`;
      const chordOptions = chords.map(chord => option(chord.degree, `${chord.notes[0]} ${chord.name}`));
      const numeralOptions = chords.map(chord => option(chord.degree, chord.roman));
      for (const chord of chords) for (const reverse of [false, true]) {
        questions.push({
          id: `roman:${chord.degree}:${reverse}`, skill: `${keyName}: ${chord.roman}`,
          prompt: reverse ? `In ${keyName}, which Roman numeral represents ${chord.notes[0]} ${chord.name}?` : `In ${keyName}, which chord is ${chord.roman}?`,
          correct: (reverse ? numeralOptions : chordOptions)[chord.degree],
          candidates: reverse ? numeralOptions : chordOptions,
          explanation: `Degree ${chord.degree + 1} of ${keyName} builds ${chord.notes[0]} ${chord.name}: ${chord.notes.join(' · ')}. Its Roman numeral is ${chord.roman}; lowercase denotes minor, and ° denotes diminished.`,
        });
      }
    }
    return questions;
  }

  function start(input, random = Math.random, skills) {
    const config = settings(input);
    const candidates = pool(config).filter(question => !skills || skills.includes(question.skill));
    if (!candidates.length) throw new Error('No questions match these settings. Choose more strings or a wider fret range.');
    const questions = [];
    while (questions.length < 10) {
      const cycle = shuffle(candidates, random);
      if (questions.length && cycle.length > 1 && cycle[0].id === questions.at(-1).id) {
        [cycle[0], cycle[1]] = [cycle[1], cycle[0]];
      }
      for (const question of cycle) {
        questions.push({ ...question, options: question.valid ? [] : choices(question.correct, question.candidates, random) });
        if (questions.length === 10) break;
      }
    }
    return { settings: config, questions, index: 0, results: [], assisted: false, review: false, poolSize: candidates.length };
  }

  function answer(session, value) {
    if (session.index >= session.questions.length || session.results.length > session.index) return session;
    const question = session.questions[session.index];
    const correct = question.valid ? question.valid.includes(String(value)) : question.correct.id === String(value);
    return { ...session, results: [...session.results, { questionId: question.id, skill: question.skill, correct, assisted: session.assisted, answer: String(value) }] };
  }

  function assist(session) {
    return session.results.length > session.index ? session : { ...session, assisted: true };
  }

  function next(session) {
    return session.results.length > session.index
      ? { ...session, index: session.index + 1, assisted: false }
      : session;
  }

  function summary(session) {
    const missed = {};
    for (const result of session.results) if (!result.correct || result.assisted) missed[result.skill] = (missed[result.skill] || 0) + 1;
    return {
      settings: session.settings, total: session.questions.length,
      correct: session.results.filter(result => result.correct && !result.assisted).length,
      assisted: session.results.filter(result => result.assisted).length, missed,
    };
  }

  function retry(session) {
    const questions = session.questions.filter((question, index) => {
      const result = session.results[index];
      return result && (!result.correct || result.assisted);
    });
    if (!questions.length) throw new Error('There are no missed questions to retry.');
    return { ...session, questions, index: 0, results: [], assisted: false, review: true };
  }

  return { defaults, activities, intervals, pitchLabel, settings, pool, start, answer, assist, next, summary, retry };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = QuizEngine;
