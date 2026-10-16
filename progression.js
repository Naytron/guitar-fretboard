/*
 * Diatonic progression UI — renders each scale-degree triad as a full-neck map.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    root: $('root'),
    scale: $('scale'),
    frets: $('frets'),
    fretsOut: $('frets-out'),
    spelling: $('spelling'),
    labelMode: $('label-mode'),
    title: $('progression-title'),
    notes: $('progression-notes'),
    progression: $('progression'),
    badge: $('selftest'),
  };

  function populate() {
    const rootNames = ['C', 'C♯ / D♭', 'D', 'D♯ / E♭', 'E', 'F', 'F♯ / G♭', 'G', 'G♯ / A♭', 'A', 'A♯ / B♭', 'B'];
    rootNames.forEach((label, pc) => els.root.add(new Option(label, String(pc))));
    els.root.value = '7';
    els.scale.value = 'major';
    els.frets.value = '12';
  }

  function useFlatsFor(rootPc, family) {
    const mode = els.spelling.value;
    if (mode === 'sharps') return false;
    if (mode === 'flats') return true;
    return keyPrefersFlats(rootPc, family);
  }

  function cell(cls, text) {
    const c = document.createElement('div');
    c.className = cls;
    if (text) c.textContent = text;
    return c;
  }

  function renderChord(chord, fretCount, flats, labelMode) {
    const intervals = chordIntervals(chord.rootPc, chord);
    const card = document.createElement('article');
    card.className = 'chord-card progression-card';

    const head = document.createElement('header');
    head.className = 'chord-head progression-head';

    const heading = document.createElement('h3');
    heading.className = 'chord-name';
    const numeral = document.createElement('span');
    numeral.className = 'progression-numeral';
    numeral.textContent = chord.romanNumeral;
    const symbol = document.createElement('span');
    symbol.className = 'chord-symbol';
    const rootName = nameFor(chord.rootPc, flats);
    symbol.textContent = `${rootName}${chord.qualitySymbol}`;
    const fullName = document.createElement('span');
    fullName.className = 'chord-fullname';
    fullName.textContent = `${rootName} ${chord.quality}`;
    heading.append(numeral, symbol, fullName);
    head.appendChild(heading);

    const sub = document.createElement('p');
    sub.className = 'chord-sub';
    const notes = document.createElement('span');
    notes.className = 'chord-notes';
    notes.textContent = chord.notes.map((pc) => nameFor(pc, flats)).join(' · ');
    const formula = document.createElement('span');
    formula.className = 'chord-formula';
    formula.textContent = chord.labels.join(' ');
    sub.append(notes, formula);
    head.appendChild(sub);
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'fb-grid chord-grid';
    grid.style.gridTemplateColumns = `var(--label-col) repeat(${fretCount + 1}, 1fr)`;

    grid.appendChild(cell('fb-corner', ''));
    for (let fret = 0; fret <= fretCount; fret++) {
      const number = cell('fb-fretnum', String(fret));
      if (fret === 0) number.classList.add('open-col');
      if (fret === 1) number.classList.add('nut');
      if (DOUBLE_MARKERS.has(fret)) number.classList.add('marker', 'marker-2');
      else if (SINGLE_MARKERS.has(fret)) number.classList.add('marker');
      grid.appendChild(number);
    }

    for (let stringIndex = STRINGS.length - 1; stringIndex >= 0; stringIndex--) {
      const string = STRINGS[stringIndex];
      grid.appendChild(cell('fb-string-label', string.label));
      for (let fret = 0; fret <= fretCount; fret++) {
        const position = document.createElement('div');
        position.className = 'fb-cell';
        if (fret === 0) position.classList.add('open-col');
        if (fret === 1) position.classList.add('nut');

        const pc = noteAt(string.pc, fret);
        if (intervals.has(pc)) {
          const label = intervals.get(pc);
          const name = nameFor(pc, flats);
          const dot = document.createElement('span');
          dot.className = `note cat-${intervalCategory(label)}`;
          if (label === 'R') dot.classList.add('is-root');
          if (labelMode === 'intervals') {
            dot.textContent = label;
          } else if (labelMode === 'both') {
            dot.classList.add('dot-both');
            dot.append(name, document.createElement('small'));
            dot.lastChild.textContent = label;
          } else {
            dot.textContent = name;
          }
          dot.title = `${name} — ${label}`;
          position.appendChild(dot);
        }
        grid.appendChild(position);
      }
    }

    card.appendChild(grid);
    return card;
  }

  function render() {
    const rootPc = parseInt(els.root.value, 10);
    const scaleKey = els.scale.value;
    const scale = SCALES[scaleKey];
    const fretCount = parseInt(els.frets.value, 10);
    const flats = useFlatsFor(rootPc, scale.family);
    const triads = diatonicTriads(rootPc, scaleKey);
    const scaleNotes = scale.steps.map((step) => nameFor((rootPc + step) % 12, flats));

    els.fretsOut.textContent = String(fretCount);
    els.title.textContent = `${nameFor(rootPc, flats)} ${scale.name} progression`;
    els.notes.textContent = `Scale notes: ${scaleNotes.join(' · ')}`;

    const row = document.createElement('div');
    row.className = 'chord-row progression-row';
    triads.forEach((chord) => row.appendChild(renderChord(chord, fretCount, flats, els.labelMode.value)));
    els.progression.replaceChildren(row);
  }

  function wire() {
    ['change', 'input'].forEach((eventName) => {
      els.root.addEventListener(eventName, render);
      els.scale.addEventListener(eventName, render);
      els.frets.addEventListener(eventName, render);
      els.spelling.addEventListener(eventName, render);
      els.labelMode.addEventListener(eventName, render);
    });
  }

  function showSelfTest() {
    const { passed, results } = runDiatonicSelfTest();
    els.badge.textContent = passed
      ? '✓ diatonic progression self-test passed'
      : '✗ self-test failed — see console';
    els.badge.classList.add(passed ? 'ok' : 'fail');
    els.badge.title = results.map((result) => `${result.ok ? '✓' : '✗'} ${result.label}`).join('\n');
  }

  document.addEventListener('DOMContentLoaded', () => {
    populate();
    wire();
    render();
    showSelfTest();
  });
})();
