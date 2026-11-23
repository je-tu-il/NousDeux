import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';

function moduleFromSource(file, mocks, globals = {}) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => {
    if (!(name in mocks)) throw new Error(`Unexpected module: ${name}`);
    return mocks[name];
  }, console, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, btoa, atob, ...globals });
  return exports;
}

function bootstrap({ hydrated = true, uid = null, pseudo = '', age = '' } = {}) {
  let authCallback, hydrationCallback, cleanup;
  let hydrateCount = 0, authCount = 0, resets = 0;
  const pending = [];
  const timers = new Map();
  const values = [];
  let index = 0;
  const store = { uid, pseudo, age, partnerUid: 'previous-partner',
    resetSession() { resets++; Object.assign(store, { uid: null, pseudo: '', age: '', partnerUid: null }); },
    setUid(v) { store.uid = v; }, setPseudo(v) { store.pseudo = v; }, setAge(v) { store.age = v; },
    setAvatar() {}, setMyCode() {}, setSynced() {}, clearPartnerCache() { store.partnerUid = null; },
  };
  const persist = { hasHydrated: () => hydrated, onFinishHydration: (cb) => { hydrationCallback = cb; return () => {}; }, rehydrate: () => { hydrateCount++; } };
  const mocks = {
    react: { useState(initial) { const slot = index++; if (!(slot in values)) values[slot] = initial; return [values[slot], (value) => { values[slot] = typeof value === 'function' ? value(values[slot]) : value; }]; }, useEffect(fn) { if (!cleanup) cleanup = fn(); } },
    'firebase/auth': { onAuthStateChanged(_auth, cb) { authCount++; authCallback = cb; return () => {}; } },
    'firebase/firestore': { doc: (_db, _name, id) => id, getDoc: (id) => new Promise((resolve, reject) => pending.push({ id, resolve, reject })) },
    '@/lib/firebase': { auth: {}, db: {} },
    '@/store/onboardingStore': { useOnboardingStore: { getState: () => store, persist } },
    '@/lib/economy': { getUserProfile: () => Promise.reject(new Error('Optional offline cosmetics')) },
  };
  const { useSessionBootstrap } = moduleFromSource('src/hooks/use-session-bootstrap.ts', mocks, {
    setTimeout: (cb) => { const id = Symbol(); timers.set(id, cb); return id; }, clearTimeout: (id) => timers.delete(id),
  });
  const render = () => { index = 0; return useSessionBootstrap(); };
  render();
  return { render, store, pending, signIn: (id) => authCallback(id ? { uid: id } : null),
    hydrate() { hydrated = true; hydrationCallback(); }, expire() { for (const cb of timers.values()) cb(); },
    stop: () => cleanup(), get authCount() { return authCount; }, get resets() { return resets; }, get hydrateCount() { return hydrateCount; } };
}

test('cold startup waits for storage before subscribing to Firebase', () => {
  const app = bootstrap({ hydrated: false });
  assert.equal(app.authCount, 0);
  assert.equal(app.render().ready, false);
  app.hydrate(); app.hydrate();
  assert.equal(app.authCount, 1);
  app.signIn(null);
  assert.equal(app.render().ready, true);
  assert.equal(app.store.partnerUid, null);
  app.stop();
});

test('a persisted UID without a Firebase session never authenticates a user', () => {
  const app = bootstrap({ uid: 'old', pseudo: 'Old', age: '22' });
  app.signIn(null);
  assert.equal(app.store.uid, null);
  assert.equal(app.store.pseudo, '');
  assert.equal(app.render().user, null);
  app.stop();
});

test('late Firestore responses from a previous account cannot overwrite the new session', async () => {
  const app = bootstrap();
  app.signIn('first'); app.signIn('second');
  app.pending[0].resolve({ data: () => ({ pseudo: 'First', age: '25', linkedTo: 'old-partner' }) });
  await new Promise(setImmediate);
  assert.equal(app.store.uid, 'second');
  assert.equal(app.store.pseudo, '');
  assert.equal(app.render().ready, false);
  app.pending[1].resolve({ data: () => ({ pseudo: 'Second', age: '28' }) });
  await new Promise(setImmediate);
  assert.equal(app.store.pseudo, 'Second');
  assert.equal(app.render().ready, true);
  app.stop();
});

test('slow sign-in after a guest session exposes retry instead of assuming sign-out', () => {
  const app = bootstrap();
  app.signIn(null); app.signIn('new-account'); app.expire();
  assert.equal(app.render().error, true);
  assert.equal(app.render().ready, false);
  assert.equal(app.render().user.uid, 'new-account');
  app.stop();
});

test('known profiles open offline without waiting for optional network reads', async () => {
  const app = bootstrap({ uid: 'known', pseudo: 'Nous', age: '24' });
  app.signIn('known');
  assert.equal(app.render().ready, true);
  assert.equal(app.resets, 0);
  app.pending[0].reject(new Error('offline'));
  await new Promise(setImmediate);
  assert.equal(app.render().ready, true);
  assert.equal(app.render().error, false);
  app.stop();
});

test('new encrypted answers roundtrip and never fall back to unencrypted base64', async () => {
  const cryptoModule = moduleFromSource('src/lib/crypto.ts', { 'react-native': { Platform: { OS: 'web' } } }, { crypto: webcrypto });
  const encrypted = await cryptoModule.encryptText('Notre souvenir préféré ❤️', 'test-couple');
  assert.notEqual(encrypted.iv, 'mock-iv-1234');
  assert.equal(await cryptoModule.decryptText(encrypted, 'test-couple'), 'Notre souvenir préféré ❤️');
  const noCrypto = moduleFromSource('src/lib/crypto.ts', { 'react-native': { Platform: { OS: 'web' } } });
  await assert.rejects(noCrypto.encryptText('private text', 'test'), /chiffrement/);
  assert.equal(await noCrypto.decryptText({ ciphertext: btoa('legacy text'), iv: 'mock-iv-1234' }, 'test'), 'legacy text');
});

