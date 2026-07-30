import {
  expect,
  request as createRequestContext,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';

const API_URL = 'http://127.0.0.1:8001';
const MAILHOG_URL = 'http://127.0.0.1:8025';

interface ApiEnvelope<T> {
  data: T;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

interface TestUser {
  id: string;
  username: string;
}

interface TestSession {
  tokens: AuthTokens;
  user: TestUser;
}

interface Relationship {
  id: string;
}

interface Conversation {
  id: string;
}

interface Channel {
  id: string;
  name: string;
}

interface UserChannel {
  id: string;
}

interface Message {
  id: string;
}

interface MailhogMessage {
  Content: {
    Headers: Record<string, string[]>;
    Body: string;
  };
}

interface MailhogResponse {
  items: MailhogMessage[];
}

async function readData<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as ApiEnvelope<T>;
  return body.data;
}

async function findVerificationCode(
  mailhog: APIRequestContext,
  email: string
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await mailhog.get('/api/v2/messages');
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as MailhogResponse;
    const message = payload.items.find((item) =>
      item.Content.Headers.To?.some((value) => value.includes(email))
    );
    const code = message?.Content.Body.match(/Code:\s*(\d{6})/)?.[1];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Verification email was not received for ${email}`);
}

async function createSession(
  api: APIRequestContext,
  mailhog: APIRequestContext,
  label: string
): Promise<TestSession> {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const email = `fe-${label}-${nonce}@test.com`;
  const username = `fe-${label}-${nonce.replaceAll('-', '').slice(-10)}`;
  const rateLimitHeaders = { 'x-forwarded-for': `fe-smoke-${nonce}` };

  const startResponse = await api.post('/auth/start', {
    headers: rateLimitHeaders,
    data: { method: 'email', identifier: email },
  });
  expect(startResponse.ok(), await startResponse.text()).toBe(true);

  const code = await findVerificationCode(mailhog, email);
  const tokens = await readData<AuthTokens>(
    await api.post('/auth/finish', {
      headers: rateLimitHeaders,
      data: { method: 'email', identifier: email, code },
    })
  );
  const headers = { Authorization: `Bearer ${tokens.access_token}` };
  await readData<TestUser>(
    await api.patch('/users/me/username', {
      headers,
      data: { username },
    })
  );
  const user = await readData<TestUser>(
    await api.get('/users/me', { headers })
  );
  return { tokens, user };
}

async function authenticatePage(
  page: Page,
  session: TestSession
): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ accessToken, refreshToken }) => {
      localStorage.setItem('auth_access_token', accessToken);
      localStorage.setItem('auth_refresh_token', refreshToken);
    },
    {
      accessToken: session.tokens.access_token,
      refreshToken: session.tokens.refresh_token,
    }
  );
  await page.reload();
}

test('smokes unified DM, follow, membership, channel, and feed flows', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const api = await createRequestContext.newContext({ baseURL: API_URL });
  const mailhog = await createRequestContext.newContext({ baseURL: MAILHOG_URL });
  const owner = await createSession(api, mailhog, 'owner');
  const viewer = await createSession(api, mailhog, 'viewer');
  const ownerHeaders = {
    Authorization: `Bearer ${owner.tokens.access_token}`,
  };
  const viewerHeaders = {
    Authorization: `Bearer ${viewer.tokens.access_token}`,
  };

  const [profileChannel] = await readData<UserChannel[]>(
    await api.get(`/users/${owner.user.id}/channels`, { headers: ownerHeaders })
  );
  expect(profileChannel).toBeDefined();
  const profileFeedPost = `Profile feed post ${Date.now()}`;
  await readData<Message>(
    await api.post(`/channels/${profileChannel.id}/messages`, {
      headers: ownerHeaders,
      data: { text: profileFeedPost },
    })
  );

  const channel = await readData<Channel>(
    await api.post('/channels', {
      headers: ownerHeaders,
      data: {
        name: 'Frontend domain smoke',
        slug: `fe-smoke-${Date.now()}`,
        visibility: 'public',
        join_policy: 'open',
        posting_policy: 'everyone',
        comment_policy: 'everyone',
      },
    })
  );
  await readData<Message>(
    await api.post(`/channels/${channel.id}/messages`, {
      headers: ownerHeaders,
      data: { text: 'Initial channel post' },
    })
  );

  const connection = await readData<Relationship>(
    await api.post(`/connections/${owner.user.id}/ping`, {
      headers: viewerHeaders,
    })
  );
  await readData<Relationship>(
    await api.post(`/connections/${connection.id}/accept`, {
      headers: ownerHeaders,
    })
  );
  const dm = await readData<Conversation>(
    await api.post('/conversations', {
      headers: viewerHeaders,
      data: { peer_user_id: owner.user.id },
    })
  );

  const ownerContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const viewerPage = await viewerContext.newPage();
  await authenticatePage(ownerPage, owner);
  await authenticatePage(viewerPage, viewer);

  await ownerPage.goto(`/#/chat/${dm.id}`);
  await viewerPage.goto(`/#/chat/${dm.id}`);
  const dmText = `DM container ${Date.now()}`;
  await viewerPage.getByPlaceholder('Message').fill(dmText);
  await viewerPage.getByRole('button', { name: 'Send message' }).click();
  await expect(
    ownerPage.getByRole('paragraph').filter({ hasText: dmText })
  ).toBeVisible({ timeout: 15_000 });

  await viewerPage.goto(`/#/channels/${channel.id}`);
  await expect(viewerPage.getByRole('heading', { name: channel.name })).toBeVisible();
  await expect(viewerPage.getByText('Initial channel post')).toBeVisible();

  const joinResponse = viewerPage.waitForResponse(
    (response) =>
      response.url().endsWith(`/channels/${channel.id}/join`) &&
      response.request().method() === 'POST'
  );
  await viewerPage.getByRole('button', { name: 'Join' }).click();
  expect((await joinResponse).ok()).toBe(true);

  await viewerPage.getByRole('button', { name: 'Follow' }).click();
  await expect(
    viewerPage.getByRole('button', { name: 'Following' })
  ).toBeVisible();

  await viewerPage.getByRole('button', { name: /0 comments/ }).click();
  const commentText = `Channel comment ${Date.now()}`;
  await viewerPage.getByLabel('Add a comment').fill(commentText);
  await viewerPage.getByRole('button', { name: 'Post comment' }).click();
  await expect(viewerPage.getByText(commentText)).toBeVisible();

  const publishedPost = `Published channel post ${Date.now()}`;
  await viewerPage.getByLabel('Write a post').fill(publishedPost);
  await viewerPage.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(viewerPage.getByText(publishedPost)).toBeVisible();

  const realtimePost = `Realtime channel post ${Date.now()}`;
  await readData<Message>(
    await api.post(`/channels/${channel.id}/messages`, {
      headers: ownerHeaders,
      data: { text: realtimePost },
    })
  );
  await expect(viewerPage.getByText(realtimePost)).toBeVisible({ timeout: 15_000 });

  // /feeds/* is retired: each of these now resolves through a redirect rather
  // than rendering its own page (home feed, the channel's canonical page, and
  // a directory-search-based profile resolution, respectively).
  await viewerPage.goto('/#/feeds');
  await expect(viewerPage.getByText(realtimePost)).toBeVisible();
  await viewerPage.goto(`/#/feeds/channels/${channel.id}`);
  await expect(viewerPage.getByText(realtimePost)).toBeVisible();
  await viewerPage.goto(`/#/feeds/users/${owner.user.username}`);
  await expect(viewerPage.getByText(profileFeedPost)).toBeVisible();

  await viewerPage.goto('/#/feed/saved');
  await expect(viewerPage.getByText('Nothing saved yet.')).toBeVisible();

  // Discover's four tabs query the directory API rather than the viewer's own
  // memberships, so they surface the channel and the default space even
  // though the viewer only just followed/joined them.
  await viewerPage.goto('/#/discover/channels');
  await viewerPage.locator('#discover-search').fill(channel.name);
  await expect(viewerPage.getByText(channel.name)).toBeVisible();
  await expect(viewerPage.getByRole('button', { name: 'Following' })).toBeVisible();

  await viewerPage.goto('/#/discover/people');
  await viewerPage.locator('#discover-search').fill(owner.user.username);
  await expect(viewerPage.getByText(`@${owner.user.username}`)).toBeVisible();

  await viewerPage.goto('/#/discover/spaces');
  await expect(viewerPage.getByText('Default space', { exact: false })).toBeVisible();
  await expect(viewerPage.getByRole('button', { name: 'Join' })).not.toBeVisible();

  await viewerPage.goto('/#/discover/groups');
  await expect(viewerPage.getByText('No groups to show yet.')).toBeVisible();

  // People tabs: the social graph only, resolved to displayable rows.
  await viewerPage.goto('/#/people/contacts');
  await expect(viewerPage.getByText(`@${owner.user.username}`)).toBeVisible();

  await viewerPage.goto('/#/people/following');
  await expect(viewerPage.getByText(channel.name)).toBeVisible();

  await viewerPage.goto('/#/people/followers');
  await expect(viewerPage.getByText('No followers yet.')).toBeVisible();

  await viewerPage.goto('/#/people/blocked');
  await expect(viewerPage.getByText('You have not blocked anyone.')).toBeVisible();

  await readData<TestUser>(
    await api.patch('/users/me', {
      headers: ownerHeaders,
      data: { is_private: true },
    })
  );
  await viewerPage.goto(`/#/profile/${owner.user.id}`);
  await viewerPage.getByRole('button', { name: 'Follow', exact: true }).click();
  await expect(viewerPage.getByRole('button', { name: 'Pending' })).toBeVisible();

  await ownerContext.close();
  await viewerContext.close();
  await api.dispose();
  await mailhog.dispose();
});
