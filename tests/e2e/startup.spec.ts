import { expect, test } from '@playwright/test';

test('signed-out startup does not download the floating chat', async ({ page }) => {
  const chatRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/FloatingChat(?:-[\da-f]+)?\.js$/i.test(new URL(request.url()).pathname)) {
      chatRequests.push(request.url());
    }
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible();
  await page.getByRole('checkbox').click();
  expect(chatRequests).toEqual([]);
});

for (const width of [320, 390, 768, 1440]) {
  test(`cold start and reload remain usable at ${width}px`, async ({ page }) => {
    const fatalErrors: string[] = [];
    page.on('pageerror', (error) => fatalErrors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\/login$/);
    await expect(page.getByLabel('Chargement de NousDeux')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(fatalErrors).toEqual([]);
  });
}

test('an obsolete local profile cannot expose a previous couple after reload or back navigation', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('onboarding-storage', JSON.stringify({ version: 0, state: {
      uid: 'old-account', pseudo: 'OLD_PRIVATE_PROFILE', age: '28', isSynced: true,
      partnerUid: 'old-partner', partnerPseudo: 'OLD_PRIVATE_PARTNER',
    } }));
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/OLD_PRIVATE_PROFILE|OLD_PRIVATE_PARTNER/);
  await page.goto('/daylink');
  await expect(page).toHaveURL(/\/onboarding\/login$/);
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/OLD_PRIVATE_PROFILE|OLD_PRIVATE_PARTNER/);
});

test('legal navigation preserves consent and the form remains clickable', async ({ page }) => {
  await page.goto('/onboarding/login');
  const consent = page.getByRole('checkbox');
  await consent.check();
  await page.getByRole('link', { name: 'Conditions générales', exact: true }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByText('Conditions Générales d’Utilisation', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('checkbox')).toBeChecked();
  await expect(page.getByRole('button', { name: 'Continuer avec Apple' })).toBeVisible();
});

for (const route of ['/privacy', '/terms', '/contact']) {
  test(`${route} is accessible without signing in`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route + '$'));
    await expect(page.locator('body')).toContainText(/contact|NousDeux|Confidentialité/);
    await expect(page.locator('body')).not.toContainText(/Application error|Unmatched Route/);
    expect(errors).toEqual([]);
  });
}
