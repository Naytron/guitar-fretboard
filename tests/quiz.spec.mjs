import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../quiz.engine.js');
const storageKey = 'fretboard-lab.quiz.v1';
const random = () => 0.37;

async function open(page) {
  await page.addInitScript(() => { Math.random = () => 0.37; });
  await page.goto('/quiz.html');
}

async function chooseActivity(page, activity) {
  await page.getByRole('button', { name: engine.activities[activity], exact: true }).click();
}

async function finish(page, questions, response = 'correct') {
  for (const question of questions) {
    await expect(page.locator('#question-title')).toHaveText(question.prompt);
    if (response === 'reveal') {
      await page.locator('#quiz-reveal').click();
    } else {
      const answer = response === 'wrong' ? question.options.find(item => item.id !== question.correct.id) : question.correct;
      await page.locator('#quiz-options').getByRole('button', { name: answer.label, exact: true }).click();
    }
    await expect(page.locator('#quiz-feedback')).toContainText(question.explanation);
    await page.locator('#quiz-next').click();
  }
}

for (const activity of ['notes', 'intervals', 'chords', 'roman', 'modes']) {
  test(`${activity} lesson grades ten questions and persists a correct first-attempt score`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page);
    await chooseActivity(page, activity);
    await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
    const session = engine.start({ activity }, random);
    await finish(page, session.questions);
    await expect(page.locator('#quiz-score')).toContainText('10/10 first-attempt correct (100%)');
    await expect(page.locator('#quiz-retry')).toBeHidden();
    await page.reload();
    await expect(page.locator('#quiz-history-list')).toContainText('10/10');
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).history.length, storageKey)).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('missed and assisted answers get a separate review round without overwriting the original score', async ({ page }) => {
  await open(page);
  const session = engine.start({}, random);
  await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
  await finish(page, session.questions.slice(0, 1), 'wrong');
  await page.locator('#quiz-hint').click();
  await expect(page.locator('#quiz-hint-text')).not.toBeEmpty();
  await finish(page, session.questions.slice(1, 2));
  await finish(page, session.questions.slice(2));
  await expect(page.locator('#quiz-score')).toContainText('8/10 first-attempt correct (80%). 1 assisted');
  await page.locator('#quiz-retry').click();
  await expect(page.locator('#quiz-progress')).toHaveText('Review round · 1 of 2');
  await finish(page, session.questions.slice(0, 2));
  await expect(page.locator('#quiz-score')).toContainText('2/2');
  await expect(page.locator('#quiz-score')).toContainText('original lesson score is unchanged');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(stored.history).toHaveLength(1);
  expect(stored.history[0].correct).toBe(8);
  await page.locator('#quiz-practice-missed').click();
  await expect(page.locator('#quiz-progress')).toHaveText('Lesson · 1 of 10');
  const focused = engine.start({}, random, Object.keys(stored.history[0].missed));
  await expect(page.locator('#question-title')).toHaveText(focused.questions[0].prompt);
});

test('all wrong and all revealed sessions count zero and allow retrying every question', async ({ page }) => {
  await open(page);
  for (const response of ['wrong', 'reveal']) {
    await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
    await finish(page, engine.start({}, random).questions, response);
    await expect(page.locator('#quiz-score')).toContainText('0/10');
    await page.locator('#quiz-retry').click();
    await expect(page.locator('#quiz-progress')).toHaveText('Review round · 1 of 10');
    await page.locator('#quiz-end').click();
  }
});

test('location selection is answer-neutral, keyboard accessible, and accepts both octave positions', async ({ page }) => {
  await open(page);
  await page.locator('#quiz-direction').selectOption('find');
  await page.locator('#quiz-string').selectOption('1');
  await page.locator('#quiz-frets').selectOption('12');
  const questions = engine.start({ direction: 'find', string: '1', frets: 12 }, random).questions;
  await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
  for (const question of questions) {
    const buttons = page.locator('#quiz-board button');
    await expect(buttons).toHaveCount(13);
    await expect(page.locator('#quiz-board [tabindex="0"]')).toHaveCount(1);
    expect(await buttons.first().textContent()).toBe('·');
    await expect(buttons.first()).toHaveAttribute('aria-label', 'String 1, fret 0');
    await buttons.first().focus();
    const target = question.valid.at(-1);
    const fret = Number(target.split(':')[1]);
    for (let index = 0; index < fret; index++) await page.keyboard.press('ArrowRight');
    await expect(buttons.nth(fret)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#quiz-feedback')).toContainText('Correct!');
    await expect(page.locator('#quiz-next')).toBeFocused();
    await page.locator('#quiz-next').click();
  }
  await expect(page.locator('#quiz-score')).toContainText('10/10');
});

test('question markers do not expose note answers before submitting and options cannot score twice', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
  const question = engine.start({}, random).questions[0];
  const board = page.locator('#quiz-board');
  await expect(board).not.toContainText(question.correct.label);
  await expect(board.locator('[title]')).toHaveCount(0);
  expect(await board.locator('[aria-label]').evaluateAll(elements => elements.every(el => /^String \d, fret \d+(, target)?$/.test(el.getAttribute('aria-label'))))).toBe(true);
  await page.locator('#quiz-options').getByRole('button', { name: question.correct.label, exact: true }).evaluate(button => { button.click(); button.click(); });
  await expect(page.locator('#quiz-progress')).toHaveText('Lesson · 1 of 10');
  await page.locator('#quiz-next').click();
  await expect(page.locator('#quiz-progress')).toHaveText('Lesson · 2 of 10');
});

