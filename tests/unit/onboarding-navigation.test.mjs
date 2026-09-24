import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('onboarding pseudo screen preserves local state before submit and has back button', async () => {
  const pseudoSrc = await read('src/app/onboarding/pseudo.tsx');

  // Must use local state so typing does not trigger global store redirects
  assert.match(pseudoSrc, /const \[localPseudo,\s*setLocalPseudo\]\s*=\s*useState/, 'pseudo.tsx must use local state for pseudo input');
  // Back button should navigate back or to /onboarding/login
  assert.match(pseudoSrc, /router\.replace\('\/onboarding\/login'\)/, 'pseudo.tsx must have a fallback back navigation to /onboarding/login');
  assert.match(pseudoSrc, /ArrowLeft/, 'pseudo.tsx must render ArrowLeft back button');
});

test('onboarding sync screen has back button leading to avatar and safe background color', async () => {
  const syncSrc = await read('src/app/onboarding/sync.tsx');

  assert.match(syncSrc, /router\.replace\('\/onboarding\/avatar'\)/, 'sync.tsx back button must lead to /onboarding/avatar');
  assert.match(syncSrc, /ArrowLeft/, 'sync.tsx must render ArrowLeft back button');
  assert.match(syncSrc, /#FFF5F2/, 'sync.tsx must have warm background color fallback to prevent white borders on zoom');
});

test('onboarding date screen has back button and dateMismatch real-time sync', async () => {
  const dateSrc = await read('src/app/onboarding/date.tsx');

  assert.match(dateSrc, /router\.replace\('\/onboarding\/sync'\)/, 'date.tsx back button must lead to /onboarding/sync');
  assert.match(dateSrc, /ArrowLeft/, 'date.tsx must render ArrowLeft back button');
  assert.match(dateSrc, /dateMismatch/, 'date.tsx must synchronize dateMismatch between partners');
  assert.match(dateSrc, /#FFF5F2/, 'date.tsx must have warm background color fallback to prevent white borders on zoom');
});

test('_layout.tsx avoids aggressive auto-redirects between onboarding subpages', async () => {
  const layoutSrc = await read('src/app/_layout.tsx');

  // _layout should not aggressively redirect users while they are filling out onboarding subpages
  assert.doesNotMatch(
    layoutSrc,
    /else if \(!store\.age\) \{ router\.replace\('\/onboarding\/age'\); \}/,
    '_layout.tsx should not redirect directly to /onboarding/age during onboarding input'
  );
  // _layout must synchronize profile from Firestore to prevent forcing onboarding on new tab/browser
  assert.match(layoutSrc, /doc\(db,\s*'users',\s*user\.uid\)/, '_layout.tsx must load users document upon auth restoration');
});

test('sync.tsx prevents self-pairing and persists pairing code to users document', async () => {
  const syncSrc = await read('src/app/onboarding/sync.tsx');
  const questsSrc = await read('src/app/quests.tsx');

  assert.match(syncSrc, /partnerUid === myUid/, 'sync.tsx must prevent user from pairing with their own code');
  assert.match(syncSrc, /pairingCode/, 'sync.tsx must persist and reuse user pairingCode');
  assert.match(questsSrc, /import\s*\{[^}]*auth[^}]*\}\s*from\s*'\.\.\/lib\/firebase'/, 'quests.tsx must import auth from firebase');
});
