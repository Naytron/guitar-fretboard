(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const storageKey = 'fretboard-lab.quiz.v1';
  let config = { ...QuizEngine.defaults };
  let history = [];
  let canSave = true;
  let session;
  let saved = false;

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function storageError(error) {
    canSave = false;
    $('storage-notice').textContent = `Progress is not being saved. ${error.message} You can continue in memory or reset Quiz data to try again.`;
    console.warn('Quiz storage unavailable:', error);
  }

  function savedSettings(value) {
    if (!value || Object.keys(QuizEngine.defaults).some(key => !Object.hasOwn(value, key))) {
      throw new Error('Saved Quiz settings are incomplete. Reset Quiz data to use the current format.');
    }
    return QuizEngine.settings(value);
  }

  function validSummary(item) {
    if (!item || typeof item !== 'object') return false;
    savedSettings(item.settings);
    return item.total === 10 && Number.isInteger(item.correct) && item.correct >= 0 &&
      Number.isInteger(item.assisted) && item.assisted >= 0 && item.correct + item.assisted <= 10 &&
      typeof item.missed === 'object' && item.missed !== null && !Array.isArray(item.missed) &&
      Object.keys(item.missed).length <= 10 &&
      Object.entries(item.missed).every(([skill, count]) => skill.length <= 120 && Number.isInteger(count) && count > 0 && count <= 10) &&
      Object.values(item.missed).reduce((sum, count) => sum + count, 0) === 10 - item.correct;
  }

  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.history) || data.history.length > 40 ||
          !data.history.every(validSummary)) throw new Error('Saved Quiz data is corrupt or uses an unsupported format.');
      config = savedSettings(data.settings);
      history = data.history;
    } catch (error) {
      storageError(error);
    }
  }

  function persist() {
    if (!canSave) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, settings: config, history }));
    } catch (error) {
      storageError(error);
    }
  }

  const fields = ['direction', 'string', 'frets', 'notes', 'key', 'scale', 'advanced'];
  function configure() {
    for (const field of fields) $(`quiz-${field}`).value = String(config[field]);
    for (const button of $('activities').children) button.setAttribute('aria-pressed', String(button.value === config.activity));
    for (const label of document.querySelectorAll('[data-for]')) {
      label.hidden = !label.dataset.for.split(' ').includes(config.activity);
      label.querySelector('select').disabled = label.hidden;
    }
    const help = {
      notes: 'Start with natural notes on a small range, then add strings or accidentals. Equivalent sharp/flat names share one answer.',
      intervals: 'Visual intervals, not ear training. Ascending from an open-string root, frets 0–12: unison through octave. Six semitones is the tritone.',
      chords: 'R means root. Other labels identify the chord interval, such as 3 (major third) or ♭3 (minor third).',
      roman: 'Major and natural-minor triads only. Capitalization and ° are part of the chord quality.',
      modes: 'Name modes from their W/H pattern and degree, find the parent major key of a mode on your chosen tonic, and spot each mode\'s characteristic tone.',
    };
    $('activity-help').textContent = help[config.activity];
  }

  function readConfig() {
    const values = Object.fromEntries(fields.map(field => [field, $(`quiz-${field}`).value]));
    return QuizEngine.settings({ ...values, activity: config.activity, frets: Number(values.frets), key: Number(values.key), advanced: values.advanced === 'true' });
  }

  function show(view) {
    $('quiz-setup').hidden = view !== 'setup';
    $('quiz-session').hidden = view !== 'session';
    $('quiz-results').hidden = view !== 'results';
    $('quiz-history').hidden = view === 'session';
  }

  function historyView() {
    $('quiz-history-list').replaceChildren();
    for (const [activity, label] of Object.entries(QuizEngine.activities)) {
      const items = history.filter(item => item.settings.activity === activity);
      const total = items.reduce((sum, item) => sum + item.total, 0);
      const correct = items.reduce((sum, item) => sum + item.correct, 0);
      $('quiz-history-list').append(node('p', `${label}: ${total ? `${correct}/${total} first-attempt correct (${Math.round(correct / total * 100)}%) across ${items.length} lesson(s)` : 'No completed lessons yet'}`));
    }
    $('quiz-practice-missed').disabled = !history.some(item => Object.keys(item.missed).length);
  }

  function begin(skills) {
    try {
      config = readConfig();
      session = QuizEngine.start(config, Math.random, skills);
    } catch (error) {
      $('quiz-error').textContent = error.message;
      return;
    }
    saved = false;
    $('quiz-error').textContent = '';
    persist();
    show('session');
    render();
  }

  function renderBoard(question, answered) {
    const holder = $('quiz-board');
    holder.replaceChildren();
    holder.hidden = !question.board;
    if (!question.board) return;
    const { strings, frets, marks } = question.board;
    const grid = node('div', undefined, 'quiz-neck');
    grid.style.gridTemplateColumns = `3rem repeat(${frets + 1}, 3rem)`;
    grid.append(node('span', 'String', 'quiz-string-label'));
    for (let fret = 0; fret <= frets; fret++) grid.append(node('span', String(fret), 'quiz-fret'));
    const buttons = [];
    for (const string of strings) {
      grid.append(node('span', String(string), 'quiz-string-label'));
      for (let fret = 0; fret <= frets; fret++) {
        const mark = marks.find(item => item.string === string && item.fret === fret);
        const id = `${string}:${fret}`;
        const valid = question.valid?.includes(id) || (mark && mark.text.includes('?'));
        const text = answered && valid ? question.correct.label : mark?.text || '·';
        const cell = node(question.valid ? 'button' : 'div', text, 'quiz-position');
        cell.setAttribute('aria-label', `String ${string}, fret ${fret}${mark ? `, ${mark.text === 'R' ? 'root' : 'target'}` : ''}${answered && valid ? `: ${question.correct.label}` : ''}`);
        if (mark) cell.classList.add('quiz-mark');
        if (answered && valid) cell.classList.add('quiz-correct');
        if (question.valid) {
          cell.type = 'button';
          cell.disabled = answered;
          cell.tabIndex = buttons.length === 0 ? 0 : -1;
          cell.addEventListener('click', () => submit(id));
          cell.addEventListener('keydown', event => {
            const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: frets + 1, ArrowUp: -(frets + 1) };
            const index = buttons.indexOf(cell);
            const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
              : Object.hasOwn(moves, event.key) ? Math.max(0, Math.min(buttons.length - 1, index + moves[event.key])) : null;
            if (target === null) return;
            event.preventDefault();
            buttons.forEach(button => { button.tabIndex = -1; });
            buttons[target].tabIndex = 0;
            buttons[target].focus();
          });
          buttons.push(cell);
        }
        grid.append(cell);
      }
    }
    holder.append(grid);
    holder.tabIndex = question.valid ? -1 : 0;
    holder.scrollLeft = 0;
    const target = [...grid.querySelectorAll('.quiz-mark')].at(-1);
    if (target) {
      holder.scrollLeft = target.getBoundingClientRect().left - holder.getBoundingClientRect().left
        - holder.clientWidth / 2 + target.getBoundingClientRect().width / 2;
    }
  }

  function render() {
    if (session.index >= session.questions.length) return finish();
    const question = session.questions[session.index];
    const result = session.results[session.index];
    $('quiz-progress').textContent = `${session.review ? 'Review round' : 'Lesson'} · ${session.index + 1} of ${session.questions.length}`;
    $('question-title').textContent = question.prompt;
    $('quiz-pool-note').textContent = !session.review && session.poolSize < 10
      ? `These settings have ${session.poolSize} unique questions. They repeat only after the pool is exhausted.` : '';
    renderBoard(question, Boolean(result));
    $('quiz-options').replaceChildren();
    for (const answer of question.options) {
      const button = node('button', answer.label);
      button.type = 'button';
      button.disabled = Boolean(result);
      button.addEventListener('click', () => submit(answer.id));
      $('quiz-options').append(button);
    }
    $('quiz-feedback').replaceChildren();
    if (result) {
      $('quiz-feedback').append(node('strong', result.assisted ? 'Assisted — not counted as first-attempt correct.' : result.correct ? 'Correct!' : `Not quite. Answer: ${question.correct.label}`),
        node('span', question.explanation));
    }
    $('quiz-next').hidden = !result;
    $('quiz-next').textContent = session.index === session.questions.length - 1 ? 'See results' : 'Next question';
    $('quiz-hint').hidden = Boolean(result);
    $('quiz-hint').disabled = session.assisted;
    $('quiz-reveal').hidden = Boolean(result);
    if (!session.assisted) $('quiz-hint-text').textContent = '';
    (result ? $('quiz-next') : $('question-title')).focus();
  }

  function submit(value) {
    session = QuizEngine.answer(session, value);
    render();
  }

  function finish() {
    const result = QuizEngine.summary(session);
    if (!saved && !session.review) {
      history = [...history, result].slice(-40);
      saved = true;
      persist();
    }
    show('results');
    $('results-title').textContent = session.review ? 'Review round complete' : 'Lesson complete';
    $('quiz-score').textContent = `${result.correct}/${result.total} first-attempt correct (${Math.round(result.correct / result.total * 100)}%). ${result.assisted} assisted. ${session.review ? 'Your original lesson score is unchanged.' : 'Review rounds do not change this score.'}`;
    $('quiz-missed').replaceChildren(...Object.entries(result.missed).map(([skill, count]) => node('li', `${skill}: ${count} to revisit`)));
    $('quiz-retry').hidden = !Object.keys(result.missed).length;
    historyView();
    $('results-title').focus();
  }

  /* Lesson links preset the next lesson via the query string; invalid values are ignored. */
  function applyPresets() {
    const params = new URLSearchParams(location.search);
    if (![...params.keys()].some(key => Object.hasOwn(QuizEngine.defaults, key))) return;
    const preset = {};
    for (const key of Object.keys(QuizEngine.defaults)) {
      if (!params.has(key)) continue;
      const value = params.get(key);
      preset[key] = key === 'advanced' ? value === 'true' : ['frets', 'key'].includes(key) ? Number(value) : value;
    }
    try {
      config = QuizEngine.settings({ ...config, ...preset });
    } catch (error) {
      console.warn('Ignoring invalid Quiz preset in URL:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    applyPresets();
    for (let pc = 0; pc < 12; pc++) $('quiz-key').add(new Option(QuizEngine.pitchLabel(pc), String(pc)));
    for (const [value, label] of Object.entries(QuizEngine.activities)) {
      const button = node('button', label);
      button.type = 'button';
      button.value = value;
      button.addEventListener('click', () => { config.activity = value; configure(); config = readConfig(); persist(); });
      $('activities').append(button);
    }
    configure();
    historyView();
    $('quiz-settings').addEventListener('change', () => { config = readConfig(); persist(); });
    $('quiz-settings').addEventListener('submit', event => { event.preventDefault(); begin(); });
    $('quiz-next').addEventListener('click', () => { session = QuizEngine.next(session); render(); });
    $('quiz-hint').addEventListener('click', () => {
      session = QuizEngine.assist(session);
      const question = session.questions[session.index];
      $('quiz-hint-text').textContent = question.board
        ? 'Each fret is one semitone. Start at the open-string note; E–F and B–C are half steps. Other neighboring natural notes are a whole step apart.'
        : session.settings.activity === 'modes'
          ? 'Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian — degrees 1 to 7. The parent major key sits that many scale steps below the tonic.'
          : 'Build from the root using the scale or chord formula. Major triads use 0, 4, 7 semitones; minor triads use 0, 3, 7.';
      $('quiz-hint').disabled = true;
    });
    $('quiz-reveal').addEventListener('click', () => {
      session = QuizEngine.assist(session);
      const question = session.questions[session.index];
      submit(question.valid ? question.valid[0] : question.correct.id);
    });
    $('quiz-end').addEventListener('click', () => { show('setup'); $('setup-title').scrollIntoView(); });
    $('quiz-retry').addEventListener('click', () => { session = QuizEngine.retry(session); show('session'); render(); });
    $('quiz-new').addEventListener('click', () => { show('setup'); configure(); });
    $('quiz-practice-missed').addEventListener('click', () => {
      const previous = history.findLast(item => Object.keys(item.missed).length);
      if (!previous) return;
      config = QuizEngine.settings(previous.settings);
      configure();
      begin(Object.keys(previous.missed));
    });
    $('quiz-reset').addEventListener('click', () => $('quiz-confirm').showModal());
    $('quiz-confirm').addEventListener('close', () => {
      if ($('quiz-confirm').returnValue !== 'reset') return;
      try {
        localStorage.removeItem(storageKey);
        canSave = true;
        $('storage-notice').textContent = '';
      } catch (error) { storageError(error); }
      config = { ...QuizEngine.defaults };
      history = [];
      configure();
      historyView();
      show('setup');
    });
  });
})();
