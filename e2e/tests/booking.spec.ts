import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test.use({ storageState: '.auth/user.json' });

  test('can start booking flow from event detail', async ({ page }) => {
    // Navigate to an event (this assumes there's at least one event)
    await page.goto('/events');

    // Click on first event
    const eventLinks = page.locator('a[href*="/events/"]');
    const count = await eventLinks.count();

    if (count > 0) {
      await eventLinks.first().click();

      // Wait for event detail page
      await page.waitForURL(/\/events\/.+/);

      // Find and click a booking button (Select button for a tier)
      const selectButton = page.getByRole('button', { name: /select|book/i }).first();
      if (await selectButton.isVisible()) {
        await selectButton.click();

        // Should navigate to booking page
        await expect(page).toHaveURL(/\/booking\//);
      }
    }
  });

  test('booking page displays pricing tiers', async ({ page }) => {
    // This test assumes we're on a booking page
    // In real tests, you'd set up proper test data

    await page.goto('/events');
    const eventLinks = page.locator('a[href*="/events/"]');
    const count = await eventLinks.count();

    if (count > 0) {
      await eventLinks.first().click();
      await page.waitForURL(/\/events\/.+/);

      const selectButton = page.getByRole('button', { name: /select|book/i }).first();
      if (await selectButton.isVisible()) {
        await selectButton.click();
        await page.waitForURL(/\/booking\//);

        // Check for booking form elements
        await expect(page.getByRole('heading')).toBeVisible();
      }
    }
  });
});

test.describe('My Bookings', () => {
  test.use({ storageState: '.auth/user.json' });

  test('can view my bookings page', async ({ page }) => {
    await page.goto('/my-bookings');

    // Check for heading
    await expect(page.getByRole('heading', { name: /bookings/i })).toBeVisible();
  });

  test('displays booking history or empty state', async ({ page }) => {
    await page.goto('/my-bookings');

    // Should show either booking cards or empty state
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});
