import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('Dashboard removes rarity badges and launch/banner ads', async () => {
  const dashSrc = await read('src/app/dashboard.tsx');

  assert.doesNotMatch(dashSrc, /cat\.rarity/, 'Rarity badges must not be displayed on dashboard category cards');
  assert.doesNotMatch(dashSrc, /<AppLaunchAd/, 'AppLaunchAd must be removed from dashboard');
  assert.doesNotMatch(dashSrc, /<GoogleAdBanner/, 'GoogleAdBanner must be removed from dashboard');
});

test('StreakCalendar removes interactive month calendar grid below', async () => {
  const calSrc = await read('src/components/StreakCalendar.tsx');

  assert.doesNotMatch(calSrc, /calHeader/, 'calHeader navigation must be removed from StreakCalendar');
  assert.doesNotMatch(calSrc, /calCells\.map/, 'calCells grid must be removed from StreakCalendar');
  assert.match(calSrc, /recordBox/, 'StreakCalendar must still retain recordBox stats');
});

test('QuestCard pending badge does not overflow container', async () => {
  const questSrc = await read('src/components/QuestCard.tsx');

  assert.match(questSrc, /numberOfLines=\{1\}/, 'pendingText must have numberOfLines={1}');
  assert.match(questSrc, /flexShrink:\s*1/, 'pendingBadge must have flexShrink: 1');
});

test('Admin mode provides +/- toggle buttons and avoids restrictive numeric keyboardType', async () => {
  const adminSrc = await read('src/app/admin.tsx');

  assert.doesNotMatch(adminSrc, /value=\{petalDelta\}[^>]*keyboardType="numeric"/, 'petalDelta input must not use numeric keyboardType');
  assert.doesNotMatch(adminSrc, /value=\{petalAmount\}[^>]*keyboardType="numeric"/, 'petalAmount input must not use numeric keyboardType');
  assert.match(adminSrc, /signBtn/, 'Admin screen must provide dedicated +/- buttons');
});

test('Root layout dismisses splash screen cleanly and avoids getting stuck', async () => {
  const layoutSrc = await read('src/app/_layout.tsx');

  assert.match(layoutSrc, /SplashScreen\.hideAsync/, '_layout.tsx must call SplashScreen.hideAsync');
});

test('Shop modifiers navigate directly and ensure valid confirm button', async () => {
  const shopSrc = await read('src/app/shop.tsx');

  assert.match(shopSrc, /router\.push\('\/settings'\)/, 'Modifier mon avatar button must navigate to settings directly');
  assert.match(shopSrc, /D'accord/, 'Coming soon modal must display D\'accord on confirm button');
});
