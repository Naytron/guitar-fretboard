import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const {
  CHORDS,
  SCALES,
  diatonicTriads,
  runChordSelfTest,
  runDiatonicSelfTest,
  runSelfTest,
} = require(resolve(root, 'fretboard.engine.js'));
const suites = [
  ['note engine', runSelfTest()],
  ['chord engine', runChordSelfTest()],
  ['diatonic progression engine', runDiatonicSelfTest()],
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

const expectedQualities = {
  major: ['Major', 'Minor', 'Minor', 'Major', 'Major', 'Minor', 'Diminished'],
  natural_minor: ['Minor', 'Diminished', 'Major', 'Minor', 'Minor', 'Major', 'Major'],
};

for (const scaleKey of Object.keys(expectedQualities)) {
  const scale = SCALES[scaleKey];
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    const triads = diatonicTriads(rootPc, scaleKey);
    const scalePitchClasses = new Set(scale.steps.map((step) => (rootPc + step) % 12));
    const valid = triads.length === 7 &&
      triads.every((chord, index) =>
        chord.degree === index + 1 &&
        chord.notes.length === 3 &&
        chord.quality === expectedQualities[scaleKey][index] &&
        chord.notes.every((note) => scalePitchClasses.has(note)),
      );
    if (!valid) {
      console.error(`FAIL ${scaleKey} triads for pitch class ${rootPc}: unexpected degree, quality, or chord tone`);
      failed = true;
    }
  }
}

for (const [rootPc, scaleKey] of [[-1, 'major'], [12, 'major'], [0, 'dorian']]) {
  let rejected = false;
  try {
    diatonicTriads(rootPc, scaleKey);
  } catch (error) {
    rejected = error instanceof RangeError;
  }
  if (!rejected) {
    console.error(`FAIL progression validation: accepted root ${rootPc} and scale ${scaleKey}`);
    failed = true;
  }
}

const JavaScriptFiles = [
  'theme.js',
  'fretboard.engine.js',
  'fretboard.js',
  'chords.js',
  'progression.js',
  'scripts/build.mjs',
  'scripts/test.mjs',
  'scripts/verify-dist.mjs',
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

for (const file of ['index.html', 'chords.html', 'progression.html']) {
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
