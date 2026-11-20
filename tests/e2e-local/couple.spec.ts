import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixtures = JSON.parse(readFileSync('.expo/test-accounts.json', 'utf8'));

async function signInLocally(context: any, person: any) {
  await context.addInitScript((account: any) => {
    localStorage.setItem('firebase:authUser:demo-api-key:[DEFAULT]', JSON.stringify({
      uid: account.localId, email: account.email, emailVerified: false, isAnonymous: false,
      providerData: [{ providerId: 'password', uid: account.email, email: account.email }],
      stsTokenManager: { refreshToken: account.refreshToken, accessToken: account.idToken, expirationTime: Date.now() + 3600000 },
      createdAt: String(Date.now()), lastLoginAt: String(Date.now()), apiKey: 'demo-api-key', appName: '[DEFAULT]',
    }));
  }, person);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((person) => {
    localStorage.setItem('firebase:authUser:demo-api-key:[DEFAULT]', JSON.stringify({
      uid: person.localId, email: person.email, emailVerified: false, isAnonymous: false,
      providerData: [{ providerId: 'password', uid: person.email, email: person.email }],
      stsTokenManager: { refreshToken: person.refreshToken, accessToken: person.idToken, expirationTime: Date.now() + 3600000 },
      createdAt: String(Date.now()), lastLoginAt: String(Date.now()), apiKey: 'demo-api-key', appName: '[DEFAULT]',
    }));
    localStorage.setItem(`last_seen_streak:${person.localId}`, '999999');
    localStorage.setItem('onboarding-storage', JSON.stringify({ version: 0, state: { hasAcceptedTerms: true } }));
  }, fixtures.people[0]);
});

test('a fresh authenticated session loads the correct couple without refreshing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await expect(page.getByText('Camille', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Alex', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Question du Jour', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.expo/dashboard-mobile-final.png', fullPage: true });
  await page.reload();
  await expect(page.getByText('Alex', { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('shop, settings and widgets open without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/dashboard');
  await expect(page.getByText('Camille', { exact: true }).first()).toBeVisible();
  for (const route of ['/shop', '/settings', '/widgets', '/calendar', '/daylink']) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route + '$'));
    await expect(page.locator('body')).not.toContainText(/Application error|Cannot read properties|is not defined/);
    await expect(page.locator('body')).not.toContainText('Chargement du Dashboard');
    await expect(page.getByLabel('Chargement de NousDeux')).toHaveCount(0);
    if (route === '/settings') {
      await expect(page.getByText('Mon Profil', { exact: true })).toBeVisible();
      await page.getByLabel('Mode sombre', { exact: true }).check();
      await expect(page.getByLabel('Mode sombre', { exact: true })).toBeChecked();
      await expect(page.getByText('Mon Profil', { exact: true })).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test('a linked partner cannot overwrite private profile fields', async ({ request }) => {
  const owner = fixtures.people[1];
  const response = await request.patch(`http://127.0.0.1:8080/v1/projects/demo-nousdeux/databases/(default)/documents/users/${owner.localId}?updateMask.fieldPaths=pseudo`, {
    headers: { Authorization: `Bearer ${fixtures.people[0].idToken}` },
    data: { fields: { pseudo: { stringValue: 'UNAUTHORIZED CHANGE' } } },
  });
  expect(response.status()).toBe(403);
});

test('two local partners can submit and decrypt their daily answers in real time', async ({ browser, page }) => {
  const partnerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await signInLocally(partnerContext, fixtures.people[1]);
  const partnerPage = await partnerContext.newPage();
  await page.goto('/daylink');
  await partnerPage.goto('http://127.0.0.1:8083/daylink');
  await page.getByPlaceholder('Écris ce que tu ressens...').fill('Une promenade à deux au bord de la mer.');
  await page.getByText('Envoyer avec amour 💌', { exact: true }).click();
  await expect(page.getByText('En attente de Alex...', { exact: false })).toBeVisible();
  await partnerPage.getByPlaceholder('Écris ce que tu ressens...').fill('Notre premier voyage ensemble.');
  await partnerPage.getByText('Envoyer avec amour 💌', { exact: true }).click();
  await expect(page.getByText('Notre premier voyage ensemble.', { exact: true })).toBeVisible();
  await expect(partnerPage.getByText('Une promenade à deux au bord de la mer.', { exact: true })).toBeVisible();
  await partnerContext.close();
});

test('deleting a disposable local account removes Auth, profile and nested answers', async ({ browser, request }) => {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { getAuth } = await import('firebase-admin/auth');
  const adminApp = initializeApp({ projectId: 'demo-nousdeux' }, 'deletion-test');
  const db = getFirestore(adminApp);
  const response = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
    data: { email: `disposable-${Date.now()}@example.invalid`, password: 'local-tests-only-123', returnSecureToken: true },
  });
  expect(response.ok()).toBe(true);
  const person = await response.json();
  const uid = person.localId;
  await db.doc(`users/${uid}`).set({ pseudo: 'Compte jetable', age: '27', pairingCode: 'DELETE' });
  await db.doc(`userProfiles/${uid}`).set({ selectedBackground: 'bg_free_1', selectedBorder: 'bd_free_1', selectedTag: '' });
  await db.doc('pairing_codes/DELETE').set({ creatorUid: uid });
  const answer = db.doc(`couples/${uid}_solo/daily/2000-01-01/answers/${uid}`);
  await answer.parent.parent!.set({ questionId: 'test' });
  await answer.set({ ciphertext: 'test', iv: 'test' });
  const context = await browser.newContext();
  await signInLocally(context, person);
  const disposablePage = await context.newPage();
  await disposablePage.goto('http://127.0.0.1:8083/settings');
  await disposablePage.getByText('Supprimer le compte', { exact: true }).first().click();
  await disposablePage.getByText('Supprimer', { exact: true }).click();
  await expect(disposablePage.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible();
  expect((await db.doc(`users/${uid}`).get()).exists).toBe(false);
  expect((await db.doc(`userProfiles/${uid}`).get()).exists).toBe(false);
  expect((await answer.get()).exists).toBe(false);
  await expect(getAuth(adminApp).getUser(uid)).rejects.toThrow();
  await context.close();
  await db.terminate();
});
