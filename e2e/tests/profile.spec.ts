import { test, expect } from '@playwright/test';

test.describe('Profile Page', () => {
  test.use({ storageState: '.auth/user.json' });

  test('can access profile page', async ({ page }) => {
    await page.goto('/profile');

    // Check for profile heading
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
  });

  test('displays profile tabs', async ({ page }) => {
    await page.goto('/profile');

    // Check for tabs
    await expect(page.getByRole('tab', { name: /general/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /dietary/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /accessibility/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /calendar/i })).toBeVisible();
  });

  test('general tab shows personal info form', async ({ page }) => {
    await page.goto('/profile');

    // General tab should be active by default
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('can switch to dietary tab', async ({ page }) => {
    await page.goto('/profile');

    // Click dietary tab
    await page.getByRole('tab', { name: /dietary/i }).click();

    // Check for dietary content
    await expect(page.getByText(/allergies/i)).toBeVisible();
    await expect(page.getByText(/preferences/i)).toBeVisible();
  });

  test('can switch to accessibility tab', async ({ page }) => {
    await page.goto('/profile');

    // Click accessibility tab
    await page.getByRole('tab', { name: /accessibility/i }).click();

    // Check for accessibility content
    await expect(page.getByText(/mobility/i)).toBeVisible();
  });

  test('can switch to calendar tab', async ({ page }) => {
    await page.goto('/profile');

    // Click calendar tab
    await page.getByRole('tab', { name: /calendar/i }).click();

    // Check for calendar sync content
    await expect(page.getByText(/calendar/i)).toBeVisible();
  });
});
