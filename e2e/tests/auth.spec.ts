import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('can navigate to login page', async ({ page }) => {
    await page.goto('/');

    // Find and click login link
    await page.getByRole('link', { name: /sign in|log in|login/i }).click();

    // Verify we're on login page
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('login form is displayed', async ({ page }) => {
    await page.goto('/auth/login');

    // Check for email input
    await expect(page.getByLabel(/email/i)).toBeVisible();

    // Check for password input
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Check for submit button
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');

    // Click login
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to register page', async ({ page }) => {
    await page.goto('/auth/login');

    // Find and click register link
    await page.getByRole('link', { name: /sign up|register|create account/i }).click();

    // Verify we're on register page
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('register form is displayed', async ({ page }) => {
    await page.goto('/auth/register');

    // Check for name inputs
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();

    // Check for email input
    await expect(page.getByLabel(/email/i)).toBeVisible();

    // Check for password input
    await expect(page.getByLabel(/password/i).first()).toBeVisible();

    // Check for submit button
    await expect(page.getByRole('button', { name: /sign up|register|create/i })).toBeVisible();
  });
});
