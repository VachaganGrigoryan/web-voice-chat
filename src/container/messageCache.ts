import type { QueryClient } from '@tanstack/react-query';
import { resolveMessageContent } from '@/api/messageContent';
import { messageQueryKey, threadMessageQueryKey } from '@/api/queryKeys';
import type {
  MessageContainerRef,
  MessageDoc,
  MessageReactionGroup,
  MessageReactionsUpdate,
} from '@/api/types';

/**
 * Pure cache writers. `queryClient` is a parameter, not a hook result, so every
 * function here is callable from a test without React.
 *
 * This module is also the only place that reads `MessageDoc.conversation_id` —
 * the deprecated mirror of `container_id`. Confining it here means its removal
 * is a one-file diff rather than a hunt.
 */

/** The shape React Query keeps for an infinite message list. */
interface MessagePage {
  data?: MessageDoc[];
  meta?: { next_cursor: string | null; limit: number | null; total: number | null };
  success?: boolean;
}

interface InfiniteMessages {
  pages?: MessagePage[];
  pageParams?: unknown[];
}

const emptyInfiniteMessages = (): InfiniteMessages => ({
  pages: [{ data: [], meta: { next_cursor: null, limit: 20, total: 0 }, success: true }],
  pageParams: [undefined],
});

const singleMessagePage = (message: MessageDoc): InfiniteMessages => ({
  pages: [{ data: [message], meta: { next_cursor: null, limit: 20, total: 1 }, success: true }],
  pageParams: [undefined],
});

/** `container_id`, falling back to the legacy mirror while it still ships. */
export const containerIdOf = (message: {
  container_id?: string | null;
  conversation_id?: string | null;
}): string | null => message.container_id ?? message.conversation_id ?? null;

const prependToFirstPage = (
  old: InfiniteMessages | undefined,
  message: MessageDoc
): InfiniteMessages => {
  if (!old) return singleMessagePage(message);

  const firstPage = old.pages?.[0];
  // Defensive: a malformed page must not throw inside a cache writer, which
  // would take the whole timeline down.
  const existing = Array.isArray(firstPage?.data) ? firstPage.data : [];
  if (existing.some((current) => current.id === message.id)) return old;

  const pages = [...(old.pages ?? [])];
  pages[0] = { ...firstPage, data: [message, ...existing] };
  return { ...old, pages };
};

export const prependMessage = (
  queryClient: QueryClient,
  container: MessageContainerRef,
  message: MessageDoc
): void => {
  queryClient.setQueryData<InfiniteMessages>(messageQueryKey(container), (old) =>
    prependToFirstPage(old, message)
  );
};

export const prependThreadMessage = (
  queryClient: QueryClient,
  container: MessageContainerRef,
  threadRootId: string,
  message: MessageDoc
): void => {
  queryClient.setQueryData<InfiniteMessages>(
    threadMessageQueryKey(container, threadRootId),
    (old) => prependToFirstPage(old, message)
  );
};

/**
 * Apply an update to a message wherever it appears in one cache group. Returns
 * the cache untouched when the id is absent, so an unrelated event does not
 * churn every subscriber.
 */
export const updateMessageAcrossGroup = (
  queryClient: QueryClient,
  groupKey: 'messages' | 'threadMessages',
  messageId: string,
  update: (message: MessageDoc) => MessageDoc
): void => {
  queryClient.setQueriesData<InfiniteMessages>({ queryKey: [groupKey] }, (old) => {
    if (!old?.pages) return old;

    let changed = false;
    const pages = old.pages.map((page) => ({
      ...page,
      data: (page.data ?? []).map((message) => {
        if (message.id !== messageId) return message;
        changed = true;
        return update(message);
      }),
    }));

    return changed ? { ...old, pages } : old;
  });
};

/** Both cache groups at once — a message can be visible in a timeline and a thread. */
export const updateMessageEverywhere = (
  queryClient: QueryClient,
  messageId: string,
  update: (message: MessageDoc) => MessageDoc
): void => {
  updateMessageAcrossGroup(queryClient, 'messages', messageId, update);
  updateMessageAcrossGroup(queryClient, 'threadMessages', messageId, update);
};

export const applyReactionUpdate = (
  queryClient: QueryClient,
  payload: MessageReactionsUpdate
): void => {
  updateMessageEverywhere(queryClient, payload.message_id, (message) => ({
    ...message,
    reactions: payload.reactions,
    updated_at: payload.updated_at,
  }));
};

/**
 * The optimistic local toggle. Caps at ten distinct emoji to match the server,
 * and drops a group once its last user leaves.
 */
export const toggleLocalReactionGroups = (
  reactions: MessageReactionGroup[],
  emoji: string,
  currentUserId: string,
  updatedAt: string
): MessageReactionGroup[] => {
  const existing = reactions.find((reaction) => reaction.emoji === emoji);
  const next = [...reactions];

  if (!existing) {
    if (next.length >= 10) return next;
    return [...next, { emoji, user_ids: [currentUserId], count: 1, updated_at: updatedAt }];
  }

  const hasOwn = existing.user_ids.includes(currentUserId);
  const userIds = hasOwn
    ? existing.user_ids.filter((userId) => userId !== currentUserId)
    : [...existing.user_ids, currentUserId];

  return next
    .map((reaction) =>
      reaction.emoji !== emoji
        ? reaction
        : { ...reaction, user_ids: userIds, count: userIds.length, updated_at: updatedAt }
    )
    .filter((reaction) => reaction.count > 0);
};