test('settings survive reload; ending early saves no score; confirmed reset touches only quiz keys', async ({ page }) => {
  await open(page);
  await page.evaluate(() => localStorage.setItem('unrelated', 'keep'));
  await page.locator('#quiz-frets').selectOption('12');
  await page.locator('#quiz-notes').selectOption('chromatic');
  await page.reload();
  await expect(page.locator('#quiz-frets')).toHaveValue('12');
  await expect(page.locator('#quiz-notes')).toHaveValue('chromatic');
  await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
  await page.locator('#quiz-end').click();
  await expect(page.locator('#quiz-history-list')).toContainText('No completed lessons yet');
  await page.locator('#quiz-reset').click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#quiz-frets')).toHaveValue('12');
  await page.locator('#quiz-reset').click();
  await page.locator('#quiz-confirm').getByRole('button', { name: 'Reset quiz progress', exact: true }).click();
  await expect(page.locator('#quiz-frets')).toHaveValue('5');
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep');
});

for (const badValue of ['{broken', '{"version":99,"history":[]}', '{"version":1,"history":[{}]}']) {
  test(`invalid saved data shows a notice and can be reset: ${badValue}`, async ({ page }) => {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: badValue });
    await open(page);
    await expect(page.locator('#storage-notice')).toContainText('Progress is not being saved');
    await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
    await expect(page.locator('#quiz-session')).toBeVisible();
    await page.locator('#quiz-end').click();
    await page.locator('#quiz-reset').click();
    await page.locator('#quiz-confirm').getByRole('button', { name: 'Reset quiz progress', exact: true }).click();
    await expect(page.locator('#storage-notice')).toBeEmpty();
  });
}

for (const method of ['getItem', 'setItem']) {
  test(`unavailable browser storage (${method}) permits lessons with an explicit notice`, async ({ page }) => {
    await page.addInitScript(name => { Storage.prototype[name] = () => { throw new DOMException('Storage blocked', 'SecurityError'); }; }, method);
    await open(page);
    await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
    await expect(page.locator('#storage-notice')).toContainText('Progress is not being saved');
    await finish(page, engine.start({}, random).questions);
    await expect(page.locator('#quiz-score')).toContainText('10/10');
  });
}

for (const theme of ['light', 'dark']) for (const width of [375, 768, 1280, 1920]) {
  test(`Quiz layout at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/quiz.html?scoutTheme=${theme}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('link', { name: '05 Quiz' })).toBeVisible();
    await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
    await expect(page.locator('#question-title')).toBeFocused();
    expect(await page.locator('#quiz-board').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThan(900);
    expect(await page.locator('#quiz-board').evaluate(el => {
      const target = el.querySelector('.quiz-mark');
      const board = el.getBoundingClientRect();
      const marker = target.getBoundingClientRect();
      return marker.left >= board.left && marker.right <= board.right;
    })).toBe(true);
    const sizes = await page.locator('#quiz-options button').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('seven-note scale spelling is consistent in Scales, Modes and Progressions', async ({ page }) => {
  for (const file of ['index', 'modes', 'progressions']) {
    await page.goto(`/${file}.html`);
    const details = page.locator('details');
    for (const element of await details.all()) await element.evaluate(el => { el.open = true; });
    await page.locator('#root').selectOption('1');
    await page.locator('#spelling').selectOption('sharps');
    if (file === 'progressions') {
      await expect(page.locator('.diatonic-name').nth(2)).toHaveText('E♯ Minor');
      await expect(page.locator('.diatonic-name').nth(6)).toHaveText('B♯ Diminished');
    } else {
      await expect(page.locator('#scale-notes')).toHaveText('C♯ · D♯ · E♯ · F♯ · G♯ · A♯ · B♯');
      await expect(page.locator('#fretboard .note').filter({ hasText: /^E♯$/ }).first()).toBeVisible();
    }
  }
});

for (const config of [
  { activity: 'notes', notes: 'chromatic', string: '6', frets: 12 },
  { activity: 'intervals', string: '5' },
  { activity: 'chords', advanced: true, key: 6, scale: 'natural_minor' },
  { activity: 'roman', key: 6, scale: 'natural_minor' },
]) {
  test(`nondefault ${config.activity} settings generate valid graded lessons`, async ({ page }) => {
    await open(page);
    await chooseActivity(page, config.activity);
    for (const [field, value] of Object.entries(config)) {
      if (field !== 'activity') await page.locator(`#quiz-${field}`).selectOption(String(value));
    }
    await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
    await finish(page, engine.start(config, random).questions);
    await expect(page.locator('#quiz-score')).toContainText('10/10');
  });
}

test('small pools explain recycling and history stays bounded to forty lessons', async ({ page }) => {
  await open(page);
  const summary = { settings: engine.defaults, total: 10, correct: 10, assisted: 0, missed: {} };
  await page.evaluate(({ key, item }) => localStorage.setItem(key, JSON.stringify({
    version: 1, settings: item.settings, history: Array(40).fill(item),
  })), { key: storageKey, item: summary });
  await page.reload();
  await page.locator('#quiz-string').selectOption('1');
  await page.getByRole('button', { name: 'Start 10-question lesson' }).click();
  await expect(page.locator('#quiz-pool-note')).toContainText('repeat only after the pool is exhausted');
  await finish(page, engine.start({ string: '1' }, random).questions);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).history.length, storageKey)).toBe(40);
});
