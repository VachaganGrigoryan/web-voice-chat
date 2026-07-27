import { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { EVENTS } from './events';
import { getCallDirectionFromMeta, getCallSummaryText } from '@/features/chat/utils/callPresentation';
import { getMessageTypeLabel, getPresentedMessageKind } from '@/features/chat/utils/messagePresentation';
import { pollQueryKey } from '@/hooks/usePoll';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  MessageDeletedEvent,
  MessageContainerRef,
  MessageDoc,
  MessageReactionsUpdate,
  PollView,
  PresenceState,
  PresenceStatus,
  ThreadSummary,
} from '@/api/types';
import { resolveMessageContent } from '@/api/messageContent';
import { socketClient } from './socketClient';
import { useAuthStore } from '@/store/authStore';
import { messageQueryKey, threadMessageQueryKey } from '@/api/queryKeys';

export type MessageStatusScope = 'main' | 'thread';

interface MessageStatusPayloadBase extends MessageContainerRef {
  status?: 'sent' | 'delivered' | 'read';
  receipt_summary?: MessageDoc['receipt_summary'];
  conversation_id?: string;
  peer_user_id?: string;
  scope?: MessageStatusScope;
  thread_root_id?: string | null;
  /** Fallback timestamp used when status-specific timestamps are absent. */
  updated_at?: string;
  user_id?: string;
}

export type MessageStatusPayload =
  | (MessageStatusPayloadBase & { message_id: string; message_ids?: never })
  | (MessageStatusPayloadBase & { message_ids: string[]; message_id?: never });

interface PollUpdatedPayload {
  conversation_id: string;
  poll_id: string;
  message_id: string | null;
  closed: boolean;
  total_votes: number | null;
  updated_at: string;
}

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: string[];
  presenceByUserId: Record<string, PresenceStatus>;
  typingUsers: Record<string, boolean>; // userId -> isTyping
  setSocket: (socket: Socket | null) => void;
  setIsConnected: (isConnected: boolean) => void;
  setOnlineUsers: (users: string[]) => void;
  setPresence: (userId: string, presence: PresenceStatus) => void;
  setTypingUser: (userId: string, isTyping: boolean) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  isConnected: false,
  onlineUsers: [],
  presenceByUserId: {},
  typingUsers: {},
  setSocket: (socket) => set({ socket }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setOnlineUsers: (onlineUsers) =>
    set((state) => {
      const presenceByUserId = { ...state.presenceByUserId };
      for (const userId of onlineUsers) {
        const existingState = presenceByUserId[userId]?.state;
        presenceByUserId[userId] = {
          user_id: userId,
          state: existingState && existingState !== 'offline' ? existingState : 'online',
          is_online: true,
          last_seen_at: null,
        };
      }
      return { onlineUsers, presenceByUserId };
    }),
  setPresence: (userId, presence) =>
    set((state) => ({
      presenceByUserId: { ...state.presenceByUserId, [userId]: presence },
    })),
  setTypingUser: (userId, isTyping) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [userId]: isTyping },
    })),
}));

const buildLastMessagePreview = (message: MessageDoc) => {
  const resolved = resolveMessageContent(message);
  return {
    id: message.id,
    type: message.type,
    text: message.is_deleted ? 'Message deleted' : resolved.text,
    media: message.is_deleted ? null : resolved.media,
    call: message.is_deleted ? null : resolved.call,
    created_at: message.created_at,
  };
};

