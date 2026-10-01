import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('all PNG assets in assets/ have valid PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', async () => {
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await walk(full)));
      } else if (entry.name.endsWith('.png')) {
        results.push(full);
      }
    }
    return results;
  }

  const pngFiles = await walk(resolve(root, 'assets'));
  assert.ok(pngFiles.length > 10, 'Expected at least 10 PNG assets');

  for (const file of pngFiles) {
    const buf = await readFile(file);
    const header = buf.subarray(0, 8).toString('hex');
    assert.equal(
      header,
      '89504e470d0a1a0a',
      `File ${file} has extension .png but invalid PNG header ${header}`
    );
  }
});

test('contact helper defines CONTACT_EMAIL and openContactEmail', async () => {
  const contactSrc = await read('src/lib/contact.ts');

  assert.match(contactSrc, /nousdeux\.app\.contact@gmail\.com/, 'Must declare official contact email');
  assert.match(contactSrc, /export async function openContactEmail/, 'Must export openContactEmail');
  assert.match(contactSrc, /expo-clipboard/, 'Must provide fallback to clipboard when mail app cannot be opened');
});

test('terms.tsx renders clickable contact email and ContactEmailLink', async () => {
  const termsSrc = await read('src/app/terms.tsx');

  assert.match(termsSrc, /ContactEmailLink/, 'terms.tsx must render ContactEmailLink component');
  assert.match(termsSrc, /openContactEmail/, 'terms.tsx must invoke openContactEmail on press');
  assert.match(termsSrc, /nousdeux\.app\.contact@gmail\.com/, 'terms.tsx must display contact email');
});

test('privacy.tsx renders clickable contact email and ContactEmailLink across all contact sections', async () => {
  const privacySrc = await read('src/app/privacy.tsx');

  assert.match(privacySrc, /ContactEmailLink/, 'privacy.tsx must render ContactEmailLink component');
  assert.match(privacySrc, /openContactEmail/, 'privacy.tsx must invoke openContactEmail on press');
  assert.match(privacySrc, /nousdeux\.app\.contact@gmail\.com/, 'privacy.tsx must display contact email');
});

test('contact.tsx provides direct email contact option', async () => {
  const contactSrc = await read('src/app/contact.tsx');

  assert.match(contactSrc, /ContactEmailLink/, 'contact.tsx must render ContactEmailLink component');
  assert.match(contactSrc, /directContactBox/, 'contact.tsx must render directContactBox');
});

test('settings.tsx links to contact screen without exposing direct email row', async () => {
  const settingsSrc = await read('src/app/settings.tsx');

  assert.match(settingsSrc, /\/contact/, 'settings.tsx must link to contact screen');
  assert.ok(!settingsSrc.includes('CONTACT_EMAIL'), 'settings.tsx must not show direct contact email');
});

test('build-android workflow validates PNG assets with pngcheck before expo prebuild', async () => {
  const workflowSrc = await read('.github/workflows/build-android.yml');

  assert.match(workflowSrc, /pngcheck -v assets\/images\/nousdeux_dark_background\.png/, 'Workflow must validate dark background PNG');
  assert.match(workflowSrc, /Validate Android image assets/, 'Workflow must have Validate Android image assets step');
});
