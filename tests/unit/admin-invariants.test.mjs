import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('all admin UIDs in admins.ts are declared in firestore.rules', async () => {
  const adminsSource = await read('src/constants/admins.ts');
  const firestoreRules = await read('firestore.rules');

  const matches = [...adminsSource.matchAll(/'([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]);
  assert.ok(matches.length >= 5, 'Should have at least 5 admin UIDs configured');

  for (const uid of matches) {
    assert.ok(
      firestoreRules.includes(`request.auth.uid == '${uid}'`),
      `firestore.rules does not include admin UID: ${uid}`
    );
  }
});

test('settings.tsx and admin.tsx import unified admin constants', async () => {
  const settings = await read('src/app/settings.tsx');
  const admin = await read('src/app/admin.tsx');

  assert.match(settings, /from '@\/constants\/admins'/, 'settings.tsx must import from admins.ts');
  assert.match(admin, /from '\.\.\/constants\/admins'/, 'admin.tsx must import from admins.ts');
});

test('admin.tsx provides couple deletion mechanism and unlinks partners', async () => {
  const admin = await read('src/app/admin.tsx');

  assert.match(admin, /deleteCouplePermanently/, 'admin.tsx must define deleteCouplePermanently');
  assert.match(admin, /deleteDoc\(doc\(db, 'couples', cId\)\)/, 'admin.tsx must delete couple document');
  assert.match(admin, /linkedTo:\s*null/, 'admin.tsx must unlink partner accounts');
  assert.match(admin, /Supprimer définitivement/, 'admin.tsx must provide delete couple confirmation');
});

test('UnlimitedQuestions uses unified theme in global mode and category colors when filtered', async () => {
  const unlimitedSrc = await read('src/components/UnlimitedQuestions.tsx');

  assert.match(unlimitedSrc, /categoryFilter\s*\?\s*catInfo\.title\s*:\s*`ILLIMITÉ · \$\{currentQuestionCatInfo\.title\}`/, 'must show category title when filtered and ILLIMITÉ · theme when global');
  assert.match(unlimitedSrc, /headerColors\s*=\s*categoryFilter\s*\?\s*\(catInfo\.colors/, 'must use category colors when filtered');
  assert.match(unlimitedSrc, /\['#A855F7', '#D946EF'\]/, 'must use unified purple colors when not filtered');
});

test('admin.tsx provides user listing and permanent deletion mechanism', async () => {
  const admin = await read('src/app/admin.tsx');

  assert.match(admin, /deleteUserPermanently/, 'admin.tsx must define deleteUserPermanently');
  assert.match(admin, /UsersTab/, 'admin.tsx must define UsersTab');
  assert.match(admin, /deleteDoc\(doc\(db, 'users', uid\)\)/, 'admin.tsx must delete user document');
});

