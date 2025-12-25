import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('has title', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/RetreatFlow/i);
  });

  test('displays hero section', async ({ page }) => {
    await page.goto('/');

    // Verify hero section is visible
    await expect(page.locator('h1')).toBeVisible();
  });

  test('has navigation links', async ({ page }) => {
    await page.goto('/');

    // Check for navigation
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();

    // Check for events link
    const eventsLink = page.getByRole('link', { name: /events/i });
    await expect(eventsLink).toBeVisible();
  });

  test('can navigate to events page', async ({ page }) => {
    await page.goto('/');

    // Click on events link
    await page.getByRole('link', { name: /events/i }).click();

    // Verify we're on events page
    await expect(page).toHaveURL(/\/events/);
  });
});
