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
    position: $('position'),
    compare: $('compare-major'),
    labelMode: $('label-mode'),
    board: $('fretboard'),
    scaleDegrees: $('scale-degrees'),
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
    const window = positionWindow(rootPc, els.position?.value, fretCount);
    const flats = useFlatsFor(rootPc);
    const inScale = scaleSet(rootPc, def.steps);
    const compare = Boolean(els.compare?.checked);
    const inMajor = compare ? scaleSet(rootPc, SCALES.major.steps) : null;
    const labelMode = els.labelMode.value;
    const showDegrees = labelMode !== 'notes';
    const degrees = new Map(
      [...degreeLabelsFor(SCALES.chromatic), ...degreeLabelsFor(def)]
        .map((degree) => [(rootPc + degree.step) % 12, degree])
    );
    document.querySelectorAll('.degree-key').forEach((key) => { key.hidden = !showDegrees; });
    if (modesPage) renderComparison(rootPc, scaleKey, flats, compare);

    els.fretsOut.textContent = String(fretCount);

    // Readout of the selected scale's note names (accuracy at a glance)
    const spelled = spellScale(rootPc, def, flats);
    const noteNames = new Map(def.steps.map((step, index) => [(rootPc + step) % 12, spelled[index]]));
    els.scaleTitle.textContent = `${nameFor(rootPc, flats)} ${modesPage ? MODES[scaleKey].name : def.name}`;
    els.scaleNotes.textContent = spelled.join('  ·  ');
    if (els.scaleDegrees) {
      els.scaleDegrees.hidden = !showDegrees;
      els.scaleDegrees.replaceChildren(...degreeLabelsFor(def).map((degree) => {
        const chip = document.createElement('span');
        chip.textContent = degree.label;
        if (degree.altered) chip.className = `degree-${degree.direction}`;
        return chip;
      }));
    }
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
    grid.className = 'fb-grid scale-grid';
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
        const inParallel = compare && inMajor.has(pc);
        if (isIn || showAll || inParallel) {
          const dot = document.createElement('span');
          dot.className = 'note';
          if (window && (f < window.start || f > window.end)) dot.classList.add('out-of-position');
          if (isIn && isRoot) dot.classList.add('root');
          else if (isIn) dot.classList.add('in-scale');
          else if (inParallel) dot.classList.add('ghost', 'parallel');
          else dot.classList.add('ghost');
          if (compare && isIn && !isRoot && !inMajor.has(pc)) dot.classList.add('altered');
          const degree = degrees.get(pc);
          const name = isIn ? noteNames.get(pc) : nameFor(pc, flats);
          dot.textContent = labelMode === 'intervals' ? degree.label : name;
          if (showDegrees && isIn && degree.altered) {
            dot.classList.add(`degree-${degree.direction}`, degree.magnitude > 1 ? 'degree-double' : 'degree-single');
          }
          if (labelMode === 'both') {
            dot.classList.add('dot-both');
            const interval = document.createElement('small');
            interval.textContent = degree.label;
            dot.appendChild(interval);
          }
          dot.title = `${name} — ${degree.label}`;
          dot.setAttribute('aria-label', `String ${6 - i}, fret ${f}: ${name}, ${degree.label}`);
          c.appendChild(dot);
        }
        grid.appendChild(c);
      }
    }

    els.board.replaceChildren(grid);
    PageState.sync();
  }

  function cell(cls, text) {
    const c = document.createElement('div');
    c.className = cls;
    if (text) c.textContent = text;
    return c;
  }

  /* ---- Position windows: five CAGED-style boxes anchored on the low-E root ---- */
  const POSITION_OFFSETS = [0, 2, 4, 7, 9];
  function positionWindow(rootPc, value, fretCount) {
    const index = Number(value) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= POSITION_OFFSETS.length) return null;
    const rootFret = (rootPc - STRINGS[0].pc + 12) % 12;
    let start = rootFret + POSITION_OFFSETS[index] - 1;
    if (start < 0) start += 12;
    if (start + 4 > fretCount) start -= 12;
    if (start < 0) start = 0;
    return { start, end: start + 4 };
  }

  /* ---- Parallel-major comparison: legend keys and altered-degree summary ---- */
  function renderComparison(rootPc, modeKey, flats, enabled) {
    const summary = $('compare-summary');
    if (!summary) return;
    document.querySelectorAll('.compare-key').forEach((key) => { key.hidden = !enabled; });
    summary.hidden = !enabled;
    if (!enabled) return;
    const tonic = nameFor(rootPc, flats);
    const labels = scaleDegreeLabels(SCALES[modeKey]);
    const modeNotes = spellScale(rootPc, SCALES[modeKey], flats);
    const altered = labels.map((label, index) => ({ label, note: modeNotes[index] })).filter(({ label }) => /[♭♯]/.test(label));
    summary.replaceChildren();
    const lead = document.createElement('strong');
    lead.textContent = `Compared with ${tonic} major: `;
    summary.append(lead);
    if (!altered.length) {
      summary.append('identical — Ionian is the major scale.');
      return;
    }
    altered.forEach(({ label, note }, index) => {
      const chip = document.createElement('span');
      chip.className = 'compare-chip';
      chip.textContent = `${label} = ${note}`;
      summary.append(chip, index < altered.length - 1 ? ' ' : '');
    });
    summary.append(` — ${altered.length === 1 ? 'one degree' : `${altered.length} degrees`} ${altered.some(a => a.label.includes('♯')) && altered.some(a => a.label.includes('♭')) ? 'changed' : altered[0].label.includes('♯') ? 'raised' : 'lowered'}.`);
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
      els.compare?.addEventListener(ev, render);
      els.position?.addEventListener(ev, render);
      els.labelMode?.addEventListener(ev, render);
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
    // Preserve bookmarks created before scale degrees were named "Intervals".
    const url = new URL(location.href);
    if (url.searchParams.get('labels') === 'degrees') {
      url.searchParams.set('labels', 'intervals');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    PageState.bind({ key: els.root, [modesPage ? 'mode' : 'scale']: els.scale, frets: els.frets, spelling: els.spelling, all: els.showAll, compare: els.compare, pos: els.position, labels: els.labelMode });
    PageState.wireShare();
    $('play-controls')?.append(Playback.button(modesPage ? 'Play mode' : 'Play scale', (done) =>
      Playback.playMelody(Playback.scaleMidis(parseInt(els.root.value, 10), SCALES[els.scale.value].steps), done)));
    wire();
    render();
    showSelfTest();
  });
})();
