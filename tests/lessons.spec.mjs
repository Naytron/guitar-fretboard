import { test, expect } from '@playwright/test';

const pages = {
  scales: '/index.html',
  chords: '/chords.html',
  progressions: '/progressions.html',
  modes: '/modes.html',
};

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

for (const [name, path] of Object.entries(pages)) {
  test(`${name} page renders a three-level lesson panel without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveText(['Beginner', 'Intermediate', 'Advanced']);
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#lesson-body .lesson-title')).not.toBeEmpty();
    await expect(page.locator('#lesson-body .lesson-model')).toContainText('Mental model');
    await expect(page.locator('#lesson-body .lesson-quiz')).toHaveAttribute('href', /^quiz\.html\?/);
    expect(errors).toEqual([]);
  });
}

test('lesson tabs switch by click and arrow keys and remember the level per page', async ({ page }) => {
  await page.goto('/index.html');
  const beginnerTitle = await page.locator('.lesson-title').textContent();
  await page.getByRole('tab', { name: 'Intermediate' }).click();
  await expect(page.getByRole('tab', { name: 'Intermediate' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.lesson-title')).not.toHaveText(beginnerTitle);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Advanced' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Advanced' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Beginner' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Advanced' })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Advanced' })).toHaveAttribute('aria-selected', 'true');
  await page.goto('/chords.html');
  await expect(page.getByRole('tab', { name: 'Beginner' })).toHaveAttribute('aria-selected', 'true');
});

test('lesson text follows the selected key and scale', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#lesson-body')).toContainText('G major');
  await page.selectOption('#root', '0');
  await page.selectOption('#scale', 'natural_minor');
  await expect(page.locator('#lesson-body')).toContainText('C natural minor');
  await expect(page.locator('#lesson-body')).not.toContainText('G major');
});

test('quiz link lands on Quiz with the lesson presets applied', async ({ page }) => {
  await page.goto('/chords.html');
  await page.selectOption('#root', '2');
  await page.getByRole('tab', { name: 'Intermediate' }).click();
  const href = await page.locator('.lesson-quiz').getAttribute('href');
  expect(href).toContain('activity=chords');
  expect(href).toContain('key=2');
  expect(href).toContain('advanced=true');
  await page.locator('.lesson-quiz').click();
  await expect(page).toHaveURL(/quiz\.html\?/);
  await expect(page.getByRole('button', { name: 'Chord tones', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#quiz-key')).toHaveValue('2');
  await expect(page.locator('#quiz-advanced')).toHaveValue('true');
});

test('mode strip lists seven modes in order and selects a mode with its degree and parent key', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/modes.html');
  const chips = page.locator('#mode-strip .mode-chip');
  await expect(chips.locator('.mode-chip-name')).toHaveText(['Ionian (major)', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian (natural minor)', 'Locrian']);
  await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#mode-relation')).toContainText('G Ionian (major) is degree 1 of G major');
  await expect(chips.nth(1).locator('.mode-chip-pattern')).toHaveText('W H W W W H W');

  await chips.nth(1).click();
  await expect(page.locator('#scale')).toHaveValue('dorian');
  await expect(page.locator('#root')).toHaveValue('9');
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#mode-relation')).toContainText('A Dorian is degree 2 of G major');
  await expect(page.locator('#lesson-body')).toContainText('Dorian');

  await page.selectOption('#root', '4');
  await page.selectOption('#scale', 'phrygian');
  await expect(page.locator('#mode-relation')).toContainText('E Phrygian is degree 3 of C major');
  await expect(chips.nth(2)).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('mode strip supports roving arrow-key focus', async ({ page }) => {
  await page.goto('/modes.html');
  const chips = page.locator('#mode-strip .mode-chip');
  await chips.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(chips.nth(1)).toBeFocused();
  await page.keyboard.press('End');
  await expect(chips.nth(6)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(chips.nth(0)).toBeFocused();
});

for (const width of [375, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`modes page with lessons has no horizontal overflow at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/modes.html?scoutTheme=${theme}`);
      await expect(page.locator('#lesson-body .lesson-title')).not.toBeEmpty();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}
