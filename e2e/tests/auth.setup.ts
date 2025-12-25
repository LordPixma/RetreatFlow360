import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/auth/login');

  // Fill in login credentials
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('testpassword123');

  // Click login button
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to dashboard/events
  await page.waitForURL(/\/(events|dashboard)/);

  // Verify we're logged in
  await expect(page.getByRole('navigation')).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
