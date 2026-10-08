import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as createRequestContext, test, type Browser, type Page } from '@playwright/test';
import { API_URL, MAILHOG_URL, seedDemoWorld, type DemoSession, type DemoWorld } from './seed';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../docs/screenshots');
const BACKEND_IMAGES_DIR = path.resolve(HERE, '../../VoiceChat/docs/images');

interface Shot {
  name: string;
  route: (world: DemoWorld) => string;
  theme?: 'light' | 'dark';
  mobile?: boolean;
}

const SHOTS: Shot[] = [
  { name: 'chat-dm', route: (w) => `/dms/${w.dmId}` },
  { name: 'chat-dm-dark', route: (w) => `/dms/${w.dmId}`, theme: 'dark' },
  { name: 'chat-thread', route: (w) => `/dms/${w.dmId}/thread/${w.dmThreadRootId}` },
  { name: 'chat-group', route: (w) => `/groups/${w.groupId}/chat` },
  { name: 'channel-feed', route: (w) => `/spaces/${w.spaceId}/channels/${w.announcementsId}/feed` },
  {
    name: 'channel-feed-dark',
    route: (w) => `/spaces/${w.spaceId}/channels/${w.announcementsId}/feed`,
    theme: 'dark',
  },
  { name: 'channel-chat', route: (w) => `/spaces/${w.spaceId}/channels/${w.designId}/chat` },
  { name: 'space-home', route: (w) => `/spaces/${w.spaceId}` },
  { name: 'feed-home', route: () => '/feed' },
  { name: 'discover', route: () => '/discover/channels' },
  { name: 'people', route: () => '/people/contacts' },
  { name: 'activity', route: () => '/activity/requests' },
  { name: 'profile', route: () => '/me' },
  { name: 'settings-appearance', route: () => '/settings/appearance' },
  { name: 'manage-channel', route: (w) => `/spaces/${w.spaceId}/channels/${w.announcementsId}/manage/general` },
  { name: 'manage-hub', route: () => '/manage/channels' },
  { name: 'mobile-inbox', route: () => '/chat', mobile: true },
  { name: 'mobile-chat', route: (w) => `/dms/${w.dmId}`, mobile: true },
];

/** Shots also copied into the backend repo for its README. */
const BACKEND_HEROES = new Set(['chat-dm', 'channel-feed']);

async function settle(page: Page): Promise<void> {
  // Socket.IO keeps a connection open, so networkidle may never arrive; a
  // bounded wait plus a short pause is enough for the initial fetches.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(1_200);
}

async function openContext(
  browser: Browser,
  shot: Pick<Shot, 'theme' | 'mobile'>,
  session?: DemoSession
) {
  const context = await browser.newContext(
    shot.mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } }
  );
  // Seeded before any app code runs: the app reads both on boot, and hash
  // navigation alone would never reload it to pick up a later change.
  await context.addInitScript(
    ({ mode, tokens }) => {
      localStorage.setItem('vite-ui-theme-mode', mode);
      if (tokens) {
        localStorage.setItem('auth_access_token', tokens.access_token);
        localStorage.setItem('auth_refresh_token', tokens.refresh_token);
      }
    },
    { mode: shot.theme ?? 'light', tokens: session?.tokens ?? null }
  );
  return context;
}

test('captures documentation screenshots', async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const api = await createRequestContext.newContext({ baseURL: API_URL });
  const mailhog = await createRequestContext.newContext({ baseURL: MAILHOG_URL });
  const world = await seedDemoWorld(api, mailhog);

  for (const [name, route] of [
    ['landing', '/'],
    ['auth', '/auth'],
  ] as const) {
    const context = await openContext(browser, {});
    const page = await context.newPage();
    await page.goto(`/#${route}`);
    await settle(page);
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
    await context.close();
  }

  for (const shot of SHOTS) {
    const context = await openContext(browser, shot, world.viewer);
    const page = await context.newPage();
    await page.goto(`/#${shot.route(world)}`);
    await settle(page);
    await page.screenshot({ path: path.join(OUT_DIR, `${shot.name}.png`) });
    if (BACKEND_HEROES.has(shot.name)) {
      await page.screenshot({ path: path.join(BACKEND_IMAGES_DIR, `${shot.name}.png`) });
    }
    await context.close();
  }

  const swaggerContext = await openContext(browser, {});
  const swagger = await swaggerContext.newPage();
  await swagger.goto(`${API_URL}/docs`);
  await swagger.locator('.opblock-tag').first().waitFor();
  await swagger.screenshot({ path: path.join(BACKEND_IMAGES_DIR, 'swagger-ui.png') });
  await swaggerContext.close();

  await api.dispose();
  await mailhog.dispose();
});
