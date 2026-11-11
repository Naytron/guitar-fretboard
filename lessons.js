/*
 * Lesson content for the Scales, Chords, Progressions, and Modes pages.
 *
 * Every lesson is a function of the current page state, so examples always
 * name the notes the learner is looking at. Note names, degrees, and chord
 * spellings are computed by the shared theory engine — never typed by hand.
 *
 * Text is expressed as segments: plain strings or { t: 'note' | 'interval' | 'em', v }.
 * The UI turns segments into DOM nodes; no HTML strings are interpolated.
 */
const Lessons = (() => {
  const theory = typeof module !== 'undefined' && module.exports
    ? require('./fretboard.engine.js')
    : {
      STRINGS, SCALES, CHORDS, MODES, MODE_ORDER, MODE_BRIGHTNESS, modeDegree, parentMajorPc,
      scaleDegreeLabels, degreeLabelsFor, modeCharacteristics, modeStepPattern, nameFor, spellChord, spellScale,
      scalePrefersFlats, diatonicChords, noteAt,
    };

  const LEVELS = ['beginner', 'intermediate', 'advanced'];
  const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  const PAGES = ['scales', 'chords', 'progressions', 'modes'];
  const FUNCTIONS = ['Tonic (home)', 'Pre-dominant', 'Tonic substitute', 'Subdominant (away)', 'Dominant (tension)', 'Relative tonic', 'Leading-tone dominant'];
  const MODE_SHORT = { major: 'Ionian', dorian: 'Dorian', phrygian: 'Phrygian', lydian: 'Lydian', mixolydian: 'Mixolydian', natural_minor: 'Aeolian', locrian: 'Locrian' };

  const note = v => ({ t: 'note', v });
  const iv = v => ({ t: 'interval', v });
  const em = v => ({ t: 'em', v });
  const list = (items, map = note) => items.flatMap((item, index) => (index ? [' · ', map(item)] : [map(item)]));
  const chordName = chord => `${chord.notes[0]} ${chord.name}`;
  const spell = (rootPc, steps, labels, flats, rootName) => theory.spellChord(rootPc, { steps, labels }, flats, rootName);

  /* ---- Context: everything a lesson may reference, derived once per render ---- */
  function context(page, state) {
    if (!PAGES.includes(page)) throw new Error(`Unknown lesson page: ${page}`);
    const rootPc = Number(state.rootPc);
    if (!Number.isInteger(rootPc) || rootPc < 0 || rootPc > 11) throw new Error('Lesson context needs a root pitch class 0–11.');
    const scaleKey = state.scaleKey ?? 'major';
    const scale = theory.SCALES[scaleKey];
    if (!scale) throw new Error(`Unknown scale: ${scaleKey}`);
    const flats = typeof state.flats === 'boolean' ? state.flats : theory.scalePrefersFlats(rootPc, scaleKey);
    const rootName = theory.nameFor(rootPc, flats);
    const notes = theory.spellScale(rootPc, scale, flats);
    const degrees = theory.degreeLabelsFor(scale).map(degree => degree.label);
    const frets = scale.steps.map((step, index) => (scale.steps[index + 1] ?? 12) - step);
    const ctx = { page, rootPc, rootName, flats, scaleKey, scale, scaleName: scale.name, notes, degrees, frets, tonicName: notes[0] };

    if (scale.steps.length === 7) {
      ctx.triads = theory.diatonicChords(rootPc, scale, false, flats);
      ctx.sevenths = theory.diatonicChords(rootPc, scale, true, flats);
    }
    if (page === 'chords') {
      const major = theory.CHORDS.major;
      ctx.major = theory.spellChord(rootPc, major, flats, rootName);
      ctx.minor = theory.spellChord(rootPc, theory.CHORDS.minor, flats, rootName);
      ctx.diminished = theory.spellChord(rootPc, theory.CHORDS.diminished, flats, rootName);
      ctx.augmented = theory.spellChord(rootPc, theory.CHORDS.augmented, flats, rootName);
      ctx.maj7 = spell(rootPc, [0, 4, 7, 11], ['R', '3', '5', '7'], flats, rootName);
      ctx.dom7 = theory.spellChord(rootPc, theory.CHORDS.dom7, flats, rootName);
      ctx.min7 = spell(rootPc, [0, 3, 7, 10], ['R', '♭3', '5', '♭7'], flats, rootName);
      ctx.m7b5 = spell(rootPc, [0, 3, 6, 10], ['R', '♭3', '♭5', '♭7'], flats, rootName);
      ctx.sus4 = theory.spellChord(rootPc, theory.CHORDS.sus4, flats, rootName);
      ctx.inversions = [0, 1, 2].map(i => ctx.major.map((_, j) => ctx.major[(i + j) % 3]));
    }
    if (page === 'progressions') {
      const pattern = Array.isArray(state.pattern) && state.pattern.length ? state.pattern.map(Number) : [0, 4, 5, 3];
      if (pattern.some(degree => !Number.isInteger(degree) || degree < 0 || degree > 6)) throw new Error('Progression degrees must be 0–6.');
      ctx.pattern = pattern;
      ctx.sequence = pattern.map(degree => ctx.triads[degree]);
      const two = (rootPc + scale.steps[1]) % 12;
      ctx.secondaryDominant = spell(two, theory.CHORDS.dom7.steps, theory.CHORDS.dom7.labels, flats, notes[1]);
      const flatSevenName = spell(rootPc, [10], ['♭7'], flats, rootName)[0];
      ctx.flatSeven = spell((rootPc + 10) % 12, theory.CHORDS.major.steps, theory.CHORDS.major.labels, flats, flatSevenName);
      ctx.borrowedFour = spell((rootPc + scale.steps[3]) % 12, theory.CHORDS.minor.steps, theory.CHORDS.minor.labels, flats, notes[3]);
      ctx.isMinor = scale.family === 'minor';
    }
    if (page === 'modes') {
      if (!theory.MODES[scaleKey]) throw new Error(`Not a mode: ${scaleKey}`);
      ctx.modeKey = scaleKey;
      ctx.modeName = MODE_SHORT[scaleKey];
      ctx.degree = theory.modeDegree(scaleKey);
      ctx.parentPc = theory.parentMajorPc(rootPc, scaleKey);
      ctx.parentName = theory.nameFor(ctx.parentPc, flats);
      ctx.parentNotes = theory.spellScale(ctx.parentPc, theory.SCALES.major, flats);
      ctx.characteristics = theory.modeCharacteristics(scaleKey);
      ctx.brightness = theory.MODE_BRIGHTNESS.indexOf(scaleKey);
      ctx.pattern = theory.modeStepPattern(scale.steps);
      ctx.characteristicNotes = ctx.characteristics.labels.map(label => notes[theory.scaleDegreeLabels(scale).indexOf(label)]);
      ctx.characteristicLabels = ctx.characteristics.labels.map(label => (/^[♭♯]/.test(label) ? label : `♮${label}`));
      ctx.parallelName = ctx.characteristics.family === 'minor' ? 'natural minor' : 'major';
      /* The chord that best shows off the characteristic tone: a non-tonic chord containing it, major quality preferred. */
      const tone = (rootPc + scale.steps[degrees.indexOf(ctx.characteristics.labels[0])]) % 12;
      const containing = ctx.triads.filter((chord, index) => index > 0 && chord.name !== 'Diminished' &&
        chord.steps.some(step => (chord.root + step) % 12 === tone));
      ctx.characteristicChord = ctx.characteristics.labels.length
        ? (containing.find(chord => chord.name === 'Major') ?? containing[0] ?? null)
        : null;
    }
    return ctx;
  }

  /* Root positions within the first twelve frets, low string first. */
  function rootPositions(rootPc) {
    return theory.STRINGS.map((string, index) => ({ string: 6 - index, fret: (rootPc - string.pc + 12) % 12 }));
  }

  const romanQuiz = ctx => ({
    activity: 'roman',
    key: theory.MODES[ctx.scaleKey] && !['major', 'natural_minor'].includes(ctx.scaleKey) ? ctx.parentPc ?? theory.parentMajorPc(ctx.rootPc, ctx.scaleKey) : ctx.rootPc,
    scale: ['major', 'natural_minor'].includes(ctx.scaleKey) ? ctx.scaleKey : 'major',
  });

  /* ---- Content ---- */
  const LESSONS = {
    scales: {
      beginner: {
        title: 'The ladder: one string, every note',
        summary: 'A scale is a ladder of notes with uneven gaps. Learn the gaps on one string before you learn any shape.',
        mentalModel: {
          name: 'Scale as a ladder',
          body: ctx => [[
            'Picture the notes of ', note(ctx.tonicName), ' ', ctx.scaleName.toLowerCase(),
            ' as rungs on a ladder. Some rungs are two frets apart (a whole step), some are one fret apart (a half step). Climb the ladder on a single string and the rhythm of wide and narrow gaps becomes the sound of the scale.',
          ]],
        },
        sections: [
          {
            heading: 'The rungs',
            body: ctx => [
              ['Your ladder has ', em(String(ctx.notes.length)), ' rungs before it repeats at the octave: ', ...list(ctx.notes), '.'],
              ['Frets between each rung, climbing from ', note(ctx.tonicName), ': ', em(ctx.frets.join(' – ')), '. The last number brings you back to ', note(ctx.tonicName), ' one octave higher.'],
            ],
          },
          {
            heading: 'Climb it on the low E string',
            body: ctx => {
              const start = rootPositions(ctx.rootPc)[0].fret;
              return [[
                'Find ', note(ctx.tonicName), ' on string 6 at fret ', em(String(start)), '. Then move up the string using the gaps above. Say every note name out loud as you play it — the diagram above shows the same notes, so check yourself against the highlighted dots.',
              ]];
            },
          },
          {
            heading: 'Anchor the root',
            body: ctx => [[
              'Before you learn any shape, find every ', note(ctx.tonicName), ' on the neck. Root notes are landmarks; everything else is measured from them. Once the roots feel like home, trace one string, then connect the same notes vertically.',
            ]],
          },
        ],
        quiz: () => ({ activity: 'notes', direction: 'name', notes: 'natural', frets: 5, string: 'all' }),
        quizLabel: 'Practice naming notes in Quiz',
      },
      intermediate: {
        title: 'Degrees, not letters',
        summary: 'Number the notes 1–7 and the same scale shape works in every key. Flats and sharps in a degree name tell you how it differs from major.',
        mentalModel: {
          name: 'House numbers on a street',
          body: ctx => [[
            'Think of the key as a street and each scale degree as a house number. Move to a different street and the houses keep their numbers. Right now house 1 is ', note(ctx.tonicName),
            ctx.notes.length >= 5 ? [' and house 5 is ', note(ctx.notes[4])] : [],
            '. Learn where the numbers live and you can play in any key.',
          ].flat()],
        },
        sections: [
          {
            heading: 'Read the degrees',
            body: ctx => [
              ['In ', note(ctx.tonicName), ' ', ctx.scaleName.toLowerCase(), ' the degrees are: ', ...ctx.notes.flatMap((n, i) => (i ? [' · ', note(n), ' = ', iv(ctx.degrees[i])] : [note(n), ' = ', iv(ctx.degrees[i])])), '.'],
              ['A ', iv('♭3'), ' means “the third, lowered one fret compared with major”. A ', iv('♯4'), ' means raised one fret. Degree names are always measured against the major scale.'],
            ],
          },
          {
            heading: 'Relative keys share notes',
            body: ctx => {
              if (ctx.scaleKey === 'major') {
                return [['Start the same seven notes on degree 6, ', note(ctx.notes[5]), ', and you get ', note(ctx.notes[5]), ' natural minor — the relative minor. Same notes, different home.']];
              }
              if (ctx.scaleKey === 'natural_minor') {
                return [['Start the same seven notes on degree 3, ', note(ctx.notes[2]), ', and you get ', note(ctx.notes[2]), ' major — the relative major. Same notes, different home.']];
              }
              const third = ctx.degrees.find(label => label.endsWith('3'));
              return [[
                'This scale belongs to the ', em(ctx.scale.family), ' family',
                third ? [': its third is ', iv(third), ', which is what your ear hears as ', ctx.scale.family === 'minor' ? 'darker' : 'brighter', '.'] : ['.'],
              ].flat()];
            },
          },
          {
            heading: 'Hear each degree',
            body: ctx => [[
              'Play ', note(ctx.tonicName), ', then one other scale tone, then ', note(ctx.tonicName), ' again. Name the degree you just heard. Degrees are intervals from the root, so this is interval training with a map.',
            ]],
          },
        ],
        quiz: () => ({ activity: 'intervals', frets: 12 }),
        quizLabel: 'Practice intervals in Quiz',
      },
      advanced: {
        title: 'One scale, five windows',
        summary: 'The neck repeats. Learn the octave shapes and the string-crossing rule, and one scale becomes five connected positions.',
        mentalModel: {
          name: 'The neck is a repeating tile',
          body: ctx => [[
            'Every note repeats in a predictable tile across the strings. If you know where ', note(ctx.tonicName),
            ' lives on each string, you already know the frame of every position. Positions are windows onto the same tile, not separate scales.',
          ]],
        },
        sections: [
          {
            heading: 'Root on every string',
            body: ctx => [[
              'Within the first twelve frets, ', note(ctx.tonicName), ' sits at: ',
              ...rootPositions(ctx.rootPc).flatMap((p, i) => (i ? [', ', em(`string ${p.string} fret ${p.fret}`)] : [em(`string ${p.string} fret ${p.fret}`)])),
              '. Build each position outward from one of these roots.',
            ]],
          },
          {
            heading: 'The string-crossing rule',
            body: () => [[
              'Strings 6→5, 5→4, 4→3, and 2→1 are tuned a perfect fourth apart, so an octave shape jumps two strings and two frets higher. The 3→2 crossing is a major third, one fret smaller: anything that crosses the G and B strings shifts up one extra fret. This single exception explains why shapes “bend” in the middle of the neck.',
            ]],
          },
          {
            heading: 'Connect the windows',
            body: ctx => [[
              'Play ', note(ctx.tonicName), ' ', ctx.scaleName.toLowerCase(), ' in one position, then slide to the next root up the string and play it again. Notice which notes are shared at the edges — those shared notes are the doorways between positions. Set the fret range above to 24 to see the full tile repeat.',
            ]],
          },
        ],
        quiz: () => ({ activity: 'notes', direction: 'find', notes: 'chromatic', frets: 12, string: 'all' }),
        quizLabel: 'Practice finding notes in Quiz',
      },
    },

    chords: {
      beginner: {
        title: 'Stack every other note',
        summary: 'A chord is a scale with every other note skipped. Major and minor differ by one note: the third.',
        mentalModel: {
          name: 'Skip a rung',
          body: ctx => [[
            'Take the ', note(ctx.rootName), ' major scale ladder and climb it skipping every other rung: ', ...list(ctx.major),
            '. Three notes, every other rung — that is a triad. Change which rungs you stand on and you change the chord.',
          ]],
        },
        sections: [
          {
            heading: 'Root, third, fifth',
            body: ctx => [
              [note(ctx.rootName), ' major is ', ...list(ctx.major), ' — the ', iv('R'), ', the ', iv('3'), ', and the ', iv('5'), '.'],
              [note(ctx.rootName), ' minor is ', ...list(ctx.minor), '. Only the middle note moved: ', note(ctx.major[1]), ' dropped one fret to ', note(ctx.minor[1]), '. That single fret is the whole difference between happy and sad.'],
            ],
          },
          {
            heading: 'Read the colors',
            body: () => [[
              'On the diagrams above, each color is a job: root, third, fifth, seventh. A chord shape is just a place where you can reach one of each job at once. Learn the jobs and you can build your own shapes anywhere.',
            ]],
          },
          {
            heading: 'Try it',
            body: ctx => [[
              'Find any ', note(ctx.major[0]), ', then the nearest ', note(ctx.major[1]), ' and ', note(ctx.major[2]), ' on neighbouring strings. Play them together. Now swap the ', note(ctx.major[1]), ' for ', note(ctx.minor[1]), ' and listen to the mood change.',
            ]],
          },
        ],
        quiz: ctx => ({ activity: 'chords', key: ctx.rootPc, advanced: false }),
        quizLabel: 'Practice chord tones in Quiz',
      },
      intermediate: {
        title: 'The third decides the mood, the seventh adds the story',
        summary: 'Four seventh chords on the same root. Each one changes the third or the seventh — and the colors on the diagram show you which.',
        mentalModel: {
          name: 'Traffic-light intervals',
          body: () => [[
            'Read a chord like a traffic light: root tells you where you are, third tells you the mood (major or minor), seventh tells you where you are going (resting or pulling). The fifth usually just holds the frame — until it moves, and then everything feels unstable.',
          ]],
        },
        sections: [
          {
            heading: 'Four sevenths, one root',
            body: ctx => [
              [em('Major 7'), ': ', ...list(ctx.maj7), ' — major third, major seventh. Warm, settled.'],
              [em('Dominant 7'), ': ', ...list(ctx.dom7), ' — major third, ', iv('♭7'), '. Restless; it wants to move.'],
              [em('Minor 7'), ': ', ...list(ctx.min7), ' — ', iv('♭3'), ' and ', iv('♭7'), '. Mellow and moody.'],
              [em('Minor 7♭5'), ': ', ...list(ctx.m7b5), ' — the fifth drops too. Tense, searching.'],
            ],
          },
          {
            heading: 'What moved?',
            body: ctx => [[
              'Compare the lists. From major 7 to dominant 7 only ', note(ctx.maj7[3]), ' falls to ', note(ctx.dom7[3]), '. From dominant 7 to minor 7 only ', note(ctx.dom7[1]), ' falls to ', note(ctx.min7[1]),
              '. Every chord quality is one or two notes away from another. Hear the one note that changed, not the whole chord.',
            ]],
          },
          {
            heading: 'Altered fifths',
            body: ctx => [[
              'Lower the fifth of ', note(ctx.rootName), ' major and you get diminished: ', ...list(ctx.diminished), '. Raise it and you get augmented: ', ...list(ctx.augmented),
              '. Neither feels like home — they are the chords that make a progression lean forward.',
            ]],
          },
        ],
        quiz: ctx => ({ activity: 'chords', key: ctx.rootPc, advanced: true }),
        quizLabel: 'Practice sevenths and altered chords in Quiz',
      },
      advanced: {
        title: 'Voice leading and inversions',
        summary: 'The same three notes in a different order are still the same chord. Choose the order that moves the fewest fingers.',
        mentalModel: {
          name: 'Move the fewest fingers',
          body: () => [[
            'Good chord changes are lazy. When two chords share a note, keep it. When they do not, move each voice to the closest available chord tone. Inversions exist so you can be lazy on purpose.',
          ]],
        },
        sections: [
          {
            heading: 'Three inversions',
            body: ctx => [
              [em('Root position'), ': ', ...list(ctx.inversions[0]), '.'],
              [em('First inversion'), ': ', ...list(ctx.inversions[1]), ' — the third is on the bottom. Written as ', em(`${ctx.rootName}/${ctx.inversions[1][0]}`), '.'],
              [em('Second inversion'), ': ', ...list(ctx.inversions[2]), ' — the fifth is on the bottom. Written as ', em(`${ctx.rootName}/${ctx.inversions[2][0]}`), '.'],
            ],
          },
          {
            heading: 'Find them on the neck',
            body: ctx => [[
              'Pick three adjacent strings on the diagram above and look for one ', note(ctx.major[0]), ', one ', note(ctx.major[1]), ', and one ', note(ctx.major[2]),
              ' within a four-fret span. Which note is lowest tells you the inversion. Every major chord has all three inversions on every set of three strings.',
            ]],
          },
          {
            heading: 'Suspensions as motion',
            body: ctx => [[
              'Replace the third with the fourth and you get ', ...list(ctx.sus4), ' — a sus4. Its ', note(ctx.sus4[1]), ' wants to fall back to ', note(ctx.major[1]),
              '. Sus and add chords are not new colors so much as a chord tone caught in the act of moving.',
            ]],
          },
        ],
        quiz: ctx => ({ activity: 'chords', key: ctx.rootPc, advanced: true, frets: 12 }),
        quizLabel: 'Practice chord tones across 12 frets in Quiz',
      },
    },

    progressions: {
      beginner: {
        title: 'Numbers travel, letters stay home',
        summary: 'Roman numerals name chords by scale degree, so one progression works in every key. Capital letters are major, lowercase are minor.',
        mentalModel: {
          name: 'Nashville numbers',
          body: ctx => [[
            'Session players call out chords by number so the song works in any key. In ', note(ctx.rootName), ' ', ctx.scaleName.toLowerCase(), ', “one” is ', note(ctx.triads[0].notes[0]),
            ', “four” is ', note(ctx.triads[3].notes[0]), ', and “five” is ', note(ctx.triads[4].notes[0]), '. Change key and the numbers do not change — only the letters do.',
          ]],
        },
        sections: [
          {
            heading: 'Read the case',
            body: ctx => [
              ['Upper case is major, lower case is minor, and ° marks diminished. In this key: ', ...ctx.triads.flatMap((c, i) => (i ? [' · ', iv(c.roman), ' = ', note(chordName(c))] : [iv(c.roman), ' = ', note(chordName(c))])), '.'],
            ],
          },
          {
            heading: 'Your current progression',
            body: ctx => [[
              ...ctx.sequence.flatMap((c, i) => (i ? [' → ', iv(c.roman)] : [iv(c.roman)])), ' is ',
              ...ctx.sequence.flatMap((c, i) => (i ? [' → ', note(chordName(c))] : [note(chordName(c))])),
              '. Play it slowly and say the numerals, not the letters.',
            ]],
          },
          {
            heading: 'Why every other note',
            body: ctx => [[
              'Each chord is built by stacking every other scale tone. The ', iv(ctx.triads[0].roman), ' chord takes degrees 1, 3, 5: ', ...list(ctx.triads[0].notes),
              '. The ', iv(ctx.triads[4].roman), ' chord takes 5, 7, 2: ', ...list(ctx.triads[4].notes), '. Same recipe, different starting rung.',
            ]],
          },
        ],
        quiz: romanQuiz,
        quizLabel: 'Practice Roman numerals in Quiz',
      },
      intermediate: {
        title: 'Home, away, tension, return',
        summary: 'Chords have jobs. Tonic is home, subdominant is leaving, dominant is the pull back. Progressions are trips.',
        mentalModel: {
          name: 'A trip away from home',
          body: ctx => [[
            'Every progression is a short journey. You leave home (', iv(ctx.triads[0].roman), '), wander somewhere new (', iv(ctx.triads[3].roman), ' or ', iv(ctx.triads[1].roman),
            '), feel the pull of the dominant (', iv(ctx.triads[4].roman), '), and come back. Tension is simply distance from home.',
          ]],
        },
        sections: [
          {
            heading: 'Job titles in this key',
            body: ctx => [[
              ...ctx.triads.flatMap((c, i) => (i ? [' · ', iv(c.roman), ' ', em(FUNCTIONS[i])] : [iv(c.roman), ' ', em(FUNCTIONS[i])])), '.',
            ]],
          },
          {
            heading: 'Your progression as a trip',
            body: ctx => [[
              ...ctx.sequence.flatMap((c, i) => {
                const label = FUNCTIONS[c.degree].split(' ')[0];
                return i ? [' → ', note(chordName(c)), ' (', em(label), ')'] : [note(chordName(c)), ' (', em(label), ')'];
              }),
              '. Notice where the tension lands and where it releases.',
            ]],
          },
          {
            heading: 'The relative doorway',
            body: ctx => [[
              iv(ctx.triads[5].roman), ' (', note(chordName(ctx.triads[5])), ') shares two notes with ', iv(ctx.triads[0].roman), ' (', note(chordName(ctx.triads[0])),
              '), so it can stand in for home with a different mood. Swapping them is the oldest trick in songwriting.',
            ]],
          },
        ],
        quiz: romanQuiz,
        quizLabel: 'Practice Roman numerals in Quiz',
      },
      advanced: {
        title: 'Borrow and substitute',
        summary: 'Once the seven diatonic chords feel like home, borrow from the parallel key or aim a dominant at a chord other than I.',
        mentalModel: {
          name: 'A cousin from the parallel key',
          body: ctx => [[
            note(ctx.rootName), ' major and ', note(ctx.rootName), ' minor share a root but not a mood. Borrowing a chord from the parallel key is like inviting a cousin to dinner — familiar enough to fit, different enough to be noticed.',
          ]],
        },
        sections: [
          {
            heading: 'Secondary dominants',
            body: ctx => [[
              'A dominant seventh can point at any chord, not just ', iv(ctx.triads[0].roman), '. ', note(`${ctx.secondaryDominant[0]}7`), ' (', ...list(ctx.secondaryDominant), ') is ', iv('V/V'),
              ': the five of five. Play it before ', note(chordName(ctx.triads[4])), ' and the arrival feels earned.',
            ]],
          },
          {
            heading: 'Borrowed chords',
            body: ctx => [
              [iv('♭VII'), ' is ', note(`${ctx.flatSeven[0]} Major`), ' (', ...list(ctx.flatSeven), ') — the rock cadence ', iv('♭VII → I'), ' borrows it from ', note(ctx.rootName), ' Mixolydian.'],
              [iv('iv'), ' is ', note(`${ctx.borrowedFour[0]} Minor`), ' (', ...list(ctx.borrowedFour), ') — the minor four, borrowed from ', note(ctx.rootName), ' minor, turns a plain ', iv('IV → I'), ' into a sigh.'],
            ],
          },
          {
            heading: 'Sevenths in this key',
            body: ctx => [[
              'With sevenths the numerals sharpen: ', ...ctx.sevenths.flatMap((c, i) => (i ? [' · ', iv(c.roman)] : [iv(c.roman)])),
              '. Only ', iv(ctx.sevenths.find(c => c.name === 'Dominant 7')?.roman ?? ctx.sevenths[4].roman), ' is a dominant seventh — which is why it points home so clearly.',
            ]],
          },
        ],
        quiz: ctx => ({ ...romanQuiz(ctx), advanced: true }),
        quizLabel: 'Practice advanced numerals in Quiz',
      },
    },

    modes: {
      beginner: {
        title: 'Same notes, new home',
        summary: 'A mode is a major scale that starts somewhere else. Change which note is home and the same seven notes change color.',
        mentalModel: {
          name: 'Rotate the clock face',
          body: ctx => [[
            'Imagine the seven notes of ', note(ctx.parentName), ' major as marks on a clock face. Rotate the face so ', note(ctx.tonicName),
            ' sits at twelve o’clock and you are looking at ', note(ctx.tonicName), ' ', ctx.modeName, '. The marks never moved — only your starting point did.',
          ]],
        },
        sections: [
          {
            heading: 'Where it comes from',
            body: ctx => [
              [note(ctx.tonicName), ' ', ctx.modeName, ' is degree ', em(String(ctx.degree)), ' of ', note(ctx.parentName), ' major. Parent notes: ', ...list(ctx.parentNotes), '.'],
              ['Start those notes on ', note(ctx.tonicName), ': ', ...list(ctx.notes), '. Pattern: ', em(ctx.pattern.join(' ')), '.'],
            ],
          },
          {
            heading: 'The order',
            body: () => [[
              'The seven modes are numbered by the degree they start on: Ionian (1), Dorian (2), Phrygian (3), Lydian (4), Mixolydian (5), Aeolian (6), Locrian (7). Ionian is the major scale and Aeolian is natural minor, so you already know two of them.',
            ]],
          },
          {
            heading: 'Make it sound like a mode',
            body: ctx => [[
              'Play the notes above, but keep returning to ', note(ctx.tonicName), ' and let it ring. If your ear drifts to ', note(ctx.parentName), ' you are hearing the parent scale, not the mode. The tonic has to win.',
            ]],
          },
        ],
        quiz: ctx => ({ activity: 'modes', key: ctx.rootPc }),
        quizLabel: 'Practice mode order and patterns in Quiz',
      },
      intermediate: {
        title: 'The one note that changes everything',
        summary: 'Each mode is major or minor with one or two notes altered. Find that note and you have found the mode’s color.',
        mentalModel: {
          name: 'A brightness dial',
          body: ctx => [[
            'Line the modes up from brightest to darkest: ', em(theory.MODE_BRIGHTNESS.map(key => MODE_SHORT[key]).join(' → ')),
            '. Each step down the dial lowers one more degree. ', ctx.modeName, ' sits at position ', em(String(ctx.brightness + 1)), ' of 7.',
          ]],
        },
        sections: [
          {
            heading: 'Compared with the parallel scale',
            body: ctx => (ctx.characteristics.labels.length
              ? [[
                note(ctx.tonicName), ' ', ctx.modeName, ' is ', note(ctx.tonicName), ' ', ctx.parallelName, ' with a ',
                ...ctx.characteristicLabels.flatMap((label, i) => (i ? [' and a ', iv(label)] : [iv(label)])), ': the note',
                ctx.characteristics.labels.length > 1 ? 's ' : ' ', ...list(ctx.characteristicNotes), '. That is the characteristic tone — lean on it.',
              ]]
              : [[
                note(ctx.tonicName), ' ', ctx.modeName, ' is the reference ', ctx.parallelName, ' scale itself, so every other ', ctx.parallelName, '-family mode is described by how it differs from this one.',
              ]]),
          },
          {
            heading: 'Degrees of this mode',
            body: ctx => [[
              ...ctx.notes.flatMap((n, i) => (i ? [' · ', note(n), ' ', iv(ctx.degrees[i])] : [note(n), ' ', iv(ctx.degrees[i])])), '.',
            ]],
          },
          {
            heading: 'Hear the color',
            body: ctx => [[
              'Play ', note(ctx.tonicName), ', then ', ctx.characteristicNotes.length ? ['the characteristic tone ', note(ctx.characteristicNotes[0])] : ['the third ', note(ctx.notes[2])],
              ', then ', note(ctx.tonicName), ' again. That two-note move is the mode in miniature.',
            ].flat()],
          },
        ],
        quiz: ctx => ({ activity: 'modes', key: ctx.rootPc }),
        quizLabel: 'Practice parent keys and characteristic tones in Quiz',
      },
      advanced: {
        title: 'Parallel thinking and modal chords',
        summary: 'Stop thinking “it is just the parent scale”. Think in parallel from the tonic, and build chords that make the mode unmistakable.',
        mentalModel: {
          name: 'A lens, not a ladder',
          body: ctx => [[
            'Relative thinking (', note(ctx.tonicName), ' ', ctx.modeName, ' = ', note(ctx.parentName), ' major) is a shortcut for your fingers. Parallel thinking (', note(ctx.tonicName), ' ', ctx.modeName, ' = ', note(ctx.tonicName), ' ', ctx.parallelName,
            ' with altered degrees) is a lens for your ears. Use the first to find notes, the second to make music.',
          ]],
        },
        sections: [
          {
            heading: 'The tonic chord',
            body: ctx => [[
              'Stack thirds on ', note(ctx.tonicName), ' inside the mode: ', note(chordName(ctx.triads[0])), ' (', ...list(ctx.triads[0].notes), '), or with the seventh ', note(chordName(ctx.sevenths[0])),
              ' (', ...list(ctx.sevenths[0].notes), '). Sit on this chord; it is home in the mode.',
            ]],
          },
          {
            heading: 'The characteristic chord',
            body: ctx => {
              const label = ctx.characteristicLabels[0];
              const chord = ctx.characteristicChord;
              if (!label || !chord) {
                return [['Ionian and Aeolian are the reference scales, so their classic vamps are the plain ', iv(ctx.triads[0].roman), ' → ', iv(ctx.triads[3].roman), ' → ', iv(ctx.triads[4].roman), ': ', ...list([ctx.triads[0], ctx.triads[3], ctx.triads[4]].map(chordName)), '.']];
              }
              return [[
                'The characteristic tone ', iv(label), ' (', note(ctx.characteristicNotes[0]), ') lives inside ', iv(chord.roman), ', ', note(chordName(chord)), ' (', ...list(chord.notes), '). Alternate ', note(chordName(ctx.triads[0])), ' with ', note(chordName(chord)),
                ' and the mode announces itself. For the ', iv(label), ' to be heard, a chord that contains it has to be heard.',
              ]];
            },
          },
          {
            heading: 'Numerals in the mode',
            body: ctx => [[
              'Relative to ', note(ctx.tonicName), ': ', ...ctx.triads.flatMap((c, i) => (i ? [' · ', iv(c.roman)] : [iv(c.roman)])),
              '. These are the same seven chords as ', note(ctx.parentName), ' major, renumbered from degree ', em(String(ctx.degree)), ' — which is why the quiz link below practises them in the parent key.',
            ]],
          },
        ],
        quiz: ctx => ({ ...romanQuiz(ctx), advanced: true }),
        quizLabel: 'Practice the parent key’s numerals in Quiz',
      },
    },
  };

  /* ---- Resolve a lesson into plain data the UI can render ---- */
  function resolve(page, level, ctx) {
    const lesson = LESSONS[page]?.[level];
    if (!lesson) throw new Error(`No ${level} lesson for ${page}`);
    const quiz = lesson.quiz(ctx);
    return {
      page,
      level,
      levelLabel: LEVEL_LABELS[level],
      title: lesson.title,
      summary: lesson.summary,
      mentalModel: { name: lesson.mentalModel.name, paragraphs: lesson.mentalModel.body(ctx) },
      sections: lesson.sections.map(section => ({ heading: section.heading, paragraphs: section.body(ctx) })),
      quiz: { label: lesson.quizLabel, settings: quiz, href: quizUrl(quiz) },
    };
  }

  function quizUrl(settings) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(settings)) params.set(key, String(value));
    return `quiz.html?${params.toString()}`;
  }

  return { LEVELS, LEVEL_LABELS, PAGES, LESSONS, context, resolve, quizUrl };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Lessons;
