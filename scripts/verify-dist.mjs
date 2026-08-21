import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const expectedFiles = [
  'chords.html',
  'chords.js',
  'fretboard.engine.js',
  'fretboard.js',
  'index.html',
  'staticwebapp.config.json',
  'styles.css',
  'theme.js',
  'version.json',
];
const entries = await readdir(dist, { withFileTypes: true });
const actualFiles = entries.map((entry) => entry.name).sort();

if (entries.some((entry) => !entry.isFile())) {
  throw new Error('The deployment artifact must contain files only.');
}

if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(
    `Unexpected deployment boundary.\nExpected: ${expectedFiles.join(', ')}\nActual: ${actualFiles.join(', ')}`,
  );
}

const metadata = JSON.parse(await readFile(resolve(dist, 'version.json'), 'utf8'));
if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(metadata.version)) {
  throw new Error(`Invalid version.json label: ${metadata.version}`);
}
if (metadata.source !== 'Naytron/guitar-fretboard') {
  throw new Error(`Unexpected version.json source: ${metadata.source}`);
}

for (const file of ['index.html', 'chords.html']) {
  const html = await readFile(resolve(dist, file), 'utf8');
  const label = `<span class="site-version" data-app-version>${metadata.version}</span>`;
  if (!html.includes(label)) {
    throw new Error(`${file} does not contain deployment label ${metadata.version}`);
  }

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const reference = match[1].split('#', 1)[0].split('?', 1)[0];
    if (!reference || reference.startsWith('#') || /^[a-z]+:/i.test(reference)) continue;
    if (!actualFiles.includes(reference)) {
      throw new Error(`${file} references missing artifact ${reference}`);
    }
  }
}

const swaConfig = JSON.parse(await readFile(resolve(dist, 'staticwebapp.config.json'), 'utf8'));
if (!swaConfig.globalHeaders?.['Content-Security-Policy']?.includes("script-src 'self'")) {
  throw new Error('Static Web Apps content security policy is missing.');
}

console.log(`Verified deployment boundary and version label ${metadata.version}.`);
