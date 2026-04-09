export type PingsTab = 'incoming' | 'outgoing';
export type SettingsTab =
  | 'profile'
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'passkeys'
  | 'discovery'
  | 'about';

export const PINGS_TABS: PingsTab[] = ['incoming', 'outgoing'];
export const SETTINGS_TABS: SettingsTab[] = [
  'profile',
  'appearance',
  'notifications',
  'privacy',
  'passkeys',
  'discovery',
  'about',
];

export const APP_ROUTES = {
  root: '/',
  auth: '/auth',
  legacyLogin: '/login',
  chat: '/chat',
  chatPeer: (peerUserId: string) => `/chat/${peerUserId}`,
  chatThread: (peerUserId: string, rootMessageId: string) =>
    `/chat/${peerUserId}/thread/${rootMessageId}`,
  pings: '/pings',
  pingsTab: (tab: PingsTab = 'incoming') => `/pings/${tab}`,
  settings: '/settings',
  settingsTab: (tab: SettingsTab = 'profile') => `/settings/${tab}`,
  profile: (userId: string) => `/profile/${userId}`,
  invite: (token: string) => `/invite/${token}`,
} as const;

const LAST_APP_PATH_STORAGE_KEY = 'voca:last-app-path';

const isProtectedAppPath = (path: string) =>
  path.startsWith(APP_ROUTES.chat) ||
  path.startsWith(APP_ROUTES.settings) ||
  path.startsWith(APP_ROUTES.pings) ||
  path.startsWith('/profile/');

export const isPingsTab = (value?: string): value is PingsTab =>
  !!value && PINGS_TABS.includes(value as PingsTab);

export const isSettingsTab = (value?: string): value is SettingsTab =>
  !!value && SETTINGS_TABS.includes(value as SettingsTab);

export const setLastAppPath = (path: string) => {
  if (typeof window === 'undefined' || !isProtectedAppPath(path)) {
    return;
  }

  window.localStorage.setItem(LAST_APP_PATH_STORAGE_KEY, path);
};

export const getLastAppPath = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(LAST_APP_PATH_STORAGE_KEY);
  if (!value || !isProtectedAppPath(value)) {
    return null;
  }

  return value;
};

export const getDefaultAuthedPath = () => getLastAppPath() || APP_ROUTES.chat;

export const getAuthRedirectTarget = (path: string) => {
  const normalized = path.startsWith('/') ? path : APP_ROUTES.chat;
  return `${APP_ROUTES.auth}?redirect=${encodeURIComponent(normalized)}`;
};

export const normalizePostAuthRedirect = (redirect: string | null | undefined) => {
  if (!redirect || !redirect.startsWith('/')) {
    return getDefaultAuthedPath();
  }

  if (
    redirect === APP_ROUTES.auth ||
    redirect === APP_ROUTES.legacyLogin ||
    redirect === '/welcome'
  ) {
    return getDefaultAuthedPath();
  }

  return redirect;
};

export const getAbsoluteAppUrl = (path: string) => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}/#${normalized}`;
};