// Sync socket events to store
const setupSocketSync = () => {
  // Track which socket instance has had its persistent listeners attached.
  // If the same socket object reconnects, we skip re-registration to avoid
  // stacking duplicate listeners. A new socket object (after reconnect()) gets
  // its own listeners registered fresh.
  let attachedToSocket: Socket | null = null;

  socketClient.onConnect((socket) => {
    const { setIsConnected, setOnlineUsers, setTypingUser, setSocket, setPresence } = useSocketStore.getState();

    // Always update connection state — runs on every (re)connect.
    setSocket(socket);
    setIsConnected(true);

    // Only register persistent event listeners once per socket instance.
    if (attachedToSocket === socket) return;
    attachedToSocket = socket;

    socket.on(EVENTS.DISCONNECT, () => {
      setIsConnected(false);
    });

    // Use a Set for O(1) deduplication — idempotent if both PRESENCE_UPDATE
    // and USER_ONLINE/USER_OFFLINE fire for the same event.
    const updatePresence = (userId: string, state: PresenceState, lastSeenAt: string | null = null) => {
      const currentSet = new Set(useSocketStore.getState().onlineUsers);
      if (state !== 'offline') currentSet.add(userId);
      else currentSet.delete(userId);
      setPresence(userId, {
        user_id: userId,
        state,
        is_online: state !== 'offline',
        last_seen_at: lastSeenAt,
      });
      setOnlineUsers([...currentSet]);
    };

    socket.on(EVENTS.PRESENCE_UPDATE, (payload: any) => {
      if (payload.user_id) {
        const state = payload.state || payload.status || (payload.online ? 'online' : 'offline');
        updatePresence(payload.user_id, state, payload.last_seen_at || null);
      }
    });

    socket.on(EVENTS.USER_ONLINE, ({ user_id }: { user_id: string }) => {
      updatePresence(user_id, 'online');
    });

    socket.on(EVENTS.USER_OFFLINE, ({ user_id }: { user_id: string }) => {
      updatePresence(user_id, 'offline');
    });

    socket.on(EVENTS.SERVER_TYPING_START, (payload: any) => {
      const typingKey = payload.conversation_id || payload.from || payload.sender_id;
      if (typingKey) setTypingUser(typingKey, true);
    });

    socket.on(EVENTS.SERVER_TYPING_STOP, (payload: any) => {
      const typingKey = payload.conversation_id || payload.from || payload.sender_id;
      if (typingKey) setTypingUser(typingKey, false);
    });
  });
};

// Initialize sync
setupSocketSync();

// Export getSocket for legacy compatibility if needed
export const getSocket = () => socketClient.getSocket();

const buildInitialMessagePages = (message: MessageDoc) => ({
  pages: [{ data: [message], meta: { next_cursor: null, limit: 20, total: 1 }, success: true }],
  pageParams: [undefined],
});

const prependMessageToMessageCache = (old: any, message: MessageDoc) => {
  if (!old) {
    return buildInitialMessagePages(message);
  }

  const firstPage = old.pages?.[0];
  const existingMessages = firstPage?.data || [];

  if (existingMessages.some((current: MessageDoc) => current.id === message.id)) {
    return old;
  }

  const newPages = [...old.pages];
  newPages[0] = {
    ...firstPage,
    data: [message, ...existingMessages],
  };

  return {
    ...old,
    pages: newPages,
  };
};

const updateMessageAcrossCacheGroup = (
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string,
  matcher: (message: MessageDoc) => boolean,
  updater: (message: MessageDoc) => MessageDoc
) => {
  queryClient.setQueriesData({ queryKey: [queryKey] }, (old: any) => {
    if (!old?.pages) return old;

    let changed = false;
    const pages = old.pages.map((page: any) => {
      const data = (page.data || []).map((message: MessageDoc) => {
        if (!matcher(message)) {
          return message;
        }

        changed = true;
        return updater(message);
      });

      return { ...page, data };
    });

    return changed ? { ...old, pages } : old;
  });
};

const removeMessageAcrossCacheGroup = (
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string,
  matcher: (message: MessageDoc) => boolean
) => {
  queryClient.setQueriesData({ queryKey: [queryKey] }, (old: any) => {
    if (!old?.pages) return old;

    let changed = false;
    const pages = old.pages.map((page: any) => {
      const existingData = page.data || [];
      const data = existingData.filter((message: MessageDoc) => {
        const shouldRemove = matcher(message);
        if (shouldRemove) {
          changed = true;
        }
        return !shouldRemove;
      });

      return changed ? { ...page, data } : page;
    });

    return changed ? { ...old, pages } : old;
  });
};

const findCachedMessage = (
  queryClient: ReturnType<typeof useQueryClient>,
  messageId: string,
  container?: Partial<MessageContainerRef>
) => {
  const queryGroups = [
    ...queryClient.getQueriesData<any>({ queryKey: ['messages'] }),
    ...queryClient.getQueriesData<any>({ queryKey: ['threadMessages'] }),
  ];

  for (const [, data] of queryGroups) {
    const matchedMessage = data?.pages
      ?.flatMap((page: any) => page.data || [])
      ?.find((message: MessageDoc) => {
        if (message.id !== messageId) {
          return false;
        }

        return container?.container_type && container.container_id
          ? message.container_type === container.container_type &&
              message.container_id === container.container_id
          : true;
      });

    if (matchedMessage) {
      return matchedMessage as MessageDoc;
    }
  }

  return null;
};

