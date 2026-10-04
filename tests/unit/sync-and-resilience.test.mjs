import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relPath) => fs.readFile(path.join(root, relPath), 'utf-8');

test('custom not-found 404 page exists and provides navigation back home', async () => {
  const notFoundSrc = await read('src/app/+not-found.tsx');
  assert.ok(notFoundSrc.includes('NotFoundScreen'), '+not-found.tsx must export NotFoundScreen');
  assert.match(notFoundSrc, /router\.replace\('\/dashboard'\)/, '+not-found.tsx must offer return to /dashboard');
  assert.ok(notFoundSrc.includes('404'), '+not-found.tsx must display 404 error badge or text');
});

test('sync.tsx removes outdated google tip and provides skip option to dashboard', async () => {
  const syncSrc = await read('src/app/onboarding/sync.tsx');
  assert.ok(
    !syncSrc.includes('chaque partenaire doit être connecté sur un compte Google différent'),
    'sync.tsx must not contain the obsolete Google tip'
  );
  assert.match(
    syncSrc,
    /Se synchroniser plus tard/,
    'sync.tsx must offer "Se synchroniser plus tard"'
  );
  assert.match(
    syncSrc,
    /router\.replace\('\/dashboard'\)/,
    'sync.tsx skip button must lead to /dashboard'
  );
});

test('sync.tsx self-pairing message asks partner for their code', async () => {
  const syncSrc = await read('src/app/onboarding/sync.tsx');
  assert.ok(
    !syncSrc.includes('connecte un autre compte Google sur ton second navigateur'),
    'sync.tsx should not refer to testing on a second browser'
  );
  assert.match(
    syncSrc,
    /Demande à ton partenaire de t'envoyer son propre code/,
    'sync.tsx self-pairing message must ask partner to send their code'
  );
});

test('sync.tsx restores previousLinkedAt for same partner and deep-deletes couple answers on reset', async () => {
  const syncSrc = await read('src/app/onboarding/sync.tsx');
  assert.match(syncSrc, /effectiveLinkedAt/, 'sync.tsx must compute effectiveLinkedAt to preserve duration for same partner');
  assert.match(syncSrc, /answersSnap/, 'resetCoupleData must clean answers subcollections');
});

test('UIModal component exists and provides standard error types', async () => {
  const modalSrc = await read('src/components/UIModal.tsx');
  assert.ok(modalSrc.includes('UIModal'), 'UIModal component must be defined');
  assert.ok(modalSrc.includes('network'), 'UIModal must support network errors');
  assert.ok(modalSrc.includes('sync'), 'UIModal must support sync errors');
  assert.ok(modalSrc.includes('funds'), 'UIModal must support funds errors');
  assert.ok(modalSrc.includes('self_pairing'), 'UIModal must support self_pairing errors');
});

test('StreakCalendar orders bubbles chronologically with today on the right and auto-scrolls', async () => {
  const calSrc = await read('src/components/StreakCalendar.tsx');
  assert.match(calSrc, /for \(let i = -\(daysToShow - 1\); i <= 0; i\+\+\)/, 'miniDays must order from past to today (0)');
  assert.match(calSrc, /scrollToToday/, 'StreakCalendar must provide scrollToToday handler');
  assert.match(calSrc, /contentOffset=\{\{ x: 10000, y: 0 \}\}/, 'StreakCalendar ScrollView must have contentOffset to mount at the end');
});

test('avatar persistence and photo removal are supported', async () => {
  const layoutSrc = await read('src/app/_layout.tsx');
  const loginSrc = await read('src/app/onboarding/login.tsx');
  const avatarSrc = await read('src/app/onboarding/avatar.tsx');
  assert.match(layoutSrc, /avatarToSet/, '_layout.tsx must resolve avatar from avatarUrl or avatar');
  assert.match(layoutSrc, /getUserProfile/, '_layout.tsx must load userProfile to restore cosmetics/avatarConfig');
  assert.match(loginSrc, /getUserProfile/, 'login.tsx must restore userProfile');
  assert.match(avatarSrc, /Clique pour ajouter/, 'avatar.tsx must prompt Clique pour ajouter when empty');
  assert.match(avatarSrc, /handleRemovePhoto/, 'avatar.tsx must provide photo removal handler');
  assert.match(avatarSrc, /Plus tard/, 'avatar.tsx must always offer Plus tard option');
});

