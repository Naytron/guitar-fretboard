/*
 * Chords diagram UI — pick a root, see every chord quality as a full-neck map
 * with each tone COLORED BY INTERVAL (root / 3rd / 5th / 7th / extension).
 * Reuses the same pure note engine (fretboard.engine.js); no external libraries.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    root: $('root'),
    spelling: $('spelling'),
    frets: $('frets'),
    fretsOut: $('frets-out'),
    labelMode: $('label-mode'),
    gallery: $('gallery'),
    badge: $('selftest'),
  };

  /* ---- Populate controls ---- */
  function populate() {
    const rootNames = ['C', 'C♯ / D♭', 'D', 'D♯ / E♭', 'E', 'F', 'F♯ / G♭', 'G', 'G♯ / A♭', 'A', 'A♯ / B♭', 'B'];
    rootNames.forEach((label, pc) => els.root.add(new Option(label, String(pc))));
    els.root.value = '0';   // C — the classic first chord shape
    els.frets.value = '12';
  }

  function useFlatsFor(rootPc, family) {
    const mode = els.spelling.value;
    if (mode === 'sharps') return false;
    if (mode === 'flats') return true;
    return keyPrefersFlats(rootPc, family); // auto
  }

  function cell(cls, text) {
    const c = document.createElement('div');
    c.className = cls;
    if (text) c.textContent = text;
    return c;
  }

  /* ---- Render one chord as a compact full-neck map ---- */
  function renderChord(rootPc, chordKey, fretCount, labelMode) {
    const chord = CHORDS[chordKey];
    const flats = useFlatsFor(rootPc, chord.family);
    const intervals = chordIntervals(rootPc, chord); // pitch class → interval label
    const notes = spellChord(rootPc, chord, flats);
    const noteNames = new Map(chord.steps.map((step, i) => [(rootPc + step) % 12, notes[i]]));
    const rootName = nameFor(rootPc, flats);

    const card = document.createElement('article');
    card.className = 'chord-card';

    const head = document.createElement('header');
    head.className = 'chord-head';
    head.innerHTML =
      `<h3 class="chord-name">${rootName}<span class="chord-symbol">${chord.symbol}</span>` +
      `<span class="chord-fullname">${chord.name}</span></h3>` +
      `<p class="chord-sub"><span class="chord-notes">${notes.join(' · ')}</span>` +
      `<span class="chord-formula">${chord.labels.join(' ')}</span></p>`;
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'fb-grid chord-grid';
    grid.style.gridTemplateColumns = `var(--label-col) repeat(${fretCount + 1}, 1fr)`;

    // header row: fret numbers + inlays
    grid.appendChild(cell('fb-corner', ''));
    for (let f = 0; f <= fretCount; f++) {
      const c = cell('fb-fretnum', String(f));
      if (f === 0) c.classList.add('open-col');
      if (f === 1) c.classList.add('nut');
      if (DOUBLE_MARKERS.has(f)) c.classList.add('marker', 'marker-2');
      else if (SINGLE_MARKERS.has(f)) c.classList.add('marker');
      grid.appendChild(c);
    }

    // string rows: high e (1st) on top → low E (6th) on bottom
    for (let i = STRINGS.length - 1; i >= 0; i--) {
      const str = STRINGS[i];
      grid.appendChild(cell('fb-string-label', str.label));
      for (let f = 0; f <= fretCount; f++) {
        const c = document.createElement('div');
        c.className = 'fb-cell';
        if (f === 0) c.classList.add('open-col');
        if (f === 1) c.classList.add('nut');
        const pc = noteAt(str.pc, f);
        if (intervals.has(pc)) {
          const label = intervals.get(pc);
          const name = noteNames.get(pc);
          const dot = document.createElement('span');
          dot.className = `note cat-${intervalCategory(label)}`;
          if (label === 'R') dot.classList.add('is-root');
          if (labelMode === 'intervals') {
            dot.textContent = label;
          } else if (labelMode === 'both') {
            dot.classList.add('dot-both');
            dot.innerHTML = `${name}<small>${label}</small>`;
          } else {
            dot.textContent = name;
          }
          dot.title = `${name} — ${label}`;
          c.appendChild(dot);
        }
        grid.appendChild(c);
      }
    }

    card.appendChild(grid);
    return card;
  }

  /* ---- Render the whole gallery, grouped by chord family ---- */
  function render() {
    const rootPc = parseInt(els.root.value, 10);
    const fretCount = parseInt(els.frets.value, 10);
    const labelMode = els.labelMode.value;
    els.fretsOut.textContent = String(fretCount);

    const groups = [];
    const byName = new Map();
    Object.entries(CHORDS).forEach(([key, def]) => {
      if (!byName.has(def.group)) {
        byName.set(def.group, []);
        groups.push(def.group);
      }
      byName.get(def.group).push(key);
    });

    const frag = document.createDocumentFragment();
    groups.forEach((groupName) => {
      const section = document.createElement('section');
      section.className = 'chord-group';
      const h2 = document.createElement('h2');
      h2.className = 'chord-group-title';
      h2.textContent = groupName;
      section.appendChild(h2);

      const row = document.createElement('div');
      row.className = 'chord-row';
      byName.get(groupName).forEach((k) => {
        row.appendChild(renderChord(rootPc, k, fretCount, labelMode));
      });
      section.appendChild(row);
      frag.appendChild(section);
    });

    els.gallery.replaceChildren(frag);
  }

  /* ---- Wire up ---- */
  function wire() {
    ['change', 'input'].forEach((ev) => {
      els.root.addEventListener(ev, render);
      els.spelling.addEventListener(ev, render);
      els.frets.addEventListener(ev, render);
      els.labelMode.addEventListener(ev, render);
    });
  }

  function showSelfTest() {
    const { passed, results } = runChordSelfTest();
    els.badge.textContent = passed
      ? '✓ chord-accuracy self-test passed'
      : '✗ self-test failed — see console';
    els.badge.classList.add(passed ? 'ok' : 'fail');
    els.badge.title = results.map((r) => `${r.ok ? '✓' : '✗'} ${r.label} = ${r.got}`).join('\n');
  }

  document.addEventListener('DOMContentLoaded', () => {
    populate();
    wire();
    render();
    showSelfTest();
  });
})();
