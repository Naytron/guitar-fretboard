/*
 * Lesson panel UI — a three-level ARIA tab panel rendered below each diagram.
 * Pages call LessonsUI.update(page, state) from their own render(); the panel
 * re-resolves the active lesson against the current selection.
 */
const LessonsUI = (() => {
  'use strict';

  const storageKey = 'fretboard-lab.lessons.v1';
  const quizStorageKey = 'fretboard-lab.quiz.v1';
  let page;
  let learned = {};
  let state;
  let level = 'beginner';
  let mounted = false;
  const els = {};

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function readPrefs() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(storageKey) || 'null');
    } catch (error) {
      console.warn('Lesson preferences unavailable:', error);
    }
    if (data?.version !== 1 || typeof data.levels !== 'object' || data.levels === null) data = { version: 1, levels: {} };
    if (typeof data.learned !== 'object' || data.learned === null) data.learned = {};
    return data;
  }

  function loadLevel() {
    const data = readPrefs();
    const saved = data.levels[page];
    if (Lessons.LEVELS.includes(saved)) level = saved;
    learned = Object.fromEntries(Lessons.LEVELS.filter(key => data.learned[page]?.[key] === true).map(key => [key, true]));
  }

  function savePrefs() {
    try {
      const data = readPrefs();
      data.levels[page] = level;
      data.learned[page] = { ...learned };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Lesson preferences not saved:', error);
    }
  }

  /* Latest Quiz result for this lesson's activity (read-only; Quiz owns its storage). */
  function quizResult(activity) {
    try {
      const data = JSON.parse(localStorage.getItem(quizStorageKey) || 'null');
      if (data?.version !== 1 || !Array.isArray(data.history)) return null;
      const item = data.history.findLast(entry => entry?.settings?.activity === activity && Number.isInteger(entry.total) && entry.total > 0);
      return item ? { correct: item.correct, total: item.total } : null;
    } catch {
      return null;
    }
  }

  function segment(part) {
    if (typeof part === 'string') return document.createTextNode(part);
    const className = { note: 'lesson-note', interval: 'lesson-interval', em: 'lesson-em' }[part.t];
    return node(part.t === 'em' ? 'em' : 'span', part.v, className);
  }

  function paragraph(parts) {
    const p = node('p');
    p.append(...parts.map(segment));
    return p;
  }

  function mount() {
    const root = document.getElementById('lessons');
    if (!root) return false;
    els.tabs = root.querySelector('[role="tablist"]');
    els.panel = root.querySelector('[role="tabpanel"]');
    if (!els.tabs || !els.panel) return false;
    els.buttons = Lessons.LEVELS.map(key => {
      const button = node('button', Lessons.LEVEL_LABELS[key]);
      button.type = 'button';
      button.id = `lesson-tab-${key}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', els.panel.id);
      button.dataset.level = key;
      button.addEventListener('click', () => select(key, false));
      return button;
    });
    els.tabs.replaceChildren(...els.buttons);
    els.tabs.addEventListener('keydown', onTabKey);
    els.panel.tabIndex = 0;
    mounted = true;
    return true;
  }

  function onTabKey(event) {
    const index = Lessons.LEVELS.indexOf(level);
    const moves = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: Lessons.LEVELS.length - 1 - index };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (index + moves[event.key] + Lessons.LEVELS.length) % Lessons.LEVELS.length;
    select(Lessons.LEVELS[next], true);
  }

  function select(key, focus) {
    level = key;
    savePrefs();
    render();
    if (focus) els.buttons[Lessons.LEVELS.indexOf(key)].focus();
  }

  function render() {
    if (!mounted || !state) return;
    for (const button of els.buttons) {
      const active = button.dataset.level === level;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      const done = learned[button.dataset.level] === true;
      button.classList.toggle('is-learned', done);
      button.setAttribute('aria-label', `${Lessons.LEVEL_LABELS[button.dataset.level]}${done ? ' (learned)' : ''}`);
    }
    els.panel.setAttribute('aria-labelledby', `lesson-tab-${level}`);

    const lesson = Lessons.resolve(page, level, Lessons.context(page, state));
    const header = node('header', undefined, 'lesson-header');
    header.append(node('p', lesson.levelLabel, 'lesson-level'), node('h3', lesson.title, 'lesson-title'), node('p', lesson.summary, 'lesson-summary'));

    const model = node('aside', undefined, 'lesson-model');
    const modelLabel = node('p', undefined, 'lesson-model-label');
    modelLabel.append('Mental model · ', node('strong', lesson.mentalModel.name));
    model.append(modelLabel, ...lesson.mentalModel.paragraphs.map(paragraph));

    const sections = lesson.sections.map(section => {
      const block = node('section', undefined, 'lesson-section');
      block.append(node('h4', section.heading), ...section.paragraphs.map(paragraph));
      return block;
    });

    const link = node('a', undefined, 'lesson-quiz');
    link.href = lesson.quiz.href;
    link.append(lesson.quiz.label, ' ', node('span', '→'));
    link.lastChild.setAttribute('aria-hidden', 'true');

    const footer = node('div', undefined, 'lesson-path');
    const result = quizResult(lesson.quiz.settings.activity);
    const score = node('p', undefined, 'lesson-score');
    score.id = 'lesson-score';
    score.textContent = result
      ? `Last ${lesson.quiz.settings.activity} quiz: ${result.correct}/${result.total} first-attempt correct (${Math.round(result.correct / result.total * 100)}%).`
      : 'No quiz result for this topic yet.';
    const mark = node('button', undefined, 'lesson-learned');
    mark.type = 'button';
    mark.id = 'lesson-learned';
    const done = learned[level] === true;
    mark.setAttribute('aria-pressed', String(done));
    mark.textContent = done ? '✓ Learned — tap to unmark' : 'Mark as learned';
    mark.addEventListener('click', () => {
      if (learned[level]) delete learned[level]; else learned[level] = true;
      savePrefs();
      render();
    });
    const count = Lessons.LEVELS.filter(key => learned[key]).length;
    const progress = node('p', `${count} of ${Lessons.LEVELS.length} levels learned on this page.`, 'lesson-progress');
    progress.id = 'lesson-progress';
    footer.append(link, score, mark, progress);

    els.panel.replaceChildren(header, model, ...sections, footer);
  }

  function update(nextPage, nextState) {
    if (!Lessons.PAGES.includes(nextPage)) throw new Error(`Unknown lesson page: ${nextPage}`);
    if (page !== nextPage) {
      page = nextPage;
      loadLevel();
    }
    state = nextState;
    if (!mounted && !mount()) return;
    render();
  }

  return { update, get level() { return level; } };
})();
