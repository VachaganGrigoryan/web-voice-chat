import { test, expect } from '@playwright/test';

test.describe('App UI Test', () => {
  test('should load the main page and verify heading/title', async ({ page }) => {
    // Navigate to the root URL (configured as baseURL: 'http://localhost:3000')
    await page.goto('/');

    // Assert that the page title contains "Vogi"
    await expect(page).toHaveTitle(/Vogi/i);
  });
});
