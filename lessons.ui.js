/*
 * Lesson panel UI — a three-level ARIA tab panel rendered below each diagram.
 * Pages call LessonsUI.update(page, state) from their own render(); the panel
 * re-resolves the active lesson against the current selection.
 */
const LessonsUI = (() => {
  'use strict';

  const storageKey = 'fretboard-lab.lessons.v1';
  let page;
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

  function loadLevel() {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || 'null');
      const saved = data?.version === 1 && data.levels?.[page];
      if (Lessons.LEVELS.includes(saved)) level = saved;
    } catch (error) {
      console.warn('Lesson preferences unavailable:', error);
    }
  }

  function saveLevel() {
    try {
      let data = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (data?.version !== 1 || typeof data.levels !== 'object' || data.levels === null) data = { version: 1, levels: {} };
      data.levels[page] = level;
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Lesson preferences not saved:', error);
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
    saveLevel();
    render();
    if (focus) els.buttons[Lessons.LEVELS.indexOf(key)].focus();
  }

  function render() {
    if (!mounted || !state) return;
    for (const button of els.buttons) {
      const active = button.dataset.level === level;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
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

    els.panel.replaceChildren(header, model, ...sections, link);
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
