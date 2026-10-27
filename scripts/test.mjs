import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { CHORDS, MODES, SCALES, modeStepPattern, runChordSelfTest, runSelfTest } = require(resolve(root, 'fretboard.engine.js'));
const patterns = ['WWHWWWH', 'WHWWWHW', 'HWWWHWW', 'WWWHWWH', 'WWHWWHW', 'WHWWHWW', 'HWWHWWW'];
Object.keys(MODES).forEach((key, index) => {
  const pattern = modeStepPattern(SCALES[key].steps);
  assert.equal(pattern.join(''), patterns[index], `${key} modal pattern including octave return`);
  assert.equal(pattern.reduce((total, step) => total + (step === 'W' ? 2 : 1), 0), 12);
});
const suites = [
  ['note engine', runSelfTest()],
  ['chord engine', runChordSelfTest()],
];
let failed = false;

for (const [name, suite] of suites) {
  for (const result of suite.results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${name}: ${result.label}`);
  }
  failed ||= !suite.passed;
}

if (Object.keys(CHORDS).length !== 9) {
  console.error(`FAIL chord catalog: expected 9 qualities, found ${Object.keys(CHORDS).length}`);
  failed = true;
}

const JavaScriptFiles = [
  'theme.js',
  'fretboard.engine.js',
  'fretboard.js',
  'chords.js',
  'chord-fretboard.js',
  'progressions.js',
  'scripts/build.mjs',
  'scripts/test.mjs',
  'scripts/verify-dist.mjs',
  'playwright.config.mjs',
  'tests/fretboard.spec.mjs',
];

for (const file of JavaScriptFiles) {
  const check = spawnSync(process.execPath, ['--check', resolve(root, file)], {
    encoding: 'utf8',
  });
  if (check.status !== 0) {
    console.error(`FAIL syntax: ${file}\n${check.stderr.trim()}`);
    failed = true;
  } else {
    console.log(`PASS syntax: ${file}`);
  }
}

for (const file of ['index.html', 'chords.html', 'progressions.html', 'modes.html']) {
  const html = await readFile(resolve(root, file), 'utf8');
  const hasVersion = html.includes('class="site-version" data-app-version');
  const hasInlineScript = /<script(?![^>]*\bsrc=)[^>]*>/i.test(html);
  const hasInlineStyle = /<style\b/i.test(html);

  if (!hasVersion || hasInlineScript || hasInlineStyle) {
    console.error(
      `FAIL page shell: ${file} (version=${hasVersion}, inlineScript=${hasInlineScript}, inlineStyle=${hasInlineStyle})`,
    );
    failed = true;
  } else {
    console.log(`PASS page shell: ${file}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log('All fretboard tests passed.');
