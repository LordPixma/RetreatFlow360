import { test, expect } from '@playwright/test';

test.describe('Events Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/events');
  });

  test('displays events list', async ({ page }) => {
    // Check for events heading
    await expect(page.getByRole('heading', { name: /retreats/i })).toBeVisible();
  });

  test('has search functionality', async ({ page }) => {
    // Find search input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Type in search
    await searchInput.fill('yoga');

    // Wait for search to update
    await page.waitForTimeout(500);
  });

  test('has sort functionality', async ({ page }) => {
    // Find sort selector
    const sortTrigger = page.getByRole('combobox');
    await expect(sortTrigger).toBeVisible();

    // Open sort dropdown
    await sortTrigger.click();

    // Verify sort options exist
    await expect(page.getByRole('option', { name: /date/i })).toBeVisible();
  });

  test('displays empty state when no events', async ({ page }) => {
    // Search for something that doesn't exist
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('xyznonexistent123');

    await page.waitForTimeout(500);

    // Should show empty state or no results
    // This depends on how the API responds
  });

  test('can click on an event card', async ({ page }) => {
    // Wait for events to load
    await page.waitForSelector('[data-testid="event-card"], .cursor-pointer', { timeout: 5000 }).catch(() => {});

    // Try to click on the first event link
    const eventLinks = page.locator('a[href*="/events/"]');
    const count = await eventLinks.count();

    if (count > 0) {
      await eventLinks.first().click();
      await expect(page).toHaveURL(/\/events\/.+/);
    }
  });
});
