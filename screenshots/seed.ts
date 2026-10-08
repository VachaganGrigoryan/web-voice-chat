import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

/**
 * Builds a small, believable world through the real API so screenshots show
 * populated screens. Every run uses a fresh suffix, so it never collides with
 * a previous run's usernames or slugs.
 */

export const API_URL = process.env.SCREENSHOT_API_URL || 'http://127.0.0.1:8002';
export const MAILHOG_URL = process.env.SCREENSHOT_MAILHOG_URL || 'http://127.0.0.1:8025';

interface ApiEnvelope<T> {
  data: T;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

interface Entity {
  id: string;
}

interface MailhogResponse {
  items: { Content: { Headers: Record<string, string[]>; Body: string } }[];
}

export interface DemoSession {
  tokens: AuthTokens;
  userId: string;
  username: string;
  headers: Record<string, string>;
}

export interface DemoWorld {
  viewer: DemoSession;
  peers: Record<'marcus' | 'priya' | 'diego' | 'sam', DemoSession>;
  dmId: string;
  dmThreadRootId: string;
  groupId: string;
  spaceId: string;
  announcementsId: string;
  designId: string;
}

interface Persona {
  key: string;
  displayName: string;
  bio: string;
  pronouns?: string;
}

const PERSONAS = {
  ava: {
    key: 'ava',
    displayName: 'Ava Chen',
    bio: 'Product designer. Sketching interfaces, collecting typefaces.',
    pronouns: 'she/her',
  },
  marcus: { key: 'marcus', displayName: 'Marcus Lee', bio: 'Frontend engineer at Northwind.' },
  priya: { key: 'priya', displayName: 'Priya Nair', bio: 'Research lead. Coffee-powered.' },
  diego: { key: 'diego', displayName: 'Diego Alvarez', bio: 'Backend, infra, and bad puns.' },
  sam: { key: 'sam', displayName: 'Sam Okafor', bio: 'Community manager.' },
} satisfies Record<string, Persona>;

async function readData<T>(response: APIResponse): Promise<T> {
  const body = await response.text();
  expect(response.ok(), `${response.url()} → ${body}`).toBe(true);
  // Some actions answer 204 with no body; callers of those ignore the result.
  return body ? (JSON.parse(body) as ApiEnvelope<T>).data : (undefined as T);
}

async function findVerificationCode(mailhog: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
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
  persona: Persona,
  suffix: string
): Promise<DemoSession> {
  const email = `${persona.key}-${suffix}@example.com`;
  const username = `${persona.key}-${suffix}`;
  // A distinct forwarded address per persona keeps the auth rate limiter from
  // treating the whole seed run as one client.
  const rateLimitHeaders = { 'x-forwarded-for': `screenshots-${persona.key}-${suffix}` };

  await readData(
    await api.post('/auth/start', {
      headers: rateLimitHeaders,
      data: { method: 'email', identifier: email },
    })
  );
  const code = await findVerificationCode(mailhog, email);
  const tokens = await readData<AuthTokens>(
    await api.post('/auth/finish', {
      headers: rateLimitHeaders,
      data: { method: 'email', identifier: email, code },
    })
  );
  const headers = { ...rateLimitHeaders, Authorization: `Bearer ${tokens.access_token}` };
  await readData(await api.patch('/users/me/username', { headers, data: { username } }));
  await readData(
    await api.patch('/users/me', {
      headers,
      data: { display_name: persona.displayName, bio: persona.bio, pronouns: persona.pronouns },
    })
  );
  const me = await readData<Entity>(await api.get('/users/me', { headers }));
  return { tokens, userId: me.id, username, headers };
}

async function connect(api: APIRequestContext, from: DemoSession, to: DemoSession): Promise<void> {
  const relationship = await readData<Entity>(
    await api.post(`/connections/${to.userId}/ping`, { headers: from.headers })
  );
  await readData(await api.post(`/connections/${relationship.id}/accept`, { headers: to.headers }));
}

async function send(
  api: APIRequestContext,
  author: DemoSession,
  containerType: 'conversation' | 'channel',
  containerId: string,
  text: string,
  replyTo?: string
): Promise<string> {
  const message = await readData<Entity>(
    await api.post(`/messages/${containerType}/${containerId}/text`, {
      headers: author.headers,
      data: replyTo ? { text, reply_to_message_id: replyTo, reply_mode: 'thread' } : { text },
    })
  );
  return message.id;
}

async function react(
  api: APIRequestContext,
  author: DemoSession,
  messageId: string,
  emoji: string
): Promise<void> {
  await readData(
    await api.post(`/messages/${messageId}/reactions`, { headers: author.headers, data: { emoji } })
  );
}

export async function seedDemoWorld(
  api: APIRequestContext,
  mailhog: APIRequestContext
): Promise<DemoWorld> {
  const suffix = Math.random().toString(16).slice(2, 6);
  const ava = await createSession(api, mailhog, PERSONAS.ava, suffix);
  const marcus = await createSession(api, mailhog, PERSONAS.marcus, suffix);
  const priya = await createSession(api, mailhog, PERSONAS.priya, suffix);
  const diego = await createSession(api, mailhog, PERSONAS.diego, suffix);
  const sam = await createSession(api, mailhog, PERSONAS.sam, suffix);

  await readData(
    await api.patch('/users/me/status', {
      headers: ava.headers,
      data: { status_emoji: '🎨', status_text: 'Reviewing the launch mocks' },
    })
  );

  await connect(api, marcus, ava);
  await connect(api, ava, priya);
  await connect(api, diego, ava);
  // Left pending on purpose so Activity → Requests has something to show.
  await readData(await api.post(`/connections/${ava.userId}/ping`, { headers: sam.headers }));
  await readData(await api.post(`/users/${ava.userId}/follow`, { headers: marcus.headers }));
  await readData(await api.post(`/users/${ava.userId}/follow`, { headers: priya.headers }));
  await readData(await api.post(`/users/${priya.userId}/follow`, { headers: ava.headers }));
  await readData(await api.post(`/users/${marcus.userId}/follow`, { headers: ava.headers }));

  // Profile posts, so the profile page and the home feed have content.
  for (const [author, text] of [
    [ava, 'New year, new type scale. Moving the whole product to a 1.2 ratio and it already feels calmer.'],
    [priya, 'Five interviews in, one theme keeps coming back: people want threads that do not bury the main conversation.'],
    [marcus, 'Shipped the new composer today. Drafts now survive a refresh 🎉'],
  ] as const) {
    await readData(await api.post('/users/me/posts', { headers: author.headers, data: { text } }));
  }

  // Direct messages, the hero conversation first.
  const priyaDm = await readData<Entity>(
    await api.post('/conversations', { headers: ava.headers, data: { peer_user_id: priya.userId } })
  );
  await send(api, priya, 'conversation', priyaDm.id, 'Interview notes are in the shared folder 📁');
  await send(api, ava, 'conversation', priyaDm.id, 'Perfect, reading them tonight.');

  const diegoDm = await readData<Entity>(
    await api.post('/conversations', { headers: ava.headers, data: { peer_user_id: diego.userId } })
  );
  await send(api, diego, 'conversation', diegoDm.id, 'Staging is green again. Ship it?');

  const dm = await readData<Entity>(
    await api.post('/conversations', { headers: ava.headers, data: { peer_user_id: marcus.userId } })
  );
  await send(api, marcus, 'conversation', dm.id, 'Morning! Did you get a chance to look at the new onboarding flow?');
  await send(api, ava, 'conversation', dm.id, 'Just did. The step indicator is so much clearer now 👏');
  const rootId = await send(
    api,
    ava,
    'conversation',
    dm.id,
    'One thought: could the "Skip" link sit next to "Continue" instead of the top corner?'
  );
  await send(api, marcus, 'conversation', dm.id, 'Good call, people kept missing it in testing.', rootId);
  await send(api, ava, 'conversation', dm.id, 'Same height, secondary style. I can mock it up.', rootId);
  await send(api, marcus, 'conversation', dm.id, 'Deal. I will wire it up after lunch.', rootId);
  await react(api, marcus, rootId, '👍');
  await send(api, marcus, 'conversation', dm.id, 'Also, demo for the team is moved to Thursday 3pm.');
  const lastId = await send(api, ava, 'conversation', dm.id, 'Works for me. See you there!');
  await react(api, marcus, lastId, '🎉');

  // A group conversation.
  const group = await readData<Entity>(
    await api.post('/conversations/groups', {
      headers: ava.headers,
      data: { title: 'Launch crew', participant_ids: [marcus.userId, priya.userId, diego.userId] },
    })
  );
  await send(api, diego, 'conversation', group.id, 'Release branch is cut. Freeze starts now ❄️');
  await send(api, priya, 'conversation', group.id, 'Help center articles are ready for review.');
  const groupMsg = await send(api, marcus, 'conversation', group.id, 'Final QA pass tomorrow morning, then we go.');
  await react(api, ava, groupMsg, '🚀');
  await react(api, diego, groupMsg, '🚀');
  await send(api, ava, 'conversation', group.id, 'Love it. I will prep the announcement post.');

  // A space with an announcement channel (feed) and a discussion channel (chat).
  const space = await readData<Entity>(
    await api.post('/spaces', {
      headers: ava.headers,
      data: {
        name: 'Northwind Studio',
        slug: `northwind-${suffix}`,
        kind: 'community',
        visibility: 'public',
        join_policy: 'open',
      },
    })
  );
  const announcements = await readData<Entity>(
    await api.post(`/spaces/${space.id}/channels`, {
      headers: ava.headers,
      data: {
        name: 'Announcements',
        slug: `announcements-${suffix}`,
        kind: 'announcement',
        description: 'Product news and release notes from the Northwind team.',
        visibility: 'public',
        posting_policy: 'owner',
        comment_policy: 'everyone',
      },
    })
  );
  const design = await readData<Entity>(
    await api.post(`/spaces/${space.id}/channels`, {
      headers: ava.headers,
      data: {
        name: 'Design crit',
        slug: `design-crit-${suffix}`,
        kind: 'text',
        description: 'Share work in progress and get feedback.',
        visibility: 'public',
        posting_policy: 'everyone',
        comment_policy: 'everyone',
      },
    })
  );
  for (const member of [marcus, priya, diego]) {
    // Joining a space always files a request, even under an open policy.
    const joinRequest = await readData<Entity>(
      await api.post(`/spaces/${space.id}/join`, { headers: member.headers })
    );
    await readData(
      await api.post(`/spaces/${space.id}/join-requests/${joinRequest.id}/approve`, {
        headers: ava.headers,
      })
    );
    for (const channel of [announcements, design]) {
      await readData(await api.post(`/channels/${channel.id}/join`, { headers: member.headers }));
    }
  }

  for (const follower of [ava, marcus, priya, diego]) {
    for (const channel of [announcements, design]) {
      await readData(await api.post(`/channels/${channel.id}/follow`, { headers: follower.headers }));
    }
  }

  await send(
    api,
    ava,
    'channel',
    announcements.id,
    'Welcome to Northwind Studio 👋 This is where we share releases, roadmaps and the occasional behind-the-scenes look.'
  );
  const post = await send(
    api,
    ava,
    'channel',
    announcements.id,
    'Version 2.0 is live! Spaces, channels with a feed and a chat view, threaded replies, and a brand new settings experience. Thank you all for the feedback that shaped it.'
  );
  await send(api, marcus, 'channel', announcements.id, 'Huge milestone, congrats team!', post);
  await send(api, priya, 'channel', announcements.id, 'The new threads are exactly what we asked for 🙌', post);
  await react(api, marcus, post, '❤️');
  await react(api, priya, post, '❤️');
  await react(api, diego, post, '🎉');
  await readData(
    await api.post('/me/saved-messages', {
      headers: ava.headers,
      data: { container_type: 'channel', container_id: announcements.id, message_id: post },
    })
  );

  await send(api, priya, 'channel', design.id, 'Posting the new empty states for the inbox. Thoughts?');
  const crit = await send(api, marcus, 'channel', design.id, 'The illustrations are great. Maybe tone down the accent color a little?');
  await send(api, diego, 'channel', design.id, '+1, it fights with the unread badge.', crit);
  await send(api, ava, 'channel', design.id, 'Agreed. Let us try the muted variant from the palette.');
  await react(api, priya, crit, '👀');

  // Public channels Ava has not joined, so Discover has something to offer.
  for (const [owner, name, description] of [
    [sam, 'Type & Tea', 'A slow channel about typography, lettering and good tea.'],
    [diego, 'Infra notes', 'Postmortems, runbooks and the occasional war story.'],
    [priya, 'Research digest', 'Weekly highlights from user interviews and studies.'],
  ] as const) {
    const channel = await readData<Entity>(
      await api.post('/channels', {
        headers: owner.headers,
        data: {
          name,
          slug: `${name.toLowerCase().replace(/[^a-z]+/g, '-')}-${suffix}`,
          description,
          kind: 'text',
          visibility: 'public',
          join_policy: 'open',
          posting_policy: 'everyone',
          comment_policy: 'everyone',
        },
      })
    );
    await send(api, owner, 'channel', channel.id, `Welcome to ${name}!`);
  }

  return {
    viewer: ava,
    peers: { marcus, priya, diego, sam },
    dmId: dm.id,
    dmThreadRootId: rootId,
    groupId: group.id,
    spaceId: space.id,
    announcementsId: announcements.id,
    designId: design.id,
  };
}
