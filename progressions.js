/*
 * Diatonic chord and progression view; all theory comes from the shared note engine.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    root: $('root'),
    scale: $('scale'),
    spelling: $('spelling'),
    chordType: $('chord-type'),
    progression: $('progression'),
    frets: $('frets'),
    fretsOut: $('frets-out'),
    labelMode: $('label-mode'),
    keySummary: $('key-summary'),
    chords: $('diatonic-chords'),
    progressionMap: $('progression-map'),
    progressionCaption: $('progression-caption'),
    badge: $('selftest'),
  };

  const roots = ['C', 'C♯ / D♭', 'D', 'D♯ / E♭', 'E', 'F', 'F♯ / G♭', 'G', 'G♯ / A♭', 'A', 'A♯ / B♭', 'B'];
  const progressionSteps = () => els.progression.value.split(',').map((degree) => Number(degree) - 1);

  function preferFlats(rootPc, scale) {
    if (els.spelling.value === 'flats') return true;
    if (els.spelling.value === 'sharps') return false;
    return keyPrefersFlats(rootPc, scale.family);
  }

  function render() {
    const rootPc = Number(els.root.value);
    const scale = SCALES[els.scale.value];
    const flats = preferFlats(rootPc, scale);
    const chords = diatonicChords(rootPc, scale, els.chordType.value === 'sevenths', flats);
    const fretCount = Number(els.frets.value);
    els.fretsOut.textContent = String(fretCount);
    els.keySummary.textContent = `${nameFor(rootPc, flats)} ${scale.name}`;

    const chordCards = chords.map((chord) => {
      const card = document.createElement('article');
      card.className = 'diatonic-card';
      const heading = document.createElement('h3');
      heading.className = 'diatonic-numeral';
      heading.textContent = chord.roman;
      const name = document.createElement('p');
      name.className = 'diatonic-name';
      name.textContent = `${chord.notes[0]} ${chord.name}`;
      const notes = document.createElement('p');
      notes.className = 'diatonic-notes';
      notes.textContent = chord.notes.join(' · ');
      card.append(heading, name, notes);
      return card;
    });
    els.chords.replaceChildren(...chordCards);

    const sequence = progressionSteps().map((degree) => chords[degree]);
    els.progressionCaption.textContent = sequence.map((chord) => chord.roman).join('  →  ');
    const progressionCards = sequence.map((chord, index) => {
      const item = document.createElement('li');
      item.className = 'progression-card';
      const position = document.createElement('span');
      position.className = 'progression-position';
      position.textContent = `CHORD ${index + 1}`;
      const numeral = document.createElement('strong');
      numeral.className = 'progression-numeral';
      numeral.textContent = chord.roman;
      const name = document.createElement('span');
      name.className = 'progression-name';
      name.textContent = `${chord.notes[0]} ${chord.name}`;
      const notes = document.createElement('span');
      notes.className = 'progression-notes';
      notes.textContent = chord.notes.join(' · ');
      item.append(position, numeral, name, notes);
      const neck = document.createElement('section');
      neck.className = 'progression-fretboard';
      neck.tabIndex = 0;
      neck.setAttribute('aria-label', `Chord ${index + 1}: ${chord.roman}, ${chord.notes[0]} ${chord.name} fretboard`);
      neck.appendChild(renderChordFretboard(chord.root, chord, chord.notes, fretCount, els.labelMode.value));
      item.appendChild(neck);
      return item;
    });
    els.progressionMap.replaceChildren(...progressionCards);
  }

  function populate() {
    roots.forEach((label, pitchClass) => els.root.add(new Option(label, String(pitchClass))));
    Object.entries(SCALES)
      .filter(([, scale]) => scale.steps.length === 7)
      .forEach(([key, scale]) => els.scale.add(new Option(scale.name, key)));
    els.root.value = '7';
    els.scale.value = 'major';
  }

  function showSelfTest() {
    const { passed } = runChordSelfTest();
    els.badge.textContent = passed
      ? '✓ chord-accuracy self-test passed'
      : '✗ self-test failed — see console';
    els.badge.classList.add(passed ? 'ok' : 'fail');
  }

  document.addEventListener('DOMContentLoaded', () => {
    populate();
    [els.root, els.scale, els.spelling, els.chordType, els.progression, els.frets, els.labelMode].forEach((control) => {
      control.addEventListener('change', render);
    });
    els.frets.addEventListener('input', render);
    render();
    showSelfTest();
  });
})();
