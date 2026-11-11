import { expect, test } from '@playwright/test';

if (process.env.MOBILE_PRACTICE_BASE_URL) {
  test.use({ baseURL: process.env.MOBILE_PRACTICE_BASE_URL });
}

const views = ['index', 'chords', 'modes', 'progressions'];

test.use({ viewport: { width: 375, height: 900 } });

for (const theme of ['light', 'dark']) {
  for (const view of views) {
    test(`${view} shows its first complete string in the mobile ${theme} viewport`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`/${view}.html?scoutTheme=${theme}`);
      await expect(page.getByRole('status')).toContainText('self-test passed');

      const firstString = await page.locator('.fb-string-label').first().boundingBox();
      expect(firstString.y).toBeGreaterThan(0);
      expect(firstString.y + firstString.height).toBeLessThanOrEqual(900);
      await expect(page.locator('.practice-settings')).not.toHaveAttribute('open', '');
      await expect(page.locator('#root')).toBeVisible();
      if (view !== 'chords') await expect(page.locator('#scale')).toBeVisible();
      if (view === 'progressions') await expect(page.locator('#progression')).toBeVisible();

      const guitar = page.getByRole('img', { name: 'Sunburst Les Paul electric guitar' });
      await expect(guitar).toBeVisible();
      expect(await guitar.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);

      const fontSizes = await page.locator('.fb-fretnum, .fb-string-label, .note, .note small')
        .evaluateAll(elements => elements.map(element => parseFloat(getComputedStyle(element).fontSize)));
      expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(14);

      const nav = page.getByRole('navigation', { name: 'Diagram type' });
      await expect(nav.getByRole('link')).toHaveCount(5);
      await expect(nav.getByRole('link', { name: '05 Quiz' })).toHaveAttribute('href', 'quiz.html');
      for (const link of await nav.getByRole('link').all()) {
        await expect(link).toBeInViewport();
        await link.focus();
        await expect(link).toBeFocused();
        const bounds = await link.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.width).toBeGreaterThanOrEqual(44);
      }

      const targetHeights = await page.locator('select:visible, summary:visible')
        .evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
      expect(Math.min(...targetHeights)).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

for (const view of views) {
  test(`${view} keeps edited settings and native range behavior when the disclosure closes`, async ({ page }) => {
    await page.goto(`/${view}.html`);
    const settings = page.locator('.practice-settings');
    const summary = settings.locator('summary');
    await expect(page.locator('#frets')).not.toBeVisible();
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(settings).toHaveAttribute('open', '');

    await page.locator('#root').selectOption('5');
    await page.getByLabel('Note spelling').selectOption('flats');
    const range = page.getByLabel('Fret range');
    const maximum = Number(await range.getAttribute('max'));
    await range.fill(String(maximum));
    await range.focus();
    await page.keyboard.press('ArrowLeft');
    const frets = String(maximum - 1);
    await expect(range).toHaveValue(frets);
    await expect(page.locator('#frets-out')).toHaveText(frets);
    await expect(page.locator('.fb-grid').first().locator('.fb-fretnum')).toHaveCount(Number(frets) + 1);

    if (view === 'chords' || view === 'progressions') {
      await page.getByLabel('Dot labels').selectOption('intervals');
    } else {
      await page.locator('label[for="show-all"]').click();
    }
    if (view === 'progressions') {
      await page.getByLabel('Chord tones').selectOption('sevenths');
      await page.getByLabel('Progression pattern').selectOption('2,5,1');
      await expect(page.locator('.progression-card')).toHaveCount(3);
    }

    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(range).not.toBeVisible();
    await expect(page.locator('#root')).toHaveValue('5');
    await expect(range).toHaveValue(frets);
    await summary.press('Enter');
    await expect(range).toBeVisible();
    await expect(page.getByLabel('Note spelling')).toHaveValue('flats');
    if (view === 'chords' || view === 'progressions') {
      await expect(page.getByLabel('Dot labels')).toHaveValue('intervals');
    } else {
      await expect(page.locator('#show-all')).toBeChecked();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('chord necks have labeled keyboard scroll regions without scrolling their headings', async ({ page }) => {
  await page.goto('/chords.html');
  await expect(page.locator('.chord-fretboard')).toHaveCount(9);
  const neck = page.getByRole('region', { name: 'C Major fretboard, scroll for more frets', exact: true });
  const heading = page.locator('.chord-head').first();
  const initialHeadingLeft = await heading.evaluate(element => element.getBoundingClientRect().left);
  expect(await neck.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await neck.focus();
  await expect(neck).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => neck.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  expect(await heading.evaluate(element => element.getBoundingClientRect().left)).toBe(initialHeadingLeft);

  await page.locator('#root').selectOption('5');
  await expect(page.getByRole('region', { name: 'F Major fretboard, scroll for more frets', exact: true }))
    .toHaveAttribute('tabindex', '0');
});

test('the selected progression precedes a keyboard-accessible seven-chord reference', async ({ page }) => {
  await page.goto('/progressions.html');
  const reference = page.locator('.reference-details');
  await expect(reference).not.toHaveAttribute('open', '');
  await expect(page.locator('#diatonic-heading')).not.toBeVisible();
  expect(await page.locator('#progression-map').evaluate(element => Boolean(
    element.compareDocumentPosition(document.querySelector('.reference-details')) & Node.DOCUMENT_POSITION_FOLLOWING
  ))).toBe(true);
  await reference.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#diatonic-heading')).toBeVisible();
  await expect(page.locator('.diatonic-card')).toHaveCount(7);
  await reference.locator('summary').press('Enter');
  await expect(page.locator('#diatonic-heading')).not.toBeVisible();
  await expect(page.locator('.progression-card')).toHaveCount(4);
});

test('skip links are exposed only while focused, including after scrolling to controls', async ({ page }) => {
  for (const view of views) {
    await page.goto(`/${view}.html`);
    const skip = page.locator('.skip-link');
    await expect(skip).toHaveCSS('clip-path', 'inset(50%)');
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await expect(skip).toHaveCSS('clip-path', 'none');
    await expect(skip).toBeInViewport();
    await page.locator('#root').focus();
    await expect(skip).not.toBeFocused();
    await expect(skip).toHaveCSS('clip-path', 'inset(50%)');
  }
});

test('responsive defaults keep desktop settings available and all five navigation links contained', async ({ page }) => {
  for (const width of [320, 600, 601, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of views) {
      await page.goto(`/${view}.html`);
      const settings = page.locator('.practice-settings');
      await expect(settings).toHaveJSProperty('open', width > 600);
      if (width > 600) await expect(page.getByLabel('Fret range')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const navBounds = await page.locator('.site-nav a').evaluateAll(elements => elements.map(element => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right };
      }));
      expect(navBounds.every(bounds => bounds.left >= 0 && bounds.right <= width)).toBe(true);
    }
  }
  await page.goto('/progressions.html');
  await expect(page.locator('.reference-details')).toHaveJSProperty('open', true);
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.locator('.practice-settings')).toHaveJSProperty('open', false);
  await expect(page.locator('.reference-details')).toHaveJSProperty('open', false);
  await page.locator('.practice-settings summary').click();
  await page.getByLabel('Fret range').fill('18');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.practice-settings')).toHaveJSProperty('open', true);
  await expect(page.getByLabel('Fret range')).toHaveValue('18');
});