const updateConversationLastMessage = (
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  message: MessageDoc,
  currentUserId?: string | null,
  selectedUser?: string | null
) => {
  queryClient.setQueryData(['conversations'], (old: any) => {
    if (!old?.pages) return old;

    const newPages = [...old.pages];
    const allConversations = newPages.flatMap((page) => page.data);
    const existingConvIndex = allConversations.findIndex(
      (conversation) => conversation.conversation_id === conversationId
    );

    if (existingConvIndex === -1) {
      return old;
    }

    const conversation = allConversations[existingConvIndex];
    const updatedConversation = {
      ...conversation,
      last_message: buildLastMessagePreview(message),
      last_message_at: message.created_at,
      unread_count:
        message.sender_id !== currentUserId && selectedUser !== conversationId
          ? (conversation.unread_count ?? 0) + 1
          : conversation.unread_count ?? 0,
    };

    allConversations.splice(existingConvIndex, 1);
    allConversations.unshift(updatedConversation);

    let currentIndex = 0;
    for (let i = 0; i < newPages.length; i += 1) {
      const pageLength = newPages[i].data.length;
      newPages[i] = {
        ...newPages[i],
        data: allConversations.slice(currentIndex, currentIndex + pageLength),
      };
      currentIndex += pageLength;
    }

    return {
      ...old,
      pages: newPages,
    };
  });
};

const updateConversationActivity = (
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  updatedAt: string,
  unreadIncrement: number = 0
) => {
  queryClient.setQueryData(['conversations'], (old: any) => {
    if (!old?.pages) return old;

    const newPages = [...old.pages];
    const allConversations = newPages.flatMap((page) => page.data);
    const existingConvIndex = allConversations.findIndex((conversation) => conversation.conversation_id === conversationId);

    if (existingConvIndex === -1) {
      return old;
    }

    const conversation = allConversations[existingConvIndex];
    const updatedConversation = {
      ...conversation,
      last_message_at: updatedAt,
      unread_count: (conversation.unread_count ?? 0) + unreadIncrement,
    };

    allConversations.splice(existingConvIndex, 1);
    allConversations.unshift(updatedConversation);

    let currentIndex = 0;
    for (let i = 0; i < newPages.length; i += 1) {
      const pageLength = newPages[i].data.length;
      newPages[i] = {
        ...newPages[i],
        data: allConversations.slice(currentIndex, currentIndex + pageLength),
      };
      currentIndex += pageLength;
    }

    return {
      ...old,
      pages: newPages,
    };
  });
};

const updateConversationPreview = (
  queryClient: ReturnType<typeof useQueryClient>,
  message: MessageDoc
) => {
  if (message.container_type !== 'conversation') return;

  queryClient.setQueryData(['conversations'], (old: any) => {
    if (!old?.pages) return old;

    return {
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        data: page.data.map((conversation: any) => {
          if (conversation.last_message?.id !== message.id) {
            return conversation;
          }

          return {
            ...conversation,
            last_message: buildLastMessagePreview(message),
            last_message_at: message.updated_at || conversation.last_message_at,
          };
        }),
      })),
    };
  });
};

const rebuildConversationPreview = (
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string
) => {
  queryClient.setQueryData(['conversations'], (old: any) => {
    if (!old?.pages) return old;

    let changed = false;
    const pages = old.pages.map((page: any) => ({
      ...page,
      data: (page.data || []).map((conversation: any) => {
        if (conversation.conversation_id !== conversationId) {
          return conversation;
        }

        changed = true;
        const messageHistory = queryClient.getQueryData<any>(
          messageQueryKey({
            container_type: 'conversation',
            container_id: conversationId,
          })
        );
        const latestVisibleMessage =
          messageHistory?.pages
            ?.flatMap((historyPage: any) => historyPage.data || [])
            ?.find((message: MessageDoc) => message.conversation_id === conversationId) || null;

        return {
          ...conversation,
          last_message: latestVisibleMessage ? buildLastMessagePreview(latestVisibleMessage) : null,
          last_message_at: latestVisibleMessage
            ? latestVisibleMessage.updated_at || latestVisibleMessage.created_at
            : null,
        };
      }),
    }));

    return changed ? { ...old, pages } : old;
  });
};

const updateConversationPinnedMessages = (
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  pinnedMessageIds: string[]
) => {
  queryClient.setQueryData(['conversations'], (old: any) => {
    if (!old?.pages) return old;

    let changed = false;
    const pages = old.pages.map((page: any) => ({
      ...page,
      data: (page.data || []).map((conversation: any) => {
        if (
          conversation.conversation_id !== conversationId &&
          conversation.id !== conversationId
        ) {
          return conversation;
        }

        changed = true;
        return {
          ...conversation,
          pinned_message_ids: pinnedMessageIds,
        };
      }),
    }));

    return changed ? { ...old, pages } : old;
  });

  queryClient.setQueryData(['conversation', conversationId], (old: any) => {
    if (!old) return old;

    return {
      ...old,
      pinned_message_ids: pinnedMessageIds,
    };
  });
};

const updateThreadSummaryCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  summary: ThreadSummary
) => {
  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (message) =>
      message.id === summary.thread_root_id &&
      message.container_type === summary.container_type &&
      message.container_id === summary.container_id,
    (message) => ({
      ...message,
      thread_reply_count: summary.thread_reply_count,
      last_thread_reply_at: summary.last_thread_reply_at,
      updated_at: summary.last_thread_reply_at || message.updated_at,
    })
  );

  queryClient.setQueryData(
    [
      'threadSummary',
      summary.container_type,
      summary.container_id,
      summary.thread_root_id,
    ],
    {
      success: true,
      data: summary,
    }
  );
};

const incrementThreadSummaryCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  container: MessageContainerRef,
  threadRootId: string,
  replyCreatedAt: string
) => {
  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (message) =>
      message.id === threadRootId &&
      message.container_type === container.container_type &&
      message.container_id === container.container_id,
    (message) => ({
      ...message,
      is_thread_root: true,
      thread_reply_count: (message.thread_reply_count ?? 0) + 1,
      thread_unread_count: message.thread_unread_count ?? 0,
      last_thread_reply_at: replyCreatedAt,
      updated_at: replyCreatedAt,
    })
  );
};

const updateThreadUnreadCount = (
  queryClient: ReturnType<typeof useQueryClient>,
  threadRootId: string,
  updater: (current: number) => number,
  container?: MessageContainerRef
) => {
  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (message) =>
      message.id === threadRootId &&
      (!container ||
        (message.container_type === container.container_type &&
          message.container_id === container.container_id)),
    (message) => ({
      ...message,
      thread_unread_count: Math.max(0, updater(message.thread_unread_count ?? 0)),
    })
  );
};

const getMessageStatusIds = (payload: MessageStatusPayload) => {
  const ids = new Set<string>();
  if (payload.message_id) {
    ids.add(payload.message_id);
  }
  for (const id of payload.message_ids || []) {
    if (id) {
      ids.add(id);
    }
  }
  return [...ids];
};

export const applyMessageStatusUpdateToCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  payload: MessageStatusPayload
) => {
  const messageIds = getMessageStatusIds(payload);
  if (!messageIds.length) {
    return false;
  }

  const messageIdSet = new Set(messageIds);
  const updatedAt = payload.updated_at || new Date().toISOString();
  const matchesContainer = (message: MessageDoc) =>
    message.container_type === payload.container_type &&
    message.container_id === payload.container_id;

  const updateStatus = (message: MessageDoc): MessageDoc => {
    const current = message.receipt_summary;
    const fallback =
      payload.status === 'read'
        ? {
            ...current,
            delivered_count: current.recipient_count,
            read_count: current.recipient_count,
          }
        : payload.status === 'delivered'
          ? {
              ...current,
              delivered_count: current.recipient_count,
            }
          : current;
    return {
      ...message,
      receipt_summary: payload.receipt_summary || fallback,
      updated_at: updatedAt,
    };
  };

  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (message) => messageIdSet.has(message.id) && matchesContainer(message),
    updateStatus
  );

  updateMessageAcrossCacheGroup(
    queryClient,
    'threadMessages',
    (message) => messageIdSet.has(message.id) && matchesContainer(message),
    updateStatus
  );

  if (payload.status === 'read' && payload.scope === 'thread' && payload.thread_root_id) {
    updateThreadUnreadCount(
      queryClient,
      payload.thread_root_id,
      () => 0,
      {
        container_type: payload.container_type,
        container_id: payload.container_id,
      }
    );
  }

  return true;
};

const updateReactionCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  payload: MessageReactionsUpdate
) => {
  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (message) =>
      message.id === payload.message_id &&
      message.container_type === payload.container_type &&
      message.container_id === payload.container_id,
    (message) => ({
      ...message,
      reactions: payload.reactions,
      updated_at: payload.updated_at,
    })
  );

  updateMessageAcrossCacheGroup(
    queryClient,
    'threadMessages',
    (message) =>
      message.id === payload.message_id &&
      message.container_type === payload.container_type &&
      message.container_id === payload.container_id,
    (message) => ({
      ...message,
      reactions: payload.reactions,
      updated_at: payload.updated_at,
    })
  );
};

const updatePollCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  payload: PollUpdatedPayload
) => {
  const queryKey = pollQueryKey(payload.poll_id);
  queryClient.setQueryData<PollView>(queryKey, (old) => {
    if (!old) return old;

    return {
      ...old,
      closed: payload.closed,
      total_votes: payload.total_votes ?? old.total_votes,
      updated_at: payload.updated_at,
    };
  });
  queryClient.invalidateQueries({ queryKey });
};

const updateMessageDocumentCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  message: MessageDoc
) => {
  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (current) =>
      current.id === message.id &&
      current.container_type === message.container_type &&
      current.container_id === message.container_id,
    () => message
  );

  updateMessageAcrossCacheGroup(
    queryClient,
    'threadMessages',
    (current) =>
      current.id === message.id &&
      current.container_type === message.container_type &&
      current.container_id === message.container_id,
    () => message
  );

  updateConversationPreview(queryClient, message);
  if (message.container_type === 'channel') {
    queryClient.invalidateQueries({ queryKey: ['feeds'] });
    queryClient.invalidateQueries({ queryKey: ['channel-feed', message.container_id] });
    queryClient.invalidateQueries({ queryKey: ['post-comments', message.container_id] });
  }
};

export const applyMessageDeletedEventToCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  payload: MessageDeletedEvent,
  currentUserId?: string | null
) => {
  const cachedMessage = findCachedMessage(queryClient, payload.message_id, {
    container_type: payload.container_type,
    container_id: payload.container_id,
  });
  const matcher = (message: MessageDoc) =>
    message.id === payload.message_id &&
    message.container_type === payload.container_type &&
    message.container_id === payload.container_id;
  const isActorCurrentUser = !!currentUserId && payload.actor_user_id === currentUserId;
  const isCurrentUsersMessage = !!currentUserId && cachedMessage?.sender_id === currentUserId;

  if (payload.hidden_for_me || isActorCurrentUser) {
    removeMessageAcrossCacheGroup(queryClient, 'messages', matcher);
    removeMessageAcrossCacheGroup(queryClient, 'threadMessages', matcher);
    if (payload.container_type === 'conversation') {
      rebuildConversationPreview(queryClient, payload.container_id);
    }
    return true;
  }

  const updatedAt = payload.updated_at || new Date().toISOString();
  const preserveContentForOwnerSoftDelete = isCurrentUsersMessage && !isActorCurrentUser;
  const shouldMarkDeleted = payload.deleted_for_everyone || preserveContentForOwnerSoftDelete;
  const applyDeleteMutation = (message: MessageDoc) => ({
    ...message,
    is_deleted: shouldMarkDeleted ? true : message.is_deleted,
    deleted_at: shouldMarkDeleted ? updatedAt : message.deleted_at,
    edited_at: shouldMarkDeleted && !preserveContentForOwnerSoftDelete ? null : message.edited_at,
    updated_at: updatedAt,
  });

  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    matcher,
    applyDeleteMutation
  );

  updateMessageAcrossCacheGroup(
    queryClient,
    'threadMessages',
    matcher,
    applyDeleteMutation
  );

  if (cachedMessage) {
    updateConversationPreview(queryClient, applyDeleteMutation(cachedMessage));
  } else {
    if (payload.container_type === 'conversation') {
      rebuildConversationPreview(queryClient, payload.container_id);
    }
  }

  if (payload.container_type === 'channel') {
    queryClient.invalidateQueries({ queryKey: ['feeds'] });
    queryClient.invalidateQueries({ queryKey: ['channel-feed', payload.container_id] });
    queryClient.invalidateQueries({ queryKey: ['post-comments', payload.container_id] });
  }

  return true;
};

const isThreadMessage = (message: MessageDoc) =>
  message.reply_mode === 'thread' && !!message.thread_root_id;

const isKnownThreadConversationId = (
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string
) => {
  const threadDetail = queryClient.getQueryData<any>(['threadConversation', conversationId]);
  if (threadDetail?.thread?.conversation_id === conversationId) {
    return true;
  }

  const openThreadQueries = queryClient.getQueriesData<any>({ queryKey: ['threadMessages'] });
  if (openThreadQueries.some(([key]) => Array.isArray(key) && key[2] === conversationId)) {
    return true;
  }

  const threadQueries = queryClient.getQueriesData<any>({ queryKey: ['threads'] });
  return threadQueries.some(([, data]) =>
    (data?.pages?.flatMap((page: any) => page.data || []) || data?.data || []).some(
      (item: any) => item?.thread?.conversation_id === conversationId
    )
  );
};

