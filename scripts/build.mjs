import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const commit = (process.env.COMMIT_SHA || process.env.GITHUB_SHA || 'local').trim();
const shortCommit = commit === 'local' ? 'local' : commit.slice(0, 7);
const version = (process.env.DEPLOY_VERSION || `v${packageJson.version}+${shortCommit}`).trim();
const versionPattern = /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

if (!versionPattern.test(version)) {
  throw new Error(`Invalid deployment version: ${version}`);
}

const publicFiles = [
  'index.html',
  'chords.html',
  'progressions.html',
  'modes.html',
  'styles.css',
  'theme.js',
  'fretboard.engine.js',
  'fretboard.js',
  'chords.js',
  'chord-fretboard.js',
  'progressions.js',
  'staticwebapp.config.json',
];
const versionMarker = /(<span class="site-version" data-app-version>)[^<]+(<\/span>)/;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of publicFiles) {
  const source = resolve(root, file);
  const destination = resolve(dist, file);

  if (file.endsWith('.html')) {
    const html = await readFile(source, 'utf8');
    if (!versionMarker.test(html)) {
      throw new Error(`Missing deployment version marker in ${file}`);
    }
    await writeFile(destination, html.replace(versionMarker, `$1${version}$2`), 'utf8');
  } else {
    await copyFile(source, destination);
  }
}

const metadata = {
  version,
  commit,
  source: 'Naytron/guitar-fretboard',
};
await writeFile(resolve(dist, 'version.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

console.log(`Built ${publicFiles.length + 1} public files for ${version}.`);
