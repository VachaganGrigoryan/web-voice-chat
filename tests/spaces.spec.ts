import { test, expect } from '@playwright/test';

test.describe('Spaces UI E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Print browser console logs
    page.on('console', msg => console.log(`BROWSER CONSOLE [${msg.type()}]:`, msg.text()));
    page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message));

    // Generate a valid-looking JWT token for localStorage
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/=/g, '');
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64').replace(/=/g, '');
    const fakeToken = `${header}.${payload}.signature`;

    // Capture and mock all API calls
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      const isApiRequest = url.includes('localhost:8000') || url.includes('voca-api.notallow.cc');
      
      if (isApiRequest) {
        if (url.includes('/users/me')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'user-123',
                username: 'test_user',
                display_name: 'Test User',
                email: 'test@example.com',
                is_verified: true,
                avatar: null,
              }
            })
          });
        } else if (url.includes('/spaces/me')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [
                {
                  id: 'space-1',
                  name: 'Acme Space',
                  slug: 'acme-space',
                  kind: 'workspace',
                  visibility: 'private',
                  created_by: 'user-123',
                  settings: {},
                  created_at: new Date().toISOString(),
                }
              ]
            })
          });
        } else if (url.includes('/conversations')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [],
              meta: { next_cursor: null }
            })
          });
        } else {
          // Catch-all mock for other API requests to prevent 401 from real backend
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: []
            })
          });
        }
      } else {
        await route.continue();
      }
    });

    // Navigate to set localStorage on the correct domain origin first
    await page.goto('/');
    await page.evaluate((token) => {
      window.localStorage.setItem('auth_access_token', token);
      window.localStorage.setItem('auth_refresh_token', 'fake_refresh_token');
    }, fakeToken);
    await page.reload();
  });

  test('should display space switcher with correct items and toggle dropdown', async ({ page }) => {
    // Navigate again to reload with active session
    await page.goto('/#/chat');

    // Assert that the SpaceSwitcher button is visible with "Global Chats" (with 15s timeout for compilation)
    const switcherBtn = page.getByRole('button', { name: 'Switch space' });
    await expect(switcherBtn).toBeVisible({ timeout: 15000 });

    // Click the space switcher to open dropdown
    await switcherBtn.click();

    // Assert dropdown options are visible
    await expect(page.getByRole('button', { name: 'Global Chats' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Acme Space' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create a Space' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Space / Enter Invite' })).toBeVisible();
  });

  test('should open Create Space dialog', async ({ page }) => {
    // Navigate again to reload with active session
    await page.goto('/#/chat');

    // Wait for the button to be visible on initial load
    const switcherBtn = page.getByRole('button', { name: 'Switch space' });
    await expect(switcherBtn).toBeVisible({ timeout: 15000 });
    await switcherBtn.click();

    const createSpaceBtn = page.getByRole('button', { name: 'Create a Space' });
    await createSpaceBtn.click();

    // Verify dialog elements are visible
    await expect(page.getByRole('heading', { name: 'Create a Space' })).toBeVisible();
    await expect(page.getByLabel('Space Name')).toBeVisible();
    await expect(page.getByLabel('Space URL Slug')).toBeVisible();
  });
});