const routeIncomingThreadConversationMessage = (
  queryClient: ReturnType<typeof useQueryClient>,
  message: MessageDoc
) => {
  queryClient.setQueryData(threadMessageQueryKey(message, message.container_id), (old: any) =>
    prependMessageToMessageCache(old, message)
  );
  updateConversationActivity(queryClient, message.conversation_id, message.created_at);
  queryClient.invalidateQueries({ queryKey: ['threads'] });
};

const routeIncomingThreadMessage = (
  queryClient: ReturnType<typeof useQueryClient>,
  message: MessageDoc,
  openThreadRootId: string | null,
  currentUserId?: string | null,
  selectedUser?: string | null
) => {
  if (!message.thread_root_id) {
    return;
  }

  queryClient.setQueryData(threadMessageQueryKey(message, message.thread_root_id), (old: any) =>
    prependMessageToMessageCache(old, message)
  );

  incrementThreadSummaryCache(
    queryClient,
    message,
    message.thread_root_id,
    message.created_at
  );
  if (openThreadRootId === message.thread_root_id) {
    updateThreadUnreadCount(queryClient, message.thread_root_id, () => 0, message);
  } else if (message.sender_id !== currentUserId) {
    updateThreadUnreadCount(
      queryClient,
      message.thread_root_id,
      (current) => current + 1,
      message
    );
  }
  updateConversationActivity(
    queryClient,
    message.conversation_id,
    message.created_at,
    message.sender_id !== currentUserId && selectedUser !== message.conversation_id ? 1 : 0
  );
};

const routeIncomingMainChatMessage = (
  queryClient: ReturnType<typeof useQueryClient>,
  message: MessageDoc,
  currentUserId?: string | null,
  selectedUser?: string | null
) => {
  queryClient.setQueryData(
    messageQueryKey(message),
    (old: any) => prependMessageToMessageCache(old, message)
  );

  if (message.container_type === 'channel') {
    queryClient.invalidateQueries({ queryKey: ['feeds'] });
    queryClient.invalidateQueries({ queryKey: ['channel-feed', message.container_id] });
    queryClient.invalidateQueries({ queryKey: ['post-comments', message.container_id] });
    return;
  }

  updateConversationLastMessage(
    queryClient,
    message.container_id,
    message,
    currentUserId,
    selectedUser
  );
};

const extractThreadReplyEvent = (
  payload: MessageDoc | ({ message: MessageDoc } & ThreadSummary)
): { message: MessageDoc; summary: ThreadSummary | null } => {
  if ('message' in payload) {
    return {
      message: payload.message,
      summary: {
        thread_root_id: payload.thread_root_id,
        container_type: payload.message.container_type,
        container_id: payload.message.container_id,
        conversation_id: payload.conversation_id,
        is_thread_root: payload.is_thread_root,
        thread_reply_count: payload.thread_reply_count,
        last_thread_reply_at: payload.last_thread_reply_at,
      },
    };
  }

  return {
    message: payload,
    summary: payload.thread_root_id
      ? {
          thread_root_id: payload.thread_root_id,
          container_type: payload.container_type,
          container_id: payload.container_id,
          conversation_id: payload.conversation_id,
          is_thread_root: payload.is_thread_root,
          thread_reply_count: payload.thread_reply_count,
          last_thread_reply_at: payload.last_thread_reply_at,
        }
      : null,
  };
};

// Hooks
export const useSocket = () => {
  const { socket, isConnected } = useSocketStore();
  return { socket, isConnected };
};

export const usePresence = () => {
  const onlineUsers = useSocketStore((state) => state.onlineUsers);
  const presenceByUserId = useSocketStore((state) => state.presenceByUserId);
  const setOnlineUsers = useSocketStore((state) => state.setOnlineUsers);
  const setPresence = useSocketStore((state) => state.setPresence);
  return { onlineUsers, presenceByUserId, setOnlineUsers, setPresence };
};

export const useTypingIndicator = (userId?: string) => {
  const typingUsers = useSocketStore((state) => state.typingUsers);
  const socket = useSocketStore((state) => state.socket);
  
  const isTyping = userId ? !!typingUsers[userId] : false;
  
  const startTyping = (conversationId: string) => {
    socket?.emit(EVENTS.CLIENT_TYPING_START, { conversation_id: conversationId });
  };

  const stopTyping = (conversationId: string) => {
    socket?.emit(EVENTS.CLIENT_TYPING_STOP, { conversation_id: conversationId });
  };

  return { isTyping, typingUsers, startTyping, stopTyping };
};