test('chat is read-only when unlinked and purged before new couple connection', async () => {
  const floatingChatSrc = await read('src/components/FloatingChat.tsx');
  const chatSrc = await read('src/app/chat.tsx');
  const syncSrc = await read('src/app/onboarding/sync.tsx');
  assert.match(floatingChatSrc, /isLinked/, 'FloatingChat must track whether user is currently linked');
  assert.match(floatingChatSrc, /Compte délié : envoi désactivé/, 'FloatingChat must gray out and disable input when unlinked');
  assert.match(chatSrc, /isLinked/, 'chat.tsx must track whether user is currently linked');
  assert.match(chatSrc, /Compte délié : envoi désactivé/, 'chat.tsx must disable input when unlinked');
  assert.match(syncSrc, /myData\.lastPartner !== partnerUid/, 'sync.tsx must purge previous partner messages before linking new couple');
  assert.match(syncSrc, /skipCardButton/, 'sync.tsx must provide prominent skipCardButton');
  assert.doesNotMatch(syncSrc, /errorMessage && <Text style=\{\[styles\.errorText/, 'sync.tsx must not render redundant duplicate error text');
});

test('session isolation prevents partner data bleeding across account switches', async () => {
  const loginSrc = await read('src/app/onboarding/login.tsx');
  const layoutSrc = await read('src/app/_layout.tsx');
  const dashboardSrc = await read('src/app/dashboard.tsx');
  const cosmeticsSrc = await read('src/data/cosmetics.ts');
  const syncSrc = await read('src/app/onboarding/sync.tsx');

  // 1. login.tsx must reset session or clear partner cache when switching accounts or unlinked
  assert.match(loginSrc, /currentStore\.uid !== user\.uid/, 'login.tsx must detect switching user accounts');
  assert.match(loginSrc, /currentStore\.resetSession\(\)/, 'login.tsx must reset session when switching accounts');
  assert.match(loginSrc, /currentStore\.clearPartnerCache\(\)/, 'login.tsx must clear partner cache');

  // 2. _layout.tsx must reset session when cached UID does not match auth user
  assert.match(layoutSrc, /store\.uid && store\.uid !== user\.uid/, '_layout.tsx must reset session if UID changed');
  assert.match(layoutSrc, /store\.clearPartnerCache\(\)/, '_layout.tsx must clear partner cache when user is unlinked');

  // 3. dashboard.tsx partner state initialization must require isSynced
  assert.match(dashboardSrc, /store\.isSynced && store\.partnerUid/, 'dashboard.tsx must only initialize partner if isSynced is true');
  assert.match(dashboardSrc, /store\.setSynced\(false\)/, 'dashboard.tsx must set isSynced to false when unlinked');

  // 4. sync.tsx must provide header skip button visible without scrolling
  assert.match(syncSrc, /skipHeaderBtn/, 'sync.tsx must render skip button in header visible without scrolling on PC');
  assert.match(syncSrc, /Passer \(Mode Solo\)/, 'sync.tsx header must display skip solo text');

  // 5. cosmetics.ts getCosmeticImage must provide fallback
  assert.match(cosmeticsSrc, /cosmetic\.darkImage \|\| cosmetic\.image/, 'cosmetics.ts must provide image fallback in dark mode');
  assert.match(cosmeticsSrc, /cosmetic\.image \|\| cosmetic\.darkImage/, 'cosmetics.ts must provide image fallback in light mode');
});

test('all onboarding screens render cosmetic background directly to prevent blank/grey screen', async () => {
  const pseudoSrc = await read('src/app/onboarding/pseudo.tsx');
  const ageSrc = await read('src/app/onboarding/age.tsx');
  const avatarSrc = await read('src/app/onboarding/avatar.tsx');
  const syncSrc = await read('src/app/onboarding/sync.tsx');
  const dateSrc = await read('src/app/onboarding/date.tsx');

  assert.match(pseudoSrc, /<ImageBackground\s+source=\{bgImage\}/, 'pseudo.tsx must render ImageBackground with bgImage');
  assert.match(ageSrc, /<ImageBackground\s+source=\{bgImage\}/, 'age.tsx must render ImageBackground with bgImage');
  assert.match(avatarSrc, /<ImageBackground\s+source=\{bgImage\}/, 'avatar.tsx must render ImageBackground with bgImage');
  assert.match(syncSrc, /<ImageBackground\s+source=\{backgroundSource\}/, 'sync.tsx must render ImageBackground with backgroundSource');
  assert.match(dateSrc, /<Image\s+source=\{bgImage\}/, 'date.tsx must render Image with bgImage');
});

