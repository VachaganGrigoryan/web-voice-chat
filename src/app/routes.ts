export type NotificationTab = 'all' | 'requests' | 'sent' | 'notifications' | 'incoming' | 'outgoing';
export type PingsTab = NotificationTab;
import { SETTINGS_NAV_ITEMS } from '@/features/settings/config';

export type SettingsTab = (typeof SETTINGS_NAV_ITEMS)[number]['id'];

/** Tabs that no longer exist, mapped to wherever their content moved. */
export const LEGACY_SETTINGS_REDIRECTS: Record<string, string> = {
  profile: '/me',
  discovery: '/settings/privacy',
  passkeys: '/settings/account',
  about: '/settings/account',
};
/** Roles, invites, requests and settings moved to the space's `/manage/*` subtree. */
export type SpacesTab = 'members' | 'channels' | 'groups';
export type ChannelTab = 'feed' | 'chat' | 'about' | 'members';

/** Chat-mode destinations. The sidebar view is derived from the URL, not local state. */
export type ChatView = 'chats';

/**
 * Literal segments that appear where `/chat/:conversationId` could otherwise
 * swallow them. Route declaration order already guards this (`channels`
 * precedes the param route in App.tsx); this list lets the route-param parser
 * enforce the same guarantee so a future literal segment cannot silently be
 * misread as a conversation id.
 */
export const CHAT_RESERVED_SEGMENTS = ['channels', 'dms', 'groups'] as const;

/** Requests/sent deliberately live on Activity, not here, so they have one home. */
export type PeopleTab = 'contacts' | 'following' | 'followers' | 'blocked';
export type ActivityTab = 'all' | 'mentions' | 'requests' | 'sent' | 'call-logs';
export type FeedTab = 'home' | 'saved';
export type DiscoverTab = 'people' | 'channels' | 'spaces' | 'groups';
export type ManageTab = 'people' | 'spaces' | 'channels' | 'groups';

export const NOTIFICATION_TABS: NotificationTab[] = [
  'all',
  'requests',
  'sent',
  'notifications',
  'incoming',
  'outgoing',
];
export const PINGS_TABS: PingsTab[] = NOTIFICATION_TABS;
export const SETTINGS_TABS: SettingsTab[] = SETTINGS_NAV_ITEMS.map((item) => item.id);
export const SPACES_TABS: SpacesTab[] = ['members', 'channels', 'groups'];
export const CHANNEL_TABS: ChannelTab[] = ['feed', 'chat', 'about', 'members'];
export const PEOPLE_TABS: PeopleTab[] = ['contacts', 'following', 'followers', 'blocked'];
export const ACTIVITY_TABS: ActivityTab[] = ['all', 'mentions', 'requests', 'sent', 'call-logs'];
export const FEED_TABS: FeedTab[] = ['home', 'saved'];
export const DISCOVER_TABS: DiscoverTab[] = ['people', 'channels', 'spaces', 'groups'];
export const MANAGE_TABS: ManageTab[] = ['people', 'spaces', 'channels', 'groups'];

export const APP_ROUTES = {
  root: '/',
  auth: '/auth',
  legacyLogin: '/login',
  chat: '/chat',
  dm: (conversationId: string) => `/dms/${conversationId}`,
  dmThread: (conversationId: string, rootMessageId: string) =>
    `/dms/${conversationId}/thread/${rootMessageId}`,
  group: (conversationId: string) => `/groups/${conversationId}/chat`,
  groupThread: (conversationId: string, rootMessageId: string) =>
    `/groups/${conversationId}/chat/thread/${rootMessageId}`,
  /** Legacy-compatible helper; prefer `dm`, `group`, or `spaceGroupChat` when the type is known. */
  chatConversation: (conversationId: string) => `/chat/${conversationId}`,
  /** Legacy-compatible helper; prefer `dmThread`, `groupThread`, or `spaceGroupThread` when the type is known. */
  chatConversationThread: (conversationId: string, rootMessageId: string) =>
    `/chat/${conversationId}/thread/${rootMessageId}`,
  /** A channel opened in the chat lens: timeline + composer, inbox still visible. */
  chatChannel: (channelId: string) => `/chat/channels/${channelId}`,
  chatChannelThread: (channelId: string, rootMessageId: string) =>
    `/chat/channels/${channelId}/thread/${rootMessageId}`,
  /**
   * The feed lens for a channel that belongs to no space. Its space-scoped
   * sibling is `spaceChannel(spaceId, channelId, 'feed')`; both keep the inbox
   * visible, so switching lens never drops the reader out of their list.
   */
  chatChannelFeed: (channelId: string) => `/chat/channels/${channelId}/feed`,
  calls: '/calls',
  feed: '/feed',
  feedTab: (tab: FeedTab = 'home') => (tab === 'home' ? '/feed' : `/feed/${tab}`),
  discover: '/discover',
  discoverTab: (tab: DiscoverTab = 'people') => `/discover/${tab}`,
  people: '/people',
  peopleTab: (tab: PeopleTab = 'contacts') => `/people/${tab}`,
  activity: '/activity',
  activityTab: (tab: ActivityTab = 'all') => (tab === 'all' ? '/activity' : `/activity/${tab}`),
  manage: '/manage',
  manageTab: (tab: ManageTab = 'people') => (tab === 'people' ? '/manage' : `/manage/${tab}`),
  pings: '/notifications',
  pingsTab: (tab: NotificationTab = 'all') =>
    tab === 'all' || tab === 'notifications' ? '/notifications' : `/notifications/${tab}`,
  notifications: '/notifications',
  notificationsTab: (tab: NotificationTab = 'all') =>
    tab === 'all' || tab === 'notifications' ? '/notifications' : `/notifications/${tab}`,
  contacts: '/contacts',
  feeds: '/feeds',
  channel: (channelId: string) => `/channels/${channelId}`,
  channelPost: (channelId: string, postId: string) => `/channels/${channelId}/posts/${postId}`,
  spaceChannel: (spaceId: string, channelId: string, tab: ChannelTab = 'feed') =>
    `/spaces/${spaceId}/channels/${channelId}/${tab}`,
  spaceChannelThread: (spaceId: string, channelId: string, rootMessageId: string) =>
    `/spaces/${spaceId}/channels/${channelId}/chat/thread/${rootMessageId}`,
  spaceGroupChat: (spaceId: string, conversationId: string) =>
    `/spaces/${spaceId}/groups/${conversationId}/chat`,
  spaceGroupThread: (spaceId: string, conversationId: string, rootMessageId: string) =>
    `/spaces/${spaceId}/groups/${conversationId}/chat/thread/${rootMessageId}`,
  /** Management subtree entry points. Deep-linkable, own chrome — never a tab peer of the resource. */
  channelManage: (channelId: string, section = 'general') => `/channels/${channelId}/manage/${section}`,
  chatManage: (conversationId: string, section = 'general') => `/chat/${conversationId}/manage/${section}`,
  spaceManage: (spaceId: string, section = 'general') => `/spaces/${spaceId}/manage/${section}`,
  spaceChannelManage: (spaceId: string, channelId: string, section = 'general') =>
    `/spaces/${spaceId}/channels/${channelId}/manage/${section}`,
  spaceGroupManage: (spaceId: string, conversationId: string, section = 'general') =>
    `/spaces/${spaceId}/groups/${conversationId}/manage/${section}`,
  settings: '/settings',
  settingsTab: (tab: SettingsTab = 'appearance') => `/settings/${tab}`,
  spaces: '/spaces',
  spaceDetail: (spaceId: string) => `/spaces/${spaceId}`,
  spaceDetailTab: (spaceId: string, tab: SpacesTab = 'channels') => `/spaces/${spaceId}/${tab}`,
  me: '/me',
  profile: (userId: string) => `/profile/${userId}`,
  invite: (token: string) => `/invite/${token}`,
} as const;