export const updateThreadRootSummary = (
  queryClient: QueryClient,
  threadRootId: string,
  replyCreatedAt: string
): void => {
  updateMessageAcrossGroup(queryClient, 'messages', threadRootId, (message) => ({
    ...message,
    is_thread_root: true,
    thread_reply_count: (message.thread_reply_count ?? 0) + 1,
    last_thread_reply_at: replyCreatedAt,
    updated_at: replyCreatedAt,
  }));
};

// --- conversation inbox projections ----------------------------------------

interface ConversationRow {
  id?: string;
  conversation_id?: string;
  last_message?: { id?: string } | null;
  last_message_at?: string | null;
  unread_count?: number;
}

interface InfiniteConversations {
  pages?: Array<{ data?: ConversationRow[] }>;
  pageParams?: unknown[];
}

const mapConversations = (
  queryClient: QueryClient,
  map: (row: ConversationRow) => ConversationRow | null
): void => {
  queryClient.setQueryData<InfiniteConversations>(['conversations'], (old) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        data: (page.data ?? [])
          .map((row) => map(row))
          .filter((row): row is ConversationRow => row !== null),
      })),
    };
  });
};

export const updateConversationPreview = (
  queryClient: QueryClient,
  message: MessageDoc
): void => {
  mapConversations(queryClient, (row) => {
    if (row.last_message?.id !== message.id) return row;
    const resolved = resolveMessageContent(message);
    return {
      ...row,
      last_message: {
        ...row.last_message,
        type: message.type,
        text: message.is_deleted ? 'Message deleted' : resolved.text,
        media: message.is_deleted ? null : resolved.media,
        call: message.is_deleted ? null : resolved.call,
        created_at: message.created_at,
      },
      last_message_at: message.updated_at || row.last_message_at,
    } as ConversationRow;
  });
};

export const updateConversationActivity = (
  queryClient: QueryClient,
  conversationId: string,
  updatedAt: string,
  unreadIncrement = 0
): void => {
  mapConversations(queryClient, (row) =>
    row.conversation_id === conversationId
      ? {
          ...row,
          last_message_at: updatedAt,
          unread_count: (row.unread_count ?? 0) + unreadIncrement,
        }
      : row
  );
};

export const clearConversationRow = (
  queryClient: QueryClient,
  conversationId: string,
  resolvedConversationId: string
): void => {
  mapConversations(queryClient, (row) =>
    row.conversation_id === resolvedConversationId || row.id === conversationId
      ? { ...row, last_message: null, last_message_at: null, unread_count: 0 }
      : row
  );
};

/**
 * Both container types support marking their own read state and clearing
 * their own unread badge — it is deliberately not part of the conversation-only
 * affordance group. A channel's row lives in a different cache (`['channels',
 * 'me']`) than a conversation's, so this is the one place that branches on
 * container type to reach the right one.
 */
export const resetContainerUnreadCount = (
  queryClient: QueryClient,
  container: MessageContainerRef
): void => {
  if (container.container_type === 'channel') {
    queryClient.setQueryData<Array<{ channel: { id: string }; unread_count: number }>>(
      ['channels', 'me'],
      (old) =>
        old?.map((row) =>
          row.channel.id === container.container_id ? { ...row, unread_count: 0 } : row
        )
    );
    return;
  }

  mapConversations(queryClient, (row) =>
    row.conversation_id === container.container_id || row.id === container.container_id
      ? { ...row, unread_count: 0 }
      : row
  );
};

export const removeConversationRow = (
  queryClient: QueryClient,
  conversationId: string,
  resolvedConversationId: string
): void => {
  mapConversations(queryClient, (row) =>
    row.conversation_id === resolvedConversationId || row.id === conversationId
      ? null
      : row
  );
};

/**
 * Empty a conversation's timeline and any thread caches belonging to it.
 * Thread caches are keyed by root message, not by conversation, so they are
 * matched by inspecting their contents.
 */
export const clearConversationMessages = (
  queryClient: QueryClient,
  cacheConversationId: string,
  conversationId: string
): void => {
  queryClient.setQueryData<InfiniteMessages>(
    messageQueryKey({ container_type: 'conversation', container_id: cacheConversationId }),
    () => emptyInfiniteMessages()
  );

  queryClient.setQueriesData<InfiniteMessages>({ queryKey: ['threadMessages'] }, (old) => {
    if (!old?.pages) return old;
    const belongs = old.pages.some((page) =>
      (page.data ?? []).some((message) => containerIdOf(message) === conversationId)
    );
    return belongs ? emptyInfiniteMessages() : old;
  });
};

/**
 * Route a just-created message into the caches it belongs in.
 *
 * The branch is on message *topology* — root, inline reply, thread reply — and
 * on whether the container keeps an inbox row.
 */
export const integrateCreatedMessage = (
  queryClient: QueryClient,
  container: MessageContainerRef,
  message: MessageDoc
): void => {
  if (container.container_type === 'channel') {
    if (message.reply_mode === 'thread' && message.thread_root_id) {
      prependThreadMessage(queryClient, container, message.thread_root_id, message);
      updateThreadRootSummary(queryClient, message.thread_root_id, message.created_at);
      return;
    }

    prependMessage(queryClient, container, message);
    // A new post changes the channel's feed projection too.
    queryClient.invalidateQueries({ queryKey: ['channel-feed', container.container_id] });
    return;
  }

  const messageContainerId = containerIdOf(message);

  if (message.reply_mode === 'thread' && message.thread_root_id) {
    prependThreadMessage(queryClient, container, message.thread_root_id, message);
    updateThreadRootSummary(queryClient, message.thread_root_id, message.created_at);
    if (messageContainerId) {
      updateConversationActivity(queryClient, messageContainerId, message.created_at);
    }
    return;
  }

  prependMessage(queryClient, container, message);
};
