import { expect, test } from '@playwright/test';

test('scale controls update the fretboard and keep labeled keyboard access', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('status')).toContainText('note-accuracy self-test passed');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.locator('.skip-link')).toBeVisible();

  await expect(page.getByLabel('Root note')).toBeVisible();
  await page.getByLabel('Root note').selectOption('5');
  await page.getByLabel('Scale or mode').selectOption('natural_minor');
  await page.getByLabel('Fret range').fill('12');
  await page.getByLabel('Note spelling').selectOption('flats');
  await page.locator('label[for="show-all"]').click();

  await expect(page.locator('#scale-title')).toHaveText('F Natural minor (Aeolian)');
  await expect(page.locator('#scale-notes')).toHaveText('F  ·  G  ·  A♭  ·  B♭  ·  C  ·  D♭  ·  E♭');
  await expect(page.locator('#frets-out')).toHaveText('12');
  await expect(page.locator('#fretboard .fb-fretnum')).toHaveCount(13);
});

test('chord controls render interval-spelled notes and all qualities', async ({ page }) => {
  await page.goto('/chords.html');

  await expect(page.getByRole('status')).toContainText('chord-accuracy self-test passed');
  await expect(page.locator('.chord-card')).toHaveCount(9);
  await page.getByLabel('Root note').selectOption('0');
  await page.getByLabel('Note spelling').selectOption('flats');
  await page.getByLabel('Dot labels').selectOption('both');

  const c7 = page.locator('.chord-card').filter({ has: page.getByRole('heading', { name: /Dominant 7/ }) });
  await expect(c7.locator('.chord-notes')).toHaveText('C · E · G · B♭');
  await expect(c7.locator('.note[title="B♭ — ♭7"]').first()).toBeVisible();

  await page.getByLabel('Root note').selectOption('5');
  await page.getByLabel('Note spelling').selectOption('auto');
  await expect(page.getByText('F · A♭ · C♭', { exact: true })).toBeVisible();

  await page.getByLabel('Root note').selectOption('0');
  await expect(page.getByText('C · E♭ · G♭ · B♭♭', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Diminished 7/ })).toBeVisible();
});

test('mobile layout keeps page width contained and fretboard scrollable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const scaleWidths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    board: document.querySelector('#fretboard'),
  }));
  expect(scaleWidths.page).toBeLessThanOrEqual(scaleWidths.viewport);
  expect(await page.locator('#fretboard').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

  await page.goto('/chords.html');
  const chordWidths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(chordWidths.page).toBeLessThanOrEqual(chordWidths.viewport);
  await expect(page.getByLabel('Root note')).toBeVisible();
  await expect(page.locator('.chord-card').first()).toBeVisible();

  await page.goto('/progressions.html');
  const progressionWidths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(progressionWidths.page).toBeLessThanOrEqual(progressionWidths.viewport);
  await expect(page.locator('.progression-card').first()).toBeVisible();
});

test('progression view maps selected scale degrees to chords and Roman numerals', async ({ page }) => {
  await page.goto('/progressions.html');

  await expect(page.getByRole('status')).toContainText('chord-accuracy self-test passed');
  await expect(page.locator('.diatonic-card')).toHaveCount(7);
  await expect(page.locator('.diatonic-numeral')).toHaveText(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  await page.locator('#root').selectOption('0');
  await page.locator('#scale').selectOption('natural_minor');
  await page.locator('#chord-type').selectOption('sevenths');

  await expect(page.locator('#key-summary')).toHaveText('C Natural minor (Aeolian)');
  await expect(page.locator('.diatonic-numeral')).toHaveText(['i7', 'iiø7', 'IIImaj7', 'iv7', 'v7', 'VImaj7', 'VII7']);
  await expect(page.locator('.diatonic-notes').nth(0)).toHaveText('C · E♭ · G · B♭');
  await expect(page.locator('#progression-caption')).toHaveText('i7  →  v7  →  VImaj7  →  iv7');
  await expect(page.locator('.progression-card')).toHaveCount(4);
});
