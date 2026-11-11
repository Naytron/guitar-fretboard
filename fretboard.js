/*
 * Fretboard UI — reads the controls and renders an interactive neck using the
 * pure note engine in fretboard.engine.js. No external libraries.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const modesPage = document.body.dataset.view === 'modes';

  const els = {
    root: $('root'),
    scale: $('scale'),
    frets: $('frets'),
    fretsOut: $('frets-out'),
    spelling: $('spelling'),
    showAll: $('show-all'),
    board: $('fretboard'),
    scaleNotes: $('scale-notes'),
    scaleTitle: $('scale-title'),
    badge: $('selftest'),
  };

  /* ---- Populate controls ---- */
  function populate() {
    // 12 roots, shown with both spellings where relevant
    const rootNames = ['C', 'C♯ / D♭', 'D', 'D♯ / E♭', 'E', 'F', 'F♯ / G♭', 'G', 'G♯ / A♭', 'A', 'A♯ / B♭', 'B'];
    rootNames.forEach((label, pc) => {
      els.root.add(new Option(label, String(pc)));
    });
    Object.entries(modesPage ? MODES : SCALES).forEach(([key, def]) => {
      els.scale.add(new Option(def.name, key));
    });
    // Defaults reproduce the G Major Scale diagram
    els.root.value = '7';        // G
    els.scale.value = 'major';
    els.frets.value = '15';
  }

  function useFlatsFor(rootPc) {
    const mode = els.spelling.value;
    if (mode === 'sharps') return false;
    if (mode === 'flats') return true;
    return scalePrefersFlats(rootPc, els.scale.value);
  }

  /* ---- Render ---- */
  function render() {
    const rootPc = parseInt(els.root.value, 10);
    const scaleKey = els.scale.value;
    const def = SCALES[scaleKey];
    const fretCount = parseInt(els.frets.value, 10);
    const showAll = els.showAll.checked;
    const flats = useFlatsFor(rootPc);
    const inScale = scaleSet(rootPc, def.steps);

    els.fretsOut.textContent = String(fretCount);

    // Readout of the selected scale's note names (accuracy at a glance)
    const spelled = spellScale(rootPc, def, flats);
    const noteNames = new Map(def.steps.map((step, index) => [(rootPc + step) % 12, spelled[index]]));
    els.scaleTitle.textContent = `${nameFor(rootPc, flats)} ${modesPage ? MODES[scaleKey].name : def.name}`;
    els.scaleNotes.textContent = spelled.join('  ·  ');
    if (modesPage) {
      const pattern = modeStepPattern(def.steps);
      $('mode-pattern').textContent = pattern.join(' ');
      const steps = pattern.map((symbol, index) => {
        const item = document.createElement('li');
        const number = document.createElement('span');
        number.className = 'mode-step-number';
        number.textContent = `Step ${index + 1}`;
        const from = document.createElement('strong');
        from.textContent = spelled[index];
        const distance = document.createElement('span');
        distance.className = 'mode-distance';
        distance.textContent = `${symbol} — ${symbol === 'W' ? 'Whole step (2 frets)' : 'Half step (1 fret)'}`;
        const to = document.createElement('strong');
        to.textContent = spelled[(index + 1) % spelled.length];
        const arrow = document.createElement('span');
        arrow.textContent = '→';
        arrow.setAttribute('aria-hidden', 'true');
        const transition = document.createElement('div');
        transition.className = 'mode-transition';
        transition.append(from, arrow, to);
        item.append(number, transition, distance);
        return item;
      });
      $('mode-steps').replaceChildren(...steps);
      renderModeStrip(rootPc, scaleKey, flats);
    }

    if (typeof LessonsUI !== 'undefined') {
      LessonsUI.update(modesPage ? 'modes' : 'scales', { rootPc, scaleKey, flats });
    }

    // Grid: 1 label column + (fretCount + 1) fret columns (0..N)
    const grid = document.createElement('div');
    grid.className = 'fb-grid';
    grid.style.setProperty('--fret-count', String(fretCount + 1));
    grid.style.gridTemplateColumns = `var(--label-col) repeat(${fretCount + 1}, 1fr)`;

    // Header row: blank label + fret numbers with inlay markers
    grid.appendChild(cell('fb-corner', ''));
    for (let f = 0; f <= fretCount; f++) {
      const c = cell('fb-fretnum', String(f));
      if (f === 0) c.classList.add('open-col');
      if (f === 1) c.classList.add('nut');
      if (DOUBLE_MARKERS.has(f)) c.classList.add('marker', 'marker-2');
      else if (SINGLE_MARKERS.has(f)) c.classList.add('marker');
      grid.appendChild(c);
    }

    // String rows, high e (1st) on top → low E (6th) on bottom
    for (let i = STRINGS.length - 1; i >= 0; i--) {
      const str = STRINGS[i];
      grid.appendChild(cell('fb-string-label', str.label));
      for (let f = 0; f <= fretCount; f++) {
        const c = document.createElement('div');
        c.className = 'fb-cell';
        if (f === 0) c.classList.add('open-col');
        if (f === 1) c.classList.add('nut');
        const pc = noteAt(str.pc, f);
        const isIn = inScale.has(pc);
        const isRoot = pc === rootPc;
        if (isIn || showAll) {
          const dot = document.createElement('span');
          dot.className = 'note';
          if (isIn && isRoot) dot.classList.add('root');
          else if (isIn) dot.classList.add('in-scale');
          else dot.classList.add('ghost');
          dot.textContent = isIn ? noteNames.get(pc) : nameFor(pc, flats);
          c.appendChild(dot);
        }
        grid.appendChild(c);
      }
    }

    els.board.replaceChildren(grid);
  }

  function cell(cls, text) {
    const c = document.createElement('div');
    c.className = cls;
    if (text) c.textContent = text;
    return c;
  }

  /* ---- Mode order strip: Ionian → Locrian, degree, pattern, and parent key ---- */
  function renderModeStrip(rootPc, modeKey, flats) {
    const strip = $('mode-strip');
    const relation = $('mode-relation');
    if (!strip || !relation) return;
    const parentPc = parentMajorPc(rootPc, modeKey);
    const parentName = nameFor(parentPc, flats);
    const tonicName = spellScale(rootPc, SCALES[modeKey], flats)[0];
    const parentNotes = spellScale(parentPc, SCALES.major, flats);
    relation.replaceChildren();
    const tonic = document.createElement('strong');
    tonic.textContent = `${tonicName} ${MODES[modeKey].name}`;
    const parent = document.createElement('strong');
    parent.textContent = `${parentName} major`;
    relation.append(tonic, ` is degree ${modeDegree(modeKey)} of `, parent, ' — same seven notes, new home.');

    const buttons = MODE_ORDER.map((key, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mode-chip';
      button.value = key;
      button.setAttribute('aria-pressed', String(key === modeKey));
      button.tabIndex = key === modeKey ? 0 : -1;
      const characteristic = modeCharacteristics(key).labels;
      const degree = cell('mode-chip-degree', String(index + 1));
      const name = cell('mode-chip-name', MODES[key].name);
      const tonicNote = cell('mode-chip-tonic', `${parentNotes[index]} tonic`);
      const pattern = cell('mode-chip-pattern', modeStepPattern(SCALES[key].steps).join(' '));
      const color = cell('mode-chip-color', characteristic.length ? characteristic.join(' ') : SCALES[key].family === 'minor' ? 'minor reference' : 'major reference');
      button.append(degree, name, tonicNote, pattern, color);
      button.setAttribute('aria-label', `Degree ${index + 1}: ${parentNotes[index]} ${MODES[key].name}`);
      button.addEventListener('click', () => {
        els.scale.value = key;
        els.root.value = String((parentPc + SCALES.major.steps[index]) % 12);
        render();
        strip.querySelector('[aria-pressed="true"]')?.focus();
      });
      return button;
    });
    strip.replaceChildren(...buttons);
  }

  function onStripKey(event) {
    const buttons = [...event.currentTarget.querySelectorAll('.mode-chip')];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    const moves = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: buttons.length - 1 - index };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = buttons[(index + moves[event.key] + buttons.length) % buttons.length];
    buttons.forEach((button) => { button.tabIndex = button === next ? 0 : -1; });
    next.focus();
  }

  /* ---- Wire up ---- */
  function wire() {
    ['change', 'input'].forEach((ev) => {
      els.root.addEventListener(ev, render);
      els.scale.addEventListener(ev, render);
      els.frets.addEventListener(ev, render);
      els.spelling.addEventListener(ev, render);
      els.showAll.addEventListener(ev, render);
    });
    $('mode-strip')?.addEventListener('keydown', onStripKey);
  }

  function showSelfTest() {
    const { passed, results } = runSelfTest();
    els.badge.textContent = passed
      ? '✓ note-accuracy self-test passed'
      : '✗ self-test failed — see console';
    els.badge.classList.add(passed ? 'ok' : 'fail');
    els.badge.title = results.map((r) => `${r.ok ? '✓' : '✗'} ${r.label}`).join('\n');
  }

  document.addEventListener('DOMContentLoaded', () => {
    populate();
    wire();
    render();
    showSelfTest();
  });
})();
