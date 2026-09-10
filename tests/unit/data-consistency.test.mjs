import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

const categoryIds = [
  'amour',
  'fun',
  'profond',
  'intime',
  'pile_ou_face',
  'famille',
  'debat',
  'futur',
  'souvenir',
  'reve',
  'quotidien',
  'defi',
];

const sourceFiles = {
  amour: 'QUESTIONS/Amour.txt',
  fun: 'QUESTIONS/Fun.txt',
  profond: 'QUESTIONS/Profond.txt',
  intime: 'QUESTIONS/Intime.txt',
  famille: 'QUESTIONS/Famille.txt',
  debat: 'QUESTIONS/Debat.txt',
  futur: 'QUESTIONS/Futur.txt',
  souvenir: 'QUESTIONS/Souvenir.txt',
  reve: 'QUESTIONS/Rêve.txt',
  quotidien: 'QUESTIONS/Quotidien.txt',
  defi: 'QUESTIONS/Defi.txt',
};

test('all dashboard categories have a matching unlock requirement', async () => {
  const dashboard = await read('src/app/dashboard.tsx');
  const unlimited = await read('src/components/UnlimitedQuestions.tsx');

  for (const category of categoryIds) {
    assert.match(dashboard, new RegExp(`id: '${category}'`), `dashboard category missing: ${category}`);
    assert.match(unlimited, new RegExp(`${category}:`), `unlock mapping missing: ${category}`);
  }
});

test('category unlock order is consistent between dashboard and unlimited screen', async () => {
  const dashboard = await read('src/app/dashboard.tsx');
  const unlimited = await read('src/components/UnlimitedQuestions.tsx');
  const dashboardRequirements = [...dashboard.matchAll(/id: '([^']+)'[^}]*requires: (null|'[^']+')/g)]
    .map((match) => [match[1], match[2].replaceAll("'", '')]);

  for (const [category, requirement] of dashboardRequirements) {
    const expected = requirement === 'null' ? 'null' : `'${requirement}'`;
    assert.match(unlimited, new RegExp(`${category}: ${expected}`), `unlock mismatch for ${category}`);
  }
});

test('compiled question data mirrors the TXT source files', async () => {
  const questions = await read('src/data/questions.ts');
  const pileOuFace = await read('src/data/pileouface.ts');

  for (const [category, sourceFile] of Object.entries(sourceFiles)) {
    const source = await read(sourceFile);
    const sourceIds = [...source.matchAll(/(?:["']id["']|id)\s*:\s*["']([^"']+)["']/g)].map((match) => match[1]);
    assert.ok(sourceIds.length >= 10, `source file is unexpectedly short: ${sourceFile}`);
    for (const id of sourceIds) {
      assert.match(questions, new RegExp(`"id":"${id}"`), `compiled question missing: ${id}`);
    }
    assert.match(questions, new RegExp(`category":"${category}"`), `compiled category missing: ${category}`);
  }
  assert.match(pileOuFace, /POF_QUESTIONS/, 'pile ou face question data is missing');
});

test('Firestore rules cover couple descendants and current user profile fields', async () => {
  const rules = await read('firestore.rules');
  assert.ok(rules.includes('match /couples/{coupleId}'));
  assert.ok(rules.includes('match /{document=**}'));
  assert.match(rules, /needsDate/);
  assert.match(rules, /isCoupleMember\(coupleId\)/);
});

test('question screens preserve the selected category on retry', async () => {
  const unlimited = await read('src/components/UnlimitedQuestions.tsx');
  assert.ok(unlimited.includes('encodeURIComponent(categoryFilter)'));
  assert.ok(unlimited.includes('/unlimited?category='));
});
