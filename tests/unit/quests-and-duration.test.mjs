import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('couple duration quest clamps days to 365 and repairs corrupt current > 365', async () => {
  const economySrc = await read('src/lib/economy.ts');

  assert.match(
    economySrc,
    /Math\.min\(365,\s*Math\.max\(0,\s*Math\.floor\(\(Date\.now\(\)\s*-\s*start\.getTime\(\)\)\s*\/\s*86400000\)\)\)/,
    'updateCoupleDurationQuest must clamp duration between 0 and 365 days'
  );

  assert.match(
    economySrc,
    /if\s*\(current\s*>\s*days\)\s*\{[\s\S]*'couple_duration\.current':\s*days/,
    'updateCoupleDurationQuest must reset corrupt current values exceeding days'
  );
});

test('QuestCard distinguishes individual claim status from partner status', async () => {
  const cardSrc = await read('src/components/QuestCard.tsx');

  assert.match(cardSrc, /const hasUserClaimed =/, 'QuestCard must check if current user claimed');
  assert.match(cardSrc, /const isWaitingForPartner = isUnclaimed && hasUserClaimed/, 'isWaitingForPartner must require that user already claimed');
  assert.doesNotMatch(cardSrc, /Réclamer encore/, 'QuestCard should never prompt user to re-claim already claimed tier');
});

test('streak unlocks are synced to inventory and isOwned checks inventory safely', async () => {
  const economySrc = await read('src/lib/economy.ts');
  const cosmeticsSrc = await read('src/data/cosmetics.ts');

  assert.match(economySrc, /syncStreakCosmetics/, 'economy.ts must provide syncStreakCosmetics to persist streak unlocks');
  assert.match(economySrc, /STREAK_UNLOCKS/, 'economy.ts must define streak unlocks');
  assert.match(cosmeticsSrc, /inventory\?\.backgrounds\?\.includes/, 'isOwned must safely verify inventory backgrounds');
});

test('unlimited questions progression strictly requires both partners to have answered', async () => {
  const unlimitedSrc = await read('src/components/UnlimitedQuestions.tsx');
  const economySrc = await read('src/lib/economy.ts');

  // Must check both answers exist before completing
  assert.match(
    unlimitedSrc,
    /if\s*\(!slotSnap\.exists\(\)\s*\|\|\s*!myAnswer\.exists\(\)\s*\|\|\s*!partnerAnswer\.exists\(\)\)\s*return;/,
    'completeUnlimitedQuestion must strictly require both answers to exist'
  );

  // Must not have recordCategoryAnswer advancing on single answer
  assert.doesNotMatch(
    unlimitedSrc,
    /recordCategoryAnswer/,
    'recordCategoryAnswer must not exist to prevent single-partner progress'
  );

  // Must preserve wallet progress and resolve category
  assert.match(
    economySrc,
    /resolveQuestionCategory/,
    'economy.ts must export resolveQuestionCategory'
  );
  assert.match(
    economySrc,
    /Math\.max\(mergedStats\[cat\]\s*\?\?\s*0,\s*count\)/,
    'syncUnlimitedStats must merge with Math.max to prevent wiping wallet progress'
  );
});

test('QuestCard and quests.tsx implement single-tap optimistic claim without double click', async () => {
  const cardSrc = await read('src/components/QuestCard.tsx');
  const questsSrc = await read('src/app/quests.tsx');

  assert.match(cardSrc, /optimisticClaimedTiers/, 'QuestCard must have optimisticClaimedTiers state');
  assert.match(cardSrc, /Boolean\(optimisticClaimedTiers\[viewTier\.tier\]\)/, 'hasUserClaimed must check optimisticClaimedTiers');
  assert.match(questsSrc, /setProgressMap\(\(prev\)\s*=>/, 'quests.tsx must optimistically update progressMap in handleClaim');
  assert.match(questsSrc, /onSnapshot\(doc\(db,\s*`couples\/\$\{cId\}\/quests\/progress`\)/, 'quests.tsx must listen to quests progress in real time');
});

