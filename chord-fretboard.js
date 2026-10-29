/* Shared interval-colored neck for chord and progression diagrams. */
function renderChordFretboard(rootPc, chord, notes, fretCount, labelMode) {
  const intervals = chordIntervals(rootPc, chord);
  const names = new Map(chord.steps.map((step, index) => [(rootPc + step) % 12, notes[index]]));
  const grid = document.createElement('div');
  grid.className = 'fb-grid chord-grid';
  grid.style.setProperty('--fret-count', String(fretCount + 1));
  grid.style.gridTemplateColumns = `var(--label-col) repeat(${fretCount + 1}, 1fr)`;

  function cell(className, text = '') {
    const element = document.createElement('div');
    element.className = className;
    element.textContent = text;
    return element;
  }

  grid.appendChild(cell('fb-corner'));
  for (let fret = 0; fret <= fretCount; fret++) {
    const header = cell('fb-fretnum', String(fret));
    if (fret === 0) header.classList.add('open-col');
    if (fret === 1) header.classList.add('nut');
    if (DOUBLE_MARKERS.has(fret)) header.classList.add('marker', 'marker-2');
    else if (SINGLE_MARKERS.has(fret)) header.classList.add('marker');
    grid.appendChild(header);
  }

  for (let index = STRINGS.length - 1; index >= 0; index--) {
    const string = STRINGS[index];
    grid.appendChild(cell('fb-string-label', string.label));
    for (let fret = 0; fret <= fretCount; fret++) {
      const position = cell('fb-cell');
      if (fret === 0) position.classList.add('open-col');
      if (fret === 1) position.classList.add('nut');
      const pc = noteAt(string.pc, fret);
      if (intervals.has(pc)) {
        const interval = intervals.get(pc);
        const name = names.get(pc);
        const dot = document.createElement('span');
        dot.className = `note cat-${intervalCategory(interval)}`;
        if (interval === 'R') dot.classList.add('is-root');
        dot.textContent = labelMode === 'intervals' ? interval : name;
        if (labelMode === 'both') {
          dot.classList.add('dot-both');
          const label = document.createElement('small');
          label.textContent = interval;
          dot.appendChild(label);
        }
        dot.title = `${name} — ${interval}`;
        dot.setAttribute('aria-label', `String ${6 - index}, fret ${fret}: ${name}, ${interval}`);
        position.appendChild(dot);
      }
      grid.appendChild(position);
    }
  }
  return grid;
}
