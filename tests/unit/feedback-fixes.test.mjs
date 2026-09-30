import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('Dashboard removes rarity badges and includes launch/banner ads', async () => {
  const dashSrc = await read('src/app/dashboard.tsx');

  assert.doesNotMatch(dashSrc, /cat\.rarity/, 'Rarity badges must not be displayed on dashboard category cards');
  assert.match(dashSrc, /<AppLaunchAd/, 'AppLaunchAd must be present on dashboard');
  assert.match(dashSrc, /<GoogleAdBanner/, 'GoogleAdBanner must be present on dashboard');
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

test('Shop modifier button triggers coming soon popup with valid confirm button', async () => {
  const shopSrc = await read('src/app/shop.tsx');

  assert.match(shopSrc, /setShowComingSoon\(true\)/, 'Modifier mon avatar button must open coming soon modal');
  assert.match(shopSrc, /D'accord/, 'Coming soon modal must display D\'accord on confirm button');
});

test('metro.config.js enforces canonical single resolution for @firebase/app and @firebase/auth', async () => {
  const metroSrc = await read('metro.config.js');

  assert.match(metroSrc, /resolveRequest/, 'metro.config.js must define resolveRequest');
  assert.match(metroSrc, /@firebase\/app/, 'metro.config.js must canonically resolve @firebase/app');
  assert.match(metroSrc, /@firebase\/auth/, 'metro.config.js must canonically resolve @firebase/auth');
});

test('app.json uses NousDeux icon and theme for splash screen without default starter assets', async () => {
  const appJson = JSON.parse(await read('app.json'));
  const splashPlugin = appJson.expo.plugins.find(
    (p) => Array.isArray(p) && p[0] === 'expo-splash-screen'
  );

  assert.ok(splashPlugin, 'expo-splash-screen plugin must be configured in app.json');
  assert.equal(splashPlugin[1].image, './assets/images/icon.png', 'Splash must use NousDeux icon.png');
  assert.equal(splashPlugin[1].backgroundColor, '#FFF5F2', 'Splash light background must match NousDeux warm theme');
  assert.equal(splashPlugin[1].dark?.backgroundColor, '#1A1514', 'Splash dark background must match NousDeux dark theme');

  const androidAdaptive = appJson.expo.android?.adaptiveIcon;
  assert.ok(androidAdaptive, 'android.adaptiveIcon must be configured');
  assert.equal(androidAdaptive.backgroundColor, '#FFF5F2', 'Adaptive icon background must be #FFF5F2');
  assert.equal(androidAdaptive.foregroundImage, './assets/images/android-icon-foreground.png');
  assert.equal(androidAdaptive.backgroundImage, undefined, 'Adaptive icon must not define a backgroundImage');
});

test('build-android workflow builds standalone release APK with JS bundling', async () => {
  const workflowSrc = await read('.github/workflows/build-android.yml');

  assert.match(workflowSrc, /assembleRelease/, 'Workflow must build assembleRelease so JS bundle is included offline');
  assert.match(workflowSrc, /signingConfig signingConfigs\.debug/, 'Workflow must configure debug signing for sideloading');
  assert.match(workflowSrc, /apk\/release/, 'Workflow must collect APK from release output directory');
});

