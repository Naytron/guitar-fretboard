import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

test.describe('shareable URLs', () => {
  test('restores Modes controls from the query string and rejects invalid values', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/modes.html?key=2&mode=dorian&frets=12&compare=true&pos=1&all=true');
    await expect(page.locator('#root')).toHaveValue('2');
    await expect(page.locator('#scale')).toHaveValue('dorian');
    await expect(page.locator('#frets')).toHaveValue('12');
    await expect(page.locator('#compare-major')).toBeChecked();
    await expect(page.locator('#position')).toHaveValue('1');
    await expect(page.locator('#show-all')).toBeChecked();
    await expect(page.locator('#scale-title')).toHaveText('D Dorian');

    await page.goto('/modes.html?key=99&mode=aeolian&pos=9&frets=3');
    await expect(page.locator('#scale-title')).toHaveText('G Ionian (major)');
    await expect(page.locator('#position')).toHaveValue('all');
    expect(new URL(page.url()).search).toBe('');
    expect(errors).toEqual([]);
  });

  test('writes only non-default values and copies the link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/index.html');
    expect(new URL(page.url()).search).toBe('');
    await page.locator('#root').selectOption('0');
    await page.locator('#scale').selectOption('natural_minor');
    await expect.poll(() => new URL(page.url()).searchParams.get('key')).toBe('0');
    expect(new URL(page.url()).searchParams.get('scale')).toBe('natural_minor');
    expect(new URL(page.url()).searchParams.has('frets')).toBe(false);

    await page.locator('#share-link').click();
    await expect(page.locator('#share-status')).toContainText(/copied/i);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(page.url());
  });

  test('restores Chords and Progressions selections', async ({ page }) => {
    await page.goto('/chords.html?key=4&labels=intervals');
    await expect(page.locator('#root')).toHaveValue('4');
    await expect(page.locator('#label-mode')).toHaveValue('intervals');
    await page.goto('/progressions.html?key=0&scale=natural_minor&progression=2,5,1');
    await expect(page.locator('#root')).toHaveValue('0');
    await expect(page.locator('#scale')).toHaveValue('natural_minor');
    await expect(page.locator('#progression')).toHaveValue("2,5,1");
  });
});

test.describe('audio playback', () => {
  test('play buttons toggle pressed state and reset when playback finishes', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/index.html?frets=12');
    const play = page.locator('#play-controls .play-button');
    await expect(play).toHaveText(/Play scale/);
    await expect(play).toHaveAttribute('aria-pressed', 'false');
    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'true');
    await expect(play).toHaveAttribute('aria-pressed', 'false', { timeout: 15000 });
    expect(errors).toEqual([]);
  });

  test('every chord card and the progression map expose a play control', async ({ page }) => {
    await page.goto('/chords.html');
    const cards = page.locator('.chord-card');
    expect(await cards.count()).toBeGreaterThan(0);
    expect(await page.locator('.chord-card .play-button').count()).toBe(await cards.count());
    await page.goto('/progressions.html');
    await expect(page.locator('#play-controls .play-button')).toHaveText(/Play progression/);
    expect(await page.locator('#diatonic-chords .play-button').count()).toBe(7);
  });
});

test.describe('parallel-major comparison', () => {
  test('marks altered degrees and parallel-only notes for Dorian', async ({ page }) => {
    await page.goto('/modes.html?key=2&mode=dorian');
    await expect(page.locator('.note.altered')).toHaveCount(0);
    await expect(page.locator('.compare-key').first()).toBeHidden();
    await page.locator('#compare-major').check({ force: true });
    await expect(page.locator('#compare-summary')).toContainText('Compared with D major');
    await expect(page.locator('#compare-summary')).toContainText('♭3 = F');
    await expect(page.locator('#compare-summary')).toContainText('♭7 = C');
    await expect(page.locator('.compare-key').first()).toBeVisible();
    const altered = await page.locator('.note.altered').allTextContents();
    expect(new Set(altered)).toEqual(new Set(['F', 'C']));
    const parallel = await page.locator('.note.parallel').allTextContents();
    expect(new Set(parallel)).toEqual(new Set(['F♯', 'C♯']));
    expect(new URL(page.url()).searchParams.get('compare')).toBe('true');
  });

  test('Ionian compares as identical to major', async ({ page }) => {
    await page.goto('/modes.html?key=0&compare=true');
    await expect(page.locator('#compare-summary')).toContainText('identical');
    await expect(page.locator('.note.altered')).toHaveCount(0);
    await expect(page.locator('.note.parallel')).toHaveCount(0);
  });
});

test.describe('position filter', () => {
  test('dims notes outside a five-fret window anchored on the low-E root', async ({ page }) => {
    await page.goto('/index.html?key=7&pos=1');
    const inPosition = await page.locator('.note:not(.out-of-position)').count();
    const outOfPosition = await page.locator('.note.out-of-position').count();
    expect(inPosition).toBeGreaterThan(0);
    expect(outOfPosition).toBeGreaterThan(inPosition);
    const texts = new Set(await page.locator('.note:not(.out-of-position)').allTextContents());
    expect(texts.has('G')).toBe(true);
    await page.locator('#position').selectOption('all');
    await expect(page.locator('.note.out-of-position')).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has('pos')).toBe(false);
  });
});

test.describe('learning path', () => {
  test('marks a lesson level as learned, persists it, and shows the latest quiz score', async ({ page }) => {
    await page.goto('/modes.html');
    await expect(page.locator('#lesson-score')).toHaveText('No quiz result for this topic yet.');
    await expect(page.locator('#lesson-progress')).toHaveText('0 of 3 levels learned on this page.');
    await page.locator('#lesson-learned').click();
    await expect(page.locator('#lesson-learned')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#lesson-tab-beginner')).toHaveAttribute('aria-label', 'Beginner (learned)');
    await expect(page.locator('#lesson-progress')).toHaveText('1 of 3 levels learned on this page.');

    await page.evaluate(() => localStorage.setItem('fretboard-lab.quiz.v1', JSON.stringify({
      version: 1, settings: {}, history: [{ settings: { activity: 'modes' }, total: 10, correct: 8, assisted: 0, missed: {} }],
    })));
    await page.reload();
    await expect(page.locator('#lesson-learned')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#lesson-score')).toHaveText('Last modes quiz: 8/10 first-attempt correct (80%).');
    await page.locator('#lesson-tab-advanced').click();
    await expect(page.locator('#lesson-learned')).toHaveAttribute('aria-pressed', 'false');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fretboard-lab.lessons.v1')));
    expect(stored.learned).toEqual({ modes: { beginner: true } });
    expect(stored.levels).toEqual({ modes: 'advanced' });
  });
});

test.describe('print stylesheet', () => {
  test('hides chrome and fits the fretboard to the page', async ({ page }) => {
    await page.goto('/modes.html?key=2&mode=dorian');
    await page.emulateMedia({ media: 'print' });
    for (const selector of ['.topbar', '.hero', '.control-deck', '.stage-footer', '.play-button', '.lesson-tabs', '.site-footer', '.mode-details']) {
      expect(await page.locator(selector).first().evaluate(el => getComputedStyle(el).display), selector).toBe('none');
    }
    expect(await page.evaluate(() => {
      const grid = document.querySelector('.fb-grid');
      return grid.getBoundingClientRect().width <= grid.parentElement.getBoundingClientRect().width;
    })).toBe(true);
    expect(await page.locator('.mode-strip').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(4);
    await expect(page.locator('#lesson-body .lesson-title')).toBeVisible();
  });
});
