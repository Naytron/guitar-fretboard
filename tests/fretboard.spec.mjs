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
  const neck = page.locator('.progression-fretboard').first();
  expect(await neck.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await neck.focus();
  await expect(neck).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => neck.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
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

async function expectProgressionPositions(page, chords, frets = 12, labelMode = 'notes') {
  const necks = page.locator('.progression-fretboard');
  await expect(necks).toHaveCount(chords.length);
  for (const [index, tones] of chords.entries()) {
    const neck = necks.nth(index);
    await expect(neck.locator('.fb-fretnum')).toHaveCount(frets + 1);
    await expect(neck.locator('.fb-string-label')).toHaveText(['1 · e', '2 · B', '3 · G', '4 · D', '5 · A', '6 · E']);
    const actual = await neck.locator('.fb-cell').evaluateAll((cells) => cells.map((cell) => {
      const dot = cell.querySelector('.note');
      return dot ? {
        text: dot.textContent,
        title: dot.title,
        root: dot.classList.contains('is-root'),
        label: dot.getAttribute('aria-label'),
      } : null;
    }));
    const expected = [4, 11, 7, 2, 9, 4].flatMap((openPc, string) => (
      Array.from({ length: frets + 1 }, (_, fret) => {
        const tone = tones.find(([pc]) => pc === (openPc + fret) % 12);
        if (!tone) return null;
        const [, name, interval] = tone;
        return {
          text: labelMode === 'intervals' ? interval : labelMode === 'both' ? `${name}${interval}` : name,
          title: `${name} — ${interval}`,
          root: interval === 'R',
          label: `String ${string + 1}, fret ${fret}: ${name}, ${interval}`,
        };
      })
    ));
    expect(actual).toEqual(expected);
  }
}

test('progression fretboards show the exact chord tones at every string and fret', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/progressions.html');
  await expectProgressionPositions(page, [
    [[7, 'G', 'R'], [11, 'B', '3'], [2, 'D', '5']],
    [[2, 'D', 'R'], [6, 'F♯', '3'], [9, 'A', '5']],
    [[4, 'E', 'R'], [7, 'G', '♭3'], [11, 'B', '5']],
    [[0, 'C', 'R'], [4, 'E', '3'], [7, 'G', '5']],
  ]);

  await page.locator('#root').selectOption('0');
  await page.locator('#scale').selectOption('natural_minor');
  await page.locator('#chord-type').selectOption('sevenths');
  await page.locator('#spelling').selectOption('flats');
  await page.getByLabel('Dot labels').selectOption('both');
  const minorSequence = [
    [[0, 'C', 'R'], [3, 'E♭', '♭3'], [7, 'G', '5'], [10, 'B♭', '♭7']],
    [[7, 'G', 'R'], [10, 'B♭', '♭3'], [2, 'D', '5'], [5, 'F', '♭7']],
    [[8, 'A♭', 'R'], [0, 'C', '3'], [3, 'E♭', '5'], [7, 'G', '7']],
    [[5, 'F', 'R'], [8, 'A♭', '♭3'], [0, 'C', '5'], [3, 'E♭', '♭7']],
  ];
  await expectProgressionPositions(page, minorSequence, 12, 'both');
  await page.getByLabel('Fret range').fill('24');
  await expect(page.locator('#frets-out')).toHaveText('24');
  await expectProgressionPositions(page, minorSequence, 24, 'both');

  await page.getByLabel('Dot labels').selectOption('intervals');
  await page.locator('#progression').selectOption('2,5,1');
  await expectProgressionPositions(page, [
    [[2, 'D', 'R'], [5, 'F', '♭3'], [8, 'A♭', '♭5'], [0, 'C', '♭7']],
    minorSequence[1],
    minorSequence[0],
  ], 24, 'intervals');
  expect(pageErrors).toEqual([]);
});

test('modes show all seven complete step patterns and matching fretboard positions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '04 Modes' }).click();
  await expect(page.locator('#scale option')).toHaveCount(7);
  const modes = [
    ['major', 'W W H W W W H', [0, 2, 4, 5, 7, 9, 11]],
    ['dorian', 'W H W W W H W', [0, 2, 3, 5, 7, 9, 10]],
    ['phrygian', 'H W W W H W W', [0, 1, 3, 5, 7, 8, 10]],
    ['lydian', 'W W W H W W H', [0, 2, 4, 6, 7, 9, 11]],
    ['mixolydian', 'W W H W W H W', [0, 2, 4, 5, 7, 9, 10]],
    ['natural_minor', 'W H W W H W W', [0, 2, 3, 5, 7, 8, 10]],
    ['locrian', 'H W W H W W W', [0, 1, 3, 5, 6, 8, 10]],
  ];
  await page.locator('#root').selectOption('0');
  for (const [mode, pattern, pitches] of modes) {
    await page.locator('#scale').selectOption(mode);
    await expect(page.locator('#mode-pattern')).toHaveText(pattern);
    await expect(page.locator('#mode-steps li')).toHaveCount(7);
    await expect(page.locator('#mode-steps li').last().locator('strong').last()).toHaveText('C');
    const actual = await page.locator('#fretboard .fb-cell').evaluateAll(cells => cells.map(cell => ({
      note: Boolean(cell.querySelector('.note')),
      root: Boolean(cell.querySelector('.root')),
    })));
    const expected = [4, 11, 7, 2, 9, 4].flatMap(open => Array.from({ length: 16 }, (_, fret) => ({
      note: pitches.includes((open + fret) % 12),
      root: (open + fret) % 12 === 0,
    })));
    expect(actual).toEqual(expected);
  }
  await page.locator('#root').selectOption('7');
  await page.locator('#scale').selectOption('dorian');
  await expect(page.locator('#scale-notes')).toHaveText('G  ·  A  ·  B♭  ·  C  ·  D  ·  E  ·  F');
  await page.getByLabel('Fret range').fill('24');
  await expect(page.locator('#fretboard .fb-fretnum')).toHaveCount(25);
  await page.locator('label[for="show-all"]').click();
  await expect(page.locator('#fretboard .note')).toHaveCount(150);
  await page.locator('#root').selectOption('1');
  await page.locator('#spelling').selectOption('sharps');
  await expect(page.locator('#scale-title')).toHaveText('C♯ Dorian');
  await page.locator('#spelling').selectOption('flats');
  await expect(page.locator('#scale-title')).toHaveText('D♭ Dorian');
  await expect(page.locator('#mode-pattern')).toHaveText('W H W W W H W');

  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByRole('link', { name: '04 Modes' })).toBeVisible();
  const board = page.locator('#fretboard');
  await board.focus();
  await expect(board).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => board.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
});
