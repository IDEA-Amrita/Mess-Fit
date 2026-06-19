import { test, expect } from '@playwright/test';

test('login page loads and requires email', async ({ page }) => {
  // Go to the sign-in page
  await page.goto('/auth/login');

  // Verify text
  await expect(page.getByText('Welcome back')).toBeVisible();

  // Try to submit without email
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Check the email input exists
  const emailInput = page.getByPlaceholder('you@example.com');
  await expect(emailInput).toBeVisible();
  
  // Fill invalid email
  await emailInput.fill('invalid-email');
  await page.getByRole('button', { name: 'Sign in' }).click();
  
  // We expect it doesn't navigate away
  await expect(page).toHaveURL(/.*\/auth\/login/);
});