import { sendNotification } from '@/utils/notificationSound';

export const useRealtimeMessages = (
  selectedUser: string | null,
  openThreadRootId: string | null = null
) => {
  const queryClient = useQueryClient();
  const { userId: currentUserId } = useAuthStore();
  const { socket } = useSocketStore();

  useEffect(() => {
    if (!openThreadRootId) return;
    updateThreadUnreadCount(
      queryClient,
      openThreadRootId,
      () => 0,
      selectedUser
        ? { container_type: 'conversation', container_id: selectedUser }
        : undefined
    );
  }, [openThreadRootId, queryClient, selectedUser]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: MessageDoc) => {
      if (message.container_type === 'channel') {
        routeIncomingMainChatMessage(queryClient, message, currentUserId, selectedUser);
        return;
      }

      if (isThreadMessage(message)) {
        // Check cache before routing — reload-safe dedup for MESSAGE_DELIVERED.
        // prependMessageToMessageCache handles duplicate cache insertions independently.
        const alreadyCached = !!findCachedMessage(queryClient, message.id, message);
        routeIncomingThreadMessage(
          queryClient,
          message,
          openThreadRootId,
          currentUserId,
          selectedUser
        );

        if (!alreadyCached && message.sender_id !== currentUserId) {
          socket.emit(EVENTS.MESSAGE_DELIVERED, {
            conversation_id: message.conversation_id,
            message_id: message.id,
          });
        }

        return;
      }

      if (isKnownThreadConversationId(queryClient, message.conversation_id)) {
        routeIncomingThreadConversationMessage(queryClient, message);

        if (message.sender_id !== currentUserId) {
          socket.emit(EVENTS.MESSAGE_DELIVERED, {
            conversation_id: message.conversation_id,
            message_id: message.id,
          });
        }

        return;
      }

      routeIncomingMainChatMessage(queryClient, message, currentUserId, selectedUser);

      if (message.sender_id !== currentUserId) {
        socket.emit(EVENTS.MESSAGE_DELIVERED, {
          conversation_id: message.conversation_id,
          message_id: message.id,
        });
        
        if (document.hidden || message.sender_id !== selectedUser) {
          // Try to find sender name from conversations
          const conversationsData = queryClient.getQueryData<any>(['conversations']);
          let senderName = message.sender_id;
          
          if (conversationsData?.pages) {
            const allConversations = conversationsData.pages.flatMap((p: any) => p.data);
            const conv = allConversations.find(
              (c: any) => c.conversation_id === message.conversation_id
            );
            if (conv) {
              senderName =
                conv.type === 'group'
                  ? conv.title || 'Group chat'
                  : conv.peer_user?.display_name || conv.peer_user?.username || message.sender_id;
            }
          }
          
          const title = senderName ? `New message from ${senderName}` : 'New Message';
          // Read the body through the decrypt/normalize boundary (E2EE-ready).
          const resolved = resolveMessageContent(message);
          const presentedKind = getPresentedMessageKind(message.type, resolved.media?.kind);
          const body =
            message.type === 'call' && resolved.call
              ? getCallSummaryText({
                  direction: getCallDirectionFromMeta(resolved.call, currentUserId),
                  type: resolved.call.type,
                  status: resolved.call.status,
                  durationMs: resolved.call.duration_ms,
                })
              : resolved.text?.trim() ||
                (presentedKind === 'audio' && resolved.media?.kind === 'voice'
                  ? '🎤 Voice message'
                  : presentedKind === 'audio' && resolved.media?.kind === 'audio'
                    ? '🎵 Audio'
                    : presentedKind === 'file'
                      ? '📎 File'
                      : getMessageTypeLabel(message.type, resolved.media?.kind));
          sendNotification(title, body);
        }
      }
    };

    const handleMessageStatus = (payload: MessageStatusPayload) => {
      const handled = applyMessageStatusUpdateToCaches(queryClient, payload);
      if (!handled) {
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        queryClient.invalidateQueries({ queryKey: ['threadMessages'] });
      }
    };

    const handleMessageEdited = (message: MessageDoc) => {
      updateMessageDocumentCaches(queryClient, message);
    };

    const handleMessageDeleted = (payload: MessageDoc | MessageDeletedEvent) => {
      if ('id' in payload) {
        updateMessageDocumentCaches(queryClient, payload);
        return;
      }

      const handled = applyMessageDeletedEventToCaches(queryClient, payload, currentUserId);
      if (!handled) {
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        queryClient.invalidateQueries({ queryKey: ['threadMessages'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    };

    const handleMessageReacted = (payload: MessageReactionsUpdate) => {
      updateReactionCaches(queryClient, payload);
    };

    const handlePollUpdated = (payload: PollUpdatedPayload) => {
      updatePollCache(queryClient, payload);
    };

    const handleThreadReplyCreated = (payload: MessageDoc | ({ message: MessageDoc } & ThreadSummary)) => {
      const { message, summary } = extractThreadReplyEvent(payload);
      // Use cache presence for reload-safe dedup — avoids double delivery
      // acknowledgment when both RECEIVE_MESSAGE and THREAD_REPLY_CREATED fire.
      const alreadyCached = !!findCachedMessage(queryClient, message.id, message);

      if (message.container_type === 'channel') {
        if (!alreadyCached) {
          routeIncomingMainChatMessage(
            queryClient,
            message,
            currentUserId,
            selectedUser
          );
        }
        if (summary) {
          updateThreadSummaryCaches(queryClient, summary);
        }
        return;
      }

      if (!alreadyCached && isThreadMessage(message)) {
        routeIncomingThreadMessage(
          queryClient,
          message,
          openThreadRootId,
          currentUserId,
          selectedUser
        );
      }

      if (summary) {
        updateThreadSummaryCaches(queryClient, summary);
      }

      if (!alreadyCached && message.sender_id !== currentUserId) {
        socket.emit(EVENTS.MESSAGE_DELIVERED, {
          conversation_id: message.conversation_id,
          message_id: message.id,
        });
      }
    };

    const handleThreadSummaryUpdated = (payload: ThreadSummary) => {
      updateThreadSummaryCaches(queryClient, payload);
    };

    const handleConversationPinsUpdated = (payload: {
      conversation_id?: string;
      pinned_message_ids?: string[];
    }) => {
      const conversationId = payload?.conversation_id;
      if (!conversationId) return;

      updateConversationPinnedMessages(
        queryClient,
        conversationId,
        payload.pinned_message_ids ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', conversationId] });
    };

    const handleConversationHistoryCleared = (payload: { conversation_id: string }) => {
      const conversationId = payload?.conversation_id;
      if (!conversationId) return;
      queryClient.invalidateQueries({
        queryKey: messageQueryKey({
          container_type: 'conversation',
          container_id: conversationId,
        }),
      });
      queryClient.invalidateQueries({
        queryKey: ['threadMessages', 'conversation', conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['members', conversationId] });
    };

    socket.on(EVENTS.RECEIVE_MESSAGE, handleReceiveMessage);
    socket.on(EVENTS.MESSAGE_STATUS, handleMessageStatus);
    socket.on(EVENTS.MESSAGE_EDITED, handleMessageEdited);
    socket.on(EVENTS.MESSAGE_DELETED, handleMessageDeleted);
    socket.on(EVENTS.MESSAGE_REACTED, handleMessageReacted);
    socket.on(EVENTS.POLL_UPDATED, handlePollUpdated);
    socket.on(EVENTS.THREAD_REPLY_CREATED, handleThreadReplyCreated);
    socket.on(EVENTS.THREAD_SUMMARY_UPDATED, handleThreadSummaryUpdated);
    socket.on(EVENTS.CONVERSATION_PINS_UPDATED, handleConversationPinsUpdated);
    socket.on(EVENTS.CONVERSATION_HISTORY_CLEARED, handleConversationHistoryCleared);

    return () => {
      socket.off(EVENTS.RECEIVE_MESSAGE, handleReceiveMessage);
      socket.off(EVENTS.MESSAGE_STATUS, handleMessageStatus);
      socket.off(EVENTS.MESSAGE_EDITED, handleMessageEdited);
      socket.off(EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      socket.off(EVENTS.MESSAGE_REACTED, handleMessageReacted);
      socket.off(EVENTS.POLL_UPDATED, handlePollUpdated);
      socket.off(EVENTS.THREAD_REPLY_CREATED, handleThreadReplyCreated);
      socket.off(EVENTS.THREAD_SUMMARY_UPDATED, handleThreadSummaryUpdated);
      socket.off(EVENTS.CONVERSATION_PINS_UPDATED, handleConversationPinsUpdated);
      socket.off(EVENTS.CONVERSATION_HISTORY_CLEARED, handleConversationHistoryCleared);
    };
  }, [queryClient, currentUserId, socket, selectedUser, openThreadRootId]);
};
