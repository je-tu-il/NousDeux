import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const read = async (relPath) => readFile(resolve(process.cwd(), relPath), 'utf-8');

test('haptics utility supports cross-platform feedback across web and native', async () => {
  const hapticsSrc = await read('src/lib/haptics.ts');

  assert.match(hapticsSrc, /export async function triggerHaptic/, 'haptics.ts must export triggerHaptic');
  assert.match(hapticsSrc, /navigator\.vibrate/, 'haptics.ts must support web vibration fallback');
  assert.match(hapticsSrc, /expo-haptics/, 'haptics.ts must integrate expo-haptics for native mobile');
  assert.match(hapticsSrc, /Vibration\.vibrate/, 'haptics.ts must provide react-native Vibration fallback');
  assert.match(hapticsSrc, /'selection'/, 'haptics.ts must support selection feedback type');
  assert.match(hapticsSrc, /'success'/, 'haptics.ts must support success feedback type');
});

test('login screen provides Apple and Google sign-in with Android BackHandler isolation', async () => {
  const loginSrc = await read('src/app/onboarding/login.tsx');

  // 1. BackHandler protection against session popping
  assert.match(loginSrc, /BackHandler\.addEventListener\('hardwareBackPress'/, 'login.tsx must intercept Android back press');
  assert.match(loginSrc, /BackHandler\.exitApp\(\)/, 'login.tsx must exit app on back press to prevent showing old session');

  // 2. Navigation stack clearing
  assert.match(loginSrc, /router\.canDismiss\(\)[\s\S]*router\.dismissAll\(\)/, 'login.tsx must clear navigation stack on login');

  // 3. Apple Sign-In support
  assert.match(loginSrc, /handleAppleLogin/, 'login.tsx must define handleAppleLogin');
  assert.match(loginSrc, /OAuthProvider\('apple\.com'\)/, 'login.tsx must support Firebase Apple OAuthProvider');
  assert.match(loginSrc, /Continuer avec Apple/, 'login.tsx must render Apple Sign-In button');

  // 4. Clickable buttons trigger feedback even if unaccepted
  assert.match(loginSrc, /styles\.appleButton/, 'login.tsx must define appleButton styling');
  assert.match(loginSrc, /styles\.googleButton/, 'login.tsx must define googleButton styling');
});

test('date screen renders form immediately without blocking animation delays', async () => {
  const dateSrc = await read('src/app/onboarding/date.tsx');

  // Form container and button container must NOT use delayed FadeInUp that can freeze at 0 opacity
  assert.doesNotMatch(dateSrc, /FadeInUp\.duration\(800\)\.delay\(200\)/, 'date.tsx must not delay pickerContainer with FadeInUp');
  assert.doesNotMatch(dateSrc, /FadeInUp\.duration\(800\)\.delay\(400\)/, 'date.tsx must not delay buttonContainer with FadeInUp');

  // Listeners must use activeUid and handle errors
  assert.match(dateSrc, /unsubMe\s*=\s*onSnapshot\(doc\(db,\s*'users',\s*activeUid\)/, 'date.tsx must listen to activeUid');
  assert.match(dateSrc, /try\s*\{[\s\S]*getDoc\(doc\(db,\s*'users',\s*activeUid\)/, 'date.tsx setupListener must be wrapped in try/catch');
});

test('dashboard provides responsive widget layout and UID switch state isolation', async () => {
  const dashSrc = await read('src/app/dashboard.tsx');

  // 1. Responsive switch at 600px width
  assert.match(dashSrc, /windowWidth\s*<\s*600/, 'dashboard.tsx must check windowWidth < 600 for responsive layout');
  assert.match(dashSrc, /StreakCalendar[\s\S]*fullWidth=\{false\}/, 'dashboard.tsx must use compact calendar next to roulette on mobile');
  assert.match(dashSrc, /StreakCalendar[\s\S]*fullWidth=\{true\}/, 'dashboard.tsx must use full width calendar on tablet/desktop');

  // 2. State isolation on UID change
  assert.match(dashSrc, /previousUidRef[\s\S]*activeUid/, 'dashboard.tsx must track previousUidRef');
  assert.match(dashSrc, /setPartnerProfile\(null\)/, 'dashboard.tsx must clear partnerProfile on unlinking');
  assert.match(dashSrc, /setWallet\(null\)/, 'dashboard.tsx must clear wallet on unlinking');
});

test('economy cache is cleared across session resets, disconnect, and account deletion', async () => {
  const economySrc = await read('src/lib/economy.ts');
  const storeSrc = await read('src/store/onboardingStore.ts');
  const settingsSrc = await read('src/app/settings.tsx');

  assert.match(economySrc, /export function clearEconomyCache/, 'economy.ts must export clearEconomyCache');
  assert.match(storeSrc, /clearEconomyCache\(\)/, 'onboardingStore.ts resetSession must clear economy cache');
  assert.match(settingsSrc, /clearEconomyCache\(\)/, 'settings.tsx disconnect must clear economy cache');
  assert.match(settingsSrc, /router\.canDismiss\(\)[\s\S]*router\.dismissAll\(\)/, 'settings.tsx must clear navigation stack on disconnect');
});