const LAST_APP_PATH_STORAGE_KEY = 'voca:last-app-path';

const isProtectedAppPath = (path: string) =>
  path.startsWith(APP_ROUTES.chat) ||
  path.startsWith('/dms/') ||
  path.startsWith('/groups/') ||
  path.startsWith(APP_ROUTES.calls) ||
  path.startsWith(APP_ROUTES.contacts) ||
  path.startsWith(APP_ROUTES.people) ||
  path.startsWith(APP_ROUTES.feed) ||
  path.startsWith(APP_ROUTES.discover) ||
  path.startsWith('/channels/') ||
  path.startsWith(APP_ROUTES.settings) ||
  path.startsWith(APP_ROUTES.pings) ||
  path.startsWith(APP_ROUTES.notifications) ||
  path.startsWith(APP_ROUTES.activity) ||
  path.startsWith(APP_ROUTES.manage) ||
  path.startsWith(APP_ROUTES.spaces) ||
  path === APP_ROUTES.me ||
  path.startsWith('/profile/');

export const isPingsTab = (value?: string): value is PingsTab =>
  !!value && PINGS_TABS.includes(value as PingsTab);

export const isSettingsTab = (value?: string): value is SettingsTab =>
  !!value && SETTINGS_TABS.includes(value as SettingsTab);

export const isSpacesTab = (value?: string): value is SpacesTab =>
  !!value && SPACES_TABS.includes(value as SpacesTab);

export const isChannelTab = (value?: string): value is ChannelTab =>
  !!value && CHANNEL_TABS.includes(value as ChannelTab);

/**
 * How a channel is being read. The route is the only source of this — there is
 * deliberately no stored preference competing with the URL, so a channel view
 * can be linked and shared in a specific lens.
 */
export type ChannelLens = 'chat' | 'feed';

export const DEFAULT_CHANNEL_LENS: ChannelLens = 'chat';

/** Where a channel opens in a given lens, space-scoped or not. */
export const channelLensRoute = (
  spaceId: string | null | undefined,
  channelId: string,
  lens: ChannelLens
): string => {
  if (spaceId) return APP_ROUTES.spaceChannel(spaceId, channelId, lens);
  return lens === 'feed'
    ? APP_ROUTES.chatChannelFeed(channelId)
    : APP_ROUTES.chatChannel(channelId);
};

/** The lens a `/chat/*` or `/spaces/*` channel pathname names. */
export const channelLensFromPath = (pathname: string): ChannelLens =>
  /\/feed(\/|$)/.test(pathname) ? 'feed' : DEFAULT_CHANNEL_LENS;

export const isPeopleTab = (value?: string): value is PeopleTab =>
  !!value && PEOPLE_TABS.includes(value as PeopleTab);

export const isActivityTab = (value?: string): value is ActivityTab =>
  !!value && ACTIVITY_TABS.includes(value as ActivityTab);

export const isManageTab = (value?: string): value is ManageTab =>
  !!value && MANAGE_TABS.includes(value as ManageTab);

export const isFeedTab = (value?: string): value is FeedTab =>
  !!value && FEED_TABS.includes(value as FeedTab);

export const isDiscoverTab = (value?: string): value is DiscoverTab =>
  !!value && DISCOVER_TABS.includes(value as DiscoverTab);

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

// Fresh sessions land on the user's own profile page; the last-visited app path
// (if any) still takes precedence so returning users resume where they left off.
export const getDefaultAuthedPath = () => getLastAppPath() || APP_ROUTES.me;

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
