import { expect, test } from '@playwright/test';

test.describe('public application smoke tests', () => {
  test('landing page renders without a fatal runtime error', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/');
    await expect(page).toHaveURL(/\/(onboarding\/login|onboarding|\/)?$/);
    await expect(page.locator('body')).not.toContainText('Application error');
    expect(consoleErrors.filter((error) => !error.includes('favicon')).length).toBe(0);
  });

  test('login route is reachable and exposes its form', async ({ page }) => {
    await page.goto('/onboarding/login');
    await expect(page.locator('body')).not.toContainText('404');
    await expect(page.locator('body')).toContainText(/connexion|connecter|google|email/i);
  });

  for (const route of ['/onboarding', '/onboarding/pseudo', '/onboarding/age', '/onboarding/avatar']) {
    test(`${route} is not a broken route`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('body')).not.toContainText(/Application error|404|Cannot read properties/i);
    });
  }
});

test.describe('authenticated regression smoke tests', () => {
  test.skip(!process.env.E2E_STORAGE_STATE, 'Set E2E_STORAGE_STATE to run authenticated checks.');

  test('dashboard exposes the daily question and unlimited entry points', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('body')).not.toContainText(/Application error|Cannot read properties/i);
    await expect(page.getByText('Question du Jour')).toBeVisible();
    await expect(page.getByText('Questions Illimitées')).toBeVisible();
  });

  test('all category links keep their category parameter', async ({ page }) => {
    await page.goto('/dashboard');
    const links = page.locator('a[href*="/unlimited?category="]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expect(links.nth(index)).toHaveAttribute('href', /\/unlimited\?category=[a-z_]+/);
    }
  });

  test('daily question and calendar do not stay in an infinite loading state', async ({ page }) => {
    await page.goto('/daylink');
    await expect(page.locator('body')).not.toContainText('Chargement...');
    await page.goto('/calendar');
    await expect(page.locator('body')).not.toContainText('Chargement...');
  });
});