test('pairing API rejects missing tokens and impersonated requester IDs', async () => {
  const require = createRequire(import.meta.url);
  const verifyUser = require('../../api/_verify-user.js');
  let status;
  const response = { status(code) { status = code; return response; }, json() {} };
  const admin = { auth: () => ({ verifyIdToken: async () => ({ uid: 'verified-account' }) }) };
  assert.equal(await verifyUser({ headers: {}, body: {} }, response, admin), null);
  assert.equal(status, 401);
  assert.equal(await verifyUser({ headers: { authorization: 'Bearer token' }, body: { requesterUserId: 'someone-else' } }, response, admin), null);
  assert.equal(status, 403);
  assert.equal(await verifyUser({ headers: { authorization: 'Bearer token' }, body: {} }, response, admin), 'verified-account');
});

test('the secure query decoder preserves navigation parameters and tolerates malformed UTF-8', () => {
  const require = createRequire(import.meta.url);
  const query = require('query-string');
  assert.equal(query.parse('category=amour&label=c%C5%93ur').label, 'cœur');
  assert.equal(query.parse('category=amour').category, 'amour');
  assert.doesNotThrow(() => query.parse('broken=%E0%A4%A'));
});

test('store builds cannot accidentally ship emulator accounts or sample AdMob app IDs', () => {
  const env = { EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_FIREBASE_EMULATORS: 'true' };
  const module = { exports: {} };
  vm.runInNewContext(readFileSync('app.config.js', 'utf8'), { module, process: { env } }, { filename: 'app.config.js' });
  const config = module.exports;
  const base = JSON.parse(readFileSync('app.json', 'utf8')).expo;
  assert.throws(() => config({ config: base }), /comptes fictifs/);
  env.EXPO_PUBLIC_FIREBASE_EMULATORS = 'false';
  assert.throws(() => config({ config: base }), /ADMOB_ANDROID_APP_ID/);
  env.ADMOB_ANDROID_APP_ID = 'ca-app-pub-1234567890123456~1234567890';
  env.ADMOB_IOS_APP_ID = 'ca-app-pub-1234567890123456~9876543210';
  const mobileAdsPlugin = config({ config: base }).plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads');
  assert.equal(mobileAdsPlugin[1].androidAppId, env.ADMOB_ANDROID_APP_ID);
  assert.equal(mobileAdsPlugin[1].iosAppId, env.ADMOB_IOS_APP_ID);
});

test('widget payloads expire at local midnight and never reuse another account’s data', async () => {
  let uid = 'current';
  let saved = { ownerUid: 'old-account', userPseudo: 'PRIVATE OLD NAME', streak: 40, updatedAt: new Date().toISOString() };
  const mocks = {
    'react-native': { Platform: { OS: 'web' }, NativeModules: {} },
    '@react-native-async-storage/async-storage': { default: { getItem: async () => JSON.stringify(saved) } },
    '../store/onboardingStore': { useOnboardingStore: { getState: () => ({ uid }) } },
    '../data/cosmetics': { COSMETICS: [] },
    '../data/scheduledQuestions': { getDailyQuestionForDate: () => ({ text: 'TODAY', category: 'amour' }) },
    '../data/questions': {},
  };
  const widgets = moduleFromSource('src/lib/widgets.ts', mocks);
  assert.equal((await widgets.getWidgetData()).streak, 0);
  assert.notEqual((await widgets.getWidgetData()).userPseudo, 'PRIVATE OLD NAME');
  uid = 'current';
  saved = { ownerUid: uid, localDate: '2000-01-01', todayQuestion: 'YESTERDAY', userAnswered: true, partnerAnswered: true, bothAnswered: true };
  const refreshed = await widgets.getWidgetData();
  assert.equal(refreshed.todayQuestion, 'TODAY');
  assert.equal(refreshed.bothAnswered, false);
  assert.equal(refreshed.userAnswered, false);
});

test('account deletion removes nested answers and chunks batches below Firestore limits', async () => {
  const deletions = [];
  const sizes = [];
  const account = moduleFromSource('src/lib/account.ts', {
    'react-native': { Platform: { OS: 'web' } }, 'firebase/auth': {}, 'expo-crypto': {}, './firebase': { db: {} },
    'firebase/firestore': {
      collection: (_db, ...parts) => parts.join('/'), doc: (_db, ...parts) => parts.join('/'),
      getDocs: async (name) => ({ docs: name.endsWith('/messages') ? Array.from({ length: 801 }, (_, i) => ({ ref: `messages/${i}` }))
        : name.endsWith('/daily') ? [{ ref: 'daily/slot' }]
        : name === 'answers' ? [{ ref: 'answers/one' }, { ref: 'answers/two' }] : [] }),
      writeBatch: () => { const refs = []; return { delete: (ref) => refs.push(ref), commit: async () => { sizes.push(refs.length); deletions.push(...refs); } }; },
      deleteDoc: async (ref) => deletions.push(ref),
    },
  });
  await account.deleteCoupleData('test-couple');
  assert.equal(deletions.length, 805);
  assert.ok(sizes.every((size) => size <= 400));
  assert.ok(deletions.indexOf('answers/one') < deletions.indexOf('daily/slot'));
  assert.equal(deletions.at(-1), 'couples/test-couple');
});
