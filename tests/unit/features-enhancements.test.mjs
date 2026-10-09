import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relPath) => fs.readFile(path.join(root, relPath), 'utf-8');

test('ForceUpdateModal listens to app_config and blocks outdated versions with store links', async () => {
  const modalSrc = await read('src/components/ForceUpdateModal.tsx');
  const layoutSrc = await read('src/app/_layout.tsx');
  const rulesSrc = await read('firestore.rules');

  assert.match(modalSrc, /doc\(db,\s*'app_config',\s*'global'\)/, 'ForceUpdateModal must listen to app_config/global');
  assert.match(modalSrc, /play\.google\.com/, 'ForceUpdateModal must include Google Play link');
  assert.match(modalSrc, /apps\.apple\.com/, 'ForceUpdateModal must include App Store link');
  assert.match(modalSrc, /MISE À JOUR OBLIGATOIRE/, 'ForceUpdateModal must display mandatory update notice');

  assert.match(layoutSrc, /import ForceUpdateModal/, '_layout.tsx must import ForceUpdateModal');
  assert.match(layoutSrc, /<ForceUpdateModal\s*\/>/, '_layout.tsx must render ForceUpdateModal at root');

  assert.match(rulesSrc, /match\s+\/app_config\/\{configId\}/, 'firestore.rules must allow reading app_config');
});

test('economy.ts and dashboard.tsx implement streak restoration for 2000 petals', async () => {
  const economySrc = await read('src/lib/economy.ts');
  const dashboardSrc = await read('src/app/dashboard.tsx');

  assert.match(economySrc, /export const STREAK_RESTORE_COST = 2000/, 'STREAK_RESTORE_COST must be exactly 2000 petals');
  assert.match(economySrc, /export async function checkStreakRestorable/, 'checkStreakRestorable must be exported');
  assert.match(economySrc, /export async function restoreLostStreak/, 'restoreLostStreak must be exported');

  assert.match(dashboardSrc, /checkStreakRestorable/, 'dashboard.tsx must check for lost streak on mount');
  assert.match(dashboardSrc, /restoreLostStreak/, 'dashboard.tsx must handle restoring lost streak');
  assert.match(dashboardSrc, /Restaure ta flamme/, 'dashboard.tsx must display streak restoration offer banner');
  assert.match(dashboardSrc, /2\s*000/, 'dashboard.tsx must display 2000 petals cost');
});

test('Daylink and UnlimitedQuestions support swipe-up gestures to submit or advance', async () => {
  const daylinkSrc = await read('src/components/Daylink.tsx');
  const unlimitedSrc = await read('src/components/UnlimitedQuestions.tsx');

  assert.match(daylinkSrc, /onTouchStart/, 'Daylink must register onTouchStart for swipe detection');
  assert.match(daylinkSrc, /onTouchEnd/, 'Daylink must register onTouchEnd for swipe detection');
  assert.match(daylinkSrc, /handleSubmit/, 'Daylink swipe up must call handleSubmit');

  assert.match(unlimitedSrc, /onTouchStart/, 'UnlimitedQuestions must register onTouchStart');
  assert.match(unlimitedSrc, /onTouchEnd/, 'UnlimitedQuestions must register onTouchEnd');
  assert.match(unlimitedSrc, /handleNext|handleSubmit/, 'UnlimitedQuestions swipe up must submit or advance');
});

test('Daylink allows reviewing yesterday question and decrypted answers', async () => {
  const daylinkSrc = await read('src/components/Daylink.tsx');

  assert.match(daylinkSrc, /yesterdayKey/, 'Daylink must define yesterdayKey helper');
  assert.match(daylinkSrc, /Voir la question et réponses d’hier|Voir la question et réponses d'hier/, 'Daylink must render button to view yesterday answers');
  assert.match(daylinkSrc, /safeDecrypt/, 'Daylink must decrypt yesterday answers for both partners');
  assert.match(daylinkSrc, /showYesterdayModal/, 'Daylink must have modal for yesterday question and answers');
});

test('admin.tsx provides global cleanup for orphan pairing codes and user profiles', async () => {
  const adminSrc = await read('src/app/admin.tsx');

  assert.match(adminSrc, /cleanupFirestoreData/, 'admin.tsx must declare cleanupFirestoreData function');
  assert.match(adminSrc, /pairing_codes/, 'cleanupFirestoreData must scan pairing_codes collection');
  assert.match(adminSrc, /userProfiles/, 'cleanupFirestoreData must scan userProfiles collection');
  assert.match(adminSrc, /🧹 Nettoyer Firebase/, 'admin.tsx must provide Nettoyer Firebase button');
});

test('Widgets are prominently accessible from dashboard header and settings section', async () => {
  const dashboardSrc = await read('src/app/dashboard.tsx');
  const settingsSrc = await read('src/app/settings.tsx');

  assert.match(dashboardSrc, /router\.push\('\/widgets'\)/, 'dashboard.tsx must have a direct button to /widgets');
  assert.match(dashboardSrc, /Widgets/, 'dashboard.tsx header must display Widgets shortcut badge');

  assert.match(settingsSrc, /Widgets Écran d’accueil/, 'settings.tsx must have dedicated Widgets section');
  assert.match(settingsSrc, /NOUVEAU/, 'settings.tsx must highlight Widgets with NOUVEAU pill');
});
