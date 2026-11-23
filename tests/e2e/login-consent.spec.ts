import { expect, test } from '@playwright/test';

for (const provider of ['Google', 'Apple']) {
  test(`${provider} requires explicit consent without opening an OAuth popup`, async ({ page }) => {
    const popups: string[] = [];
    page.on('popup', (popup) => popups.push(popup.url()));
    await page.goto('/onboarding/login');

    const consent = page.getByRole('checkbox');
    const signIn = page.getByRole('button', { name: `Continuer avec ${provider}` });
    await expect(consent).not.toBeChecked();
    await signIn.click();
    await expect(page.getByText('Conditions requises', { exact: true })).toBeVisible();
    await page.getByText('Compris', { exact: true }).click();
    await expect(signIn).toBeEnabled();
    await expect(consent).not.toBeChecked();
    expect(popups).toEqual([]);
  });
}

test('the 320px sign-in form exposes both providers and has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 680 });
  await page.goto('/onboarding/login');
  for (const provider of ['Google', 'Apple']) {
    const button = page.getByRole('button', { name: `Continuer avec ${provider}` });
    await expect(button).toBeInViewport();
    const bounds = await button.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 320) + (bounds?.width ?? 1)).toBeLessThanOrEqual(320);
  }
});

test('an unknown public URL visibly offers a way back to sign-in', async ({ page }) => {
  await page.goto('/page-introuvable-test');
  await expect(page.getByText('Oups ! Page introuvable')).toBeVisible();
  await page.getByRole('button', { name: /Retourner à l.accueil/ }).click();
  await expect(page.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible();
});

test('consent can be given and withdrawn with the keyboard across reloads', async ({ page }) => {
  await page.goto('/onboarding/login');
  const consent = page.getByRole('checkbox');
  await expect(consent).not.toBeChecked();
  await consent.focus();
  await expect(consent).toBeFocused();
  await page.keyboard.press('Space');
  await expect(consent).toBeChecked();
  await page.reload();
  await expect(consent).toBeChecked();
  await consent.focus();
  await page.keyboard.press('Space');
  await expect(consent).not.toBeChecked();
  await page.reload();
  await expect(consent).not.toBeChecked();
});

test('a short screen can scroll to the support link without clipping it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto('/onboarding/login');
  const contact = page.getByRole('link', { name: /Besoin d.un coup de main/ });
  await contact.scrollIntoViewIfNeeded();
  await expect(contact).toBeInViewport({ ratio: 1 });
  await contact.click();
  await expect(page).toHaveURL(/\/contact$/);
});
