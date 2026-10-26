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

  /* ---- Render one chord as a compact full-neck map ---- */
  function renderChord(rootPc, chordKey, fretCount, labelMode) {
    const chord = CHORDS[chordKey];
    const flats = useFlatsFor(rootPc, chord.family);
    const notes = spellChord(rootPc, chord, flats);
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

    card.appendChild(renderChordFretboard(rootPc, chord, notes, fretCount, labelMode));
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
