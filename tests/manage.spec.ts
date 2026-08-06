import { test, expect } from '@playwright/test';

const CHANNEL_ID = 'channel-1';

test.describe('Management subtree permission guard', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.log('BROWSER EXCEPTION:', err.message));

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/=/g, '');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'user-123', email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 3600 })
    )
      .toString('base64')
      .replace(/=/g, '');
    const fakeToken = `${header}.${payload}.signature`;

    await page.route('**/*', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const isApiRequest = url.includes('localhost:8000') || url.includes('voca-api.notallow.cc');

      if (!isApiRequest) {
        await route.continue();
        return;
      }

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
            },
          }),
        });
        return;
      }

      // The one call this guard actually depends on: a viewer with no
      // `resource.manage` in `allowed`.
      if (url.includes('/viewer/capabilities') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              capabilities: [
                {
                  resource: { type: 'channel', id: CHANNEL_ID },
                  allowed: ['resource.view', 'message.read'],
                  denied: ['resource.manage', 'member.manage', 'role.manage'],
                  standing: { is_owner: false, membership_status: 'active', is_follower: false, role_ids: [] },
                  policy: { visibility: 'public', posting_policy: 'everyone' },
                },
              ],
            },
          }),
        });
        return;
      }

      if (url.includes(`/channels/${CHANNEL_ID}/members`)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
        return;
      }

      if (url.includes(`/channels/${CHANNEL_ID}/roles`)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
        return;
      }

      if (url.includes(`/channels/${CHANNEL_ID}`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: CHANNEL_ID,
              owner: { type: 'user', id: 'someone-else' },
              space_id: null,
              kind: 'standard',
              slug: 'general',
              name: 'General',
              description: null,
              avatar: null,
              banner: null,
              visibility: 'public',
              join_policy: 'open',
              posting_policy: 'everyone',
              comment_policy: 'everyone',
              tags: [],
              message_count: 0,
              follower_count: 3,
              last_message_id: null,
              last_activity_at: null,
              legacy_conversation_id: null,
              created_by: 'someone-else',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      if (url.includes('/conversations') || url.includes('/messages') || url.includes('/spaces/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [], meta: { next_cursor: null } }),
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.goto('/');
    await page.evaluate((token) => {
      window.localStorage.setItem('auth_access_token', token);
      window.localStorage.setItem('auth_refresh_token', 'fake_refresh_token');
    }, fakeToken);
    await page.reload();
  });

  test('a viewer without manage permission sees the not-permitted state, not a blank page', async ({ page }) => {
    await page.goto(`/#/channels/${CHANNEL_ID}/manage/general`);

    // Explicit not-permitted copy, not a spinner-forever or empty pane.
    await expect(page.getByText(/you can't manage this channel/i)).toBeVisible({ timeout: 15000 });

    // No redirect loop: the URL still names the management route the viewer asked for.
    await expect(page).toHaveURL(new RegExp(`#/channels/${CHANNEL_ID}/manage/general$`));

    // The section nav — which only a manager should act on — never rendered.
    await expect(page.getByRole('tab', { name: 'Roles' })).toHaveCount(0);
  });
});
