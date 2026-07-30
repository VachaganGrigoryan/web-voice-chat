import type { MessageContainerRef } from './types';

/**
 * The single source of truth for React Query cache keys.
 *
 * Every builder reproduces the key shape already in use at its call sites, so
 * adopting the factory is a rename rather than a cache reset. Roots are exposed
 * separately (`channelKeys.all`, `spaceKeys.all`, ...) because invalidation is
 * written against the root far more often than against a leaf.
 */

export type ResourceScope = 'space' | 'channel' | 'conversation';

// --- messages, keyed by container ------------------------------------------

export const messageQueryKey = (container: MessageContainerRef) =>
  ['messages', container.container_type, container.container_id] as const;

export const threadMessageQueryKey = (
  container: MessageContainerRef,
  threadRootId: string
) =>
  [
    'threadMessages',
    container.container_type,
    container.container_id,
    threadRootId,
  ] as const;

export const containerKeys = {
  messagesRoot: ['messages'] as const,
  threadsRoot: ['threadMessages'] as const,
  messages: messageQueryKey,
  thread: threadMessageQueryKey,
  /** Every cache group one container owns — the unit of container-level invalidation. */
  allFor: (container: MessageContainerRef) =>
    [
      messageQueryKey(container),
      ['threadMessages', container.container_type, container.container_id],
    ] as const,
} as const;

// --- viewer capabilities ----------------------------------------------------

/**
 * Per-resource rather than per-batch: a feed card and a chat header asking about
 * the same channel must share one entry even though the requests that filled it
 * were batched together.
 */
export const capabilityKeys = {
  all: ['capabilities'] as const,
  resource: (scope: ResourceScope, id: string) =>
    ['capabilities', scope, id] as const,
} as const;

// --- directory --------------------------------------------------------------

export type DirectoryEntity = 'people' | 'channels' | 'spaces' | 'groups';

export const directoryKeys = {
  all: ['directory'] as const,
  list: (entity: DirectoryEntity, params: Readonly<Record<string, unknown>>) =>
    ['directory', entity, params] as const,
  omni: (query: string) => ['directory', 'omni', query] as const,
} as const;

// --- feeds ------------------------------------------------------------------

export const feedKeys = {
  all: ['feeds'] as const,
  home: ['feeds'] as const,
  channelRoot: ['channel-feed'] as const,
  channel: (channelId: string) => ['channel-feed', channelId] as const,
  postComments: (channelId: string, postId: string) =>
    ['post-comments', channelId, postId] as const,
  saved: ['saved-messages'] as const,
} as const;

// --- inbox ------------------------------------------------------------------

export const inboxKeys = {
  conversations: ['conversations'] as const,
  conversationsArchived: (spaceId: string | null) =>
    ['conversations', 'archived', spaceId] as const,
  folders: ['conversations', 'folders'] as const,
  conversation: (conversationId: string) =>
    ['conversations', conversationId] as const,
  channelsMine: ['channels', 'me'] as const,
  calls: ['calls'] as const,
} as const;

// --- resources --------------------------------------------------------------

export const channelKeys = {
  all: ['channels'] as const,
  detail: (channelId: string) => ['channels', channelId] as const,
  members: (channelId: string) => ['channels', channelId, 'members'] as const,
  ofUserRoot: ['user-channels'] as const,
  ofUser: (userId: string) => ['user-channels', userId] as const,
} as const;

export const spaceKeys = {
  all: ['spaces'] as const,
  detail: (spaceId: string) => ['spaces', spaceId] as const,
  channels: (spaceId: string) => ['spaces', spaceId, 'channels'] as const,
  groups: (spaceId: string) => ['spaces', spaceId, 'groups'] as const,
  members: (spaceId: string) => ['spaces', spaceId, 'members'] as const,
} as const;

/** Roles, members, invites and join-requests share one shape across all three scopes. */
export const roleKeys = {
  all: ['roles'] as const,
  forResource: (scope: ResourceScope, id: string) =>
    ['roles', scope, id] as const,
} as const;

export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
} as const;
