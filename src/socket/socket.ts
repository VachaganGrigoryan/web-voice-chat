import { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { EVENTS } from './events';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageDeletedEvent, MessageDoc, MessageReactionsUpdate, ThreadSummary } from '@/api/types';
import { socketClient } from './socketClient';
import { useAuthStore } from '@/store/authStore';

export type MessageStatusScope = 'main' | 'thread';

interface MessageStatusPayloadBase {
  status: 'sent' | 'delivered' | 'read';
  conversation_id?: string;
  peer_user_id?: string;
  scope?: MessageStatusScope;
  thread_root_id?: string | null;
  /** Fallback timestamp used when status-specific timestamps are absent. */
  updated_at?: string;
  /** Set when status is 'delivered'. */
  delivered_at?: string | null;
  /** Set when status is 'read'. */
  read_at?: string | null;
  user_id?: string;
}

export type MessageStatusPayload =
  | (MessageStatusPayloadBase & { message_id: string; message_ids?: never })
  | (MessageStatusPayloadBase & { message_ids: string[]; message_id?: never });

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: string[];
  typingUsers: Record<string, boolean>; // userId -> isTyping
  setSocket: (socket: Socket | null) => void;
  setIsConnected: (isConnected: boolean) => void;
  setOnlineUsers: (users: string[]) => void;
  setTypingUser: (userId: string, isTyping: boolean) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  isConnected: false,
  onlineUsers: [],
  typingUsers: {},
  setSocket: (socket) => set({ socket }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
  setTypingUser: (userId, isTyping) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [userId]: isTyping },
    })),
}));

// Sync socket events to store
const setupSocketSync = () => {
  // Track which socket instance has had its persistent listeners attached.
  // If the same socket object reconnects, we skip re-registration to avoid
  // stacking duplicate listeners. A new socket object (after reconnect()) gets
  // its own listeners registered fresh.
  let attachedToSocket: Socket | null = null;

  socketClient.onConnect((socket) => {
    const { setIsConnected, setOnlineUsers, setTypingUser, setSocket } = useSocketStore.getState();

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
    const updatePresence = (userId: string, online: boolean) => {
      const currentSet = new Set(useSocketStore.getState().onlineUsers);
      if (online) currentSet.add(userId);
      else currentSet.delete(userId);
      setOnlineUsers([...currentSet]);
    };

    socket.on(EVENTS.PRESENCE_UPDATE, (payload: any) => {
      if (payload.user_id) {
        updatePresence(payload.user_id, payload.status === 'online');
      }
    });

    socket.on(EVENTS.USER_ONLINE, ({ user_id }: { user_id: string }) => {
      updatePresence(user_id, true);
    });

    socket.on(EVENTS.USER_OFFLINE, ({ user_id }: { user_id: string }) => {
      updatePresence(user_id, false);
    });

    socket.on(EVENTS.SERVER_TYPING_START, (payload: any) => {
      const from = payload.from || payload.sender_id;
      if (from) setTypingUser(from, true);
    });

    socket.on(EVENTS.SERVER_TYPING_STOP, (payload: any) => {
      const from = payload.from || payload.sender_id;
      if (from) setTypingUser(from, false);
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
  conversationId?: string
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

        return conversationId ? message.conversation_id === conversationId : true;
      });

    if (matchedMessage) {
      return matchedMessage as MessageDoc;
    }
  }

  return null;
};

const getPeerIdForConversation = (
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string
) => {
  const conversationsData = queryClient.getQueryData<any>(['conversations']);
  const conversations = conversationsData?.pages?.flatMap((page: any) => page.data || []) || [];
  const conversation = conversations.find((item: any) => item?.conversation_id === conversationId);
  return conversation?.peer_user?.id || null;
};

const updateConversationLastMessage = (
  queryClient: ReturnType<typeof useQueryClient>,
  conversationPartnerId: string,
  message: MessageDoc,
  currentUserId?: string | null,
  selectedUser?: string | null
) => {
  queryClient.setQueryData(['conversations'], (old: any) => {
    if (!old?.pages) return old;

    const newPages = [...old.pages];
    const allConversations = newPages.flatMap((page) => page.data);
    const existingConvIndex = allConversations.findIndex((conversation) => conversation.peer_user.id === conversationPartnerId);

    if (existingConvIndex === -1) {
      return old;
    }

    const conversation = allConversations[existingConvIndex];
    const updatedConversation = {
      ...conversation,
      last_message: {
        id: message.id,
        type: message.type,
        text: message.text,
        media: message.media,
        status: message.status,
        created_at: message.created_at,
      },
      last_message_at: message.created_at,
      unread_count:
        message.sender_id !== currentUserId && selectedUser !== conversationPartnerId
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
            last_message: {
              ...conversation.last_message,
              type: message.type,
              text: message.is_deleted ? 'Message deleted' : message.text,
              media: message.is_deleted ? null : message.media,
              status: message.status,
              created_at: message.created_at,
            },
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
        const peerUserId = conversation.peer_user?.id;
        const messageHistory = peerUserId
          ? queryClient.getQueryData<any>(['messages', peerUserId])
          : null;
        const latestVisibleMessage =
          messageHistory?.pages
            ?.flatMap((historyPage: any) => historyPage.data || [])
            ?.find((message: MessageDoc) => message.conversation_id === conversationId) || null;

        return {
          ...conversation,
          last_message: latestVisibleMessage
            ? {
                id: latestVisibleMessage.id,
                type: latestVisibleMessage.type,
                text: latestVisibleMessage.is_deleted ? 'Message deleted' : latestVisibleMessage.text,
                media: latestVisibleMessage.is_deleted ? null : latestVisibleMessage.media,
                status: latestVisibleMessage.status,
                created_at: latestVisibleMessage.created_at,
              }
            : null,
          last_message_at: latestVisibleMessage
            ? latestVisibleMessage.updated_at || latestVisibleMessage.created_at
            : null,
        };
      }),
    }));

    return changed ? { ...old, pages } : old;
  });
};

const updateThreadSummaryCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  summary: ThreadSummary
) => {
  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (message) => message.id === summary.thread_root_id,
    (message) => ({
      ...message,
      thread_reply_count: summary.thread_reply_count,
      last_thread_reply_at: summary.last_thread_reply_at,
      updated_at: summary.last_thread_reply_at || message.updated_at,
    })
  );

  queryClient.setQueryData(['threadSummary', summary.thread_root_id], {
    success: true,
    data: summary,
  });
};

const incrementThreadSummaryCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  threadRootId: string,
  replyCreatedAt: string
) => {
  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (message) => message.id === threadRootId,
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
  updater: (current: number) => number
) => {
  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (message) => message.id === threadRootId,
    (message) => ({
      ...message,
      thread_unread_count: Math.max(0, updater(message.thread_unread_count ?? 0)),
    })
  );
};

const updateConversationStatuses = (
  queryClient: ReturnType<typeof useQueryClient>,
  messageIds: string[],
  status: MessageStatusPayload['status']
) => {
  const messageIdSet = new Set(messageIds);
  queryClient.setQueryData(['conversations'], (old: any) => {
    if (!old?.pages) return old;

    let changed = false;
    const pages = old.pages.map((page: any) => ({
      ...page,
      data: (page.data || []).map((conversation: any) => {
        if (!conversation.last_message?.id || !messageIdSet.has(conversation.last_message.id)) {
          return conversation;
        }

        changed = true;
        return {
          ...conversation,
          last_message: {
            ...conversation.last_message,
            status,
          },
        };
      }),
    }));

    return changed ? { ...old, pages } : old;
  });
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
  const statusAt =
    payload.status === 'read'
      ? payload.read_at || payload.updated_at || new Date().toISOString()
      : payload.delivered_at || payload.updated_at || new Date().toISOString();

  const updateStatus = (message: MessageDoc): MessageDoc => ({
    ...message,
    status: payload.status,
    delivered_at:
      payload.status === 'delivered'
        ? payload.delivered_at || payload.updated_at || message.delivered_at
        : message.delivered_at,
    read_at: payload.status === 'read' ? payload.read_at || payload.updated_at || message.read_at : message.read_at,
    updated_at: statusAt,
  });

  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (message) => messageIdSet.has(message.id),
    updateStatus
  );

  updateMessageAcrossCacheGroup(
    queryClient,
    'threadMessages',
    (message) => messageIdSet.has(message.id),
    updateStatus
  );

  if (payload.status === 'read' && payload.scope === 'thread' && payload.thread_root_id) {
    updateThreadUnreadCount(queryClient, payload.thread_root_id, () => 0);
  }

  updateConversationStatuses(queryClient, messageIds, payload.status);

  return true;
};

const updateReactionCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  payload: MessageReactionsUpdate
) => {
  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (message) => message.id === payload.message_id,
    (message) => ({
      ...message,
      reactions: payload.reactions,
      updated_at: payload.updated_at,
    })
  );

  updateMessageAcrossCacheGroup(
    queryClient,
    'threadMessages',
    (message) => message.id === payload.message_id,
    (message) => ({
      ...message,
      reactions: payload.reactions,
      updated_at: payload.updated_at,
    })
  );
};

const updateMessageDocumentCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  message: MessageDoc
) => {
  updateMessageAcrossCacheGroup(
    queryClient,
    'messages',
    (current) => current.id === message.id,
    () => message
  );

  updateMessageAcrossCacheGroup(
    queryClient,
    'threadMessages',
    (current) => current.id === message.id,
    () => message
  );

  updateConversationPreview(queryClient, message);
};

export const applyMessageDeletedEventToCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  payload: MessageDeletedEvent,
  currentUserId?: string | null
) => {
  const cachedMessage = findCachedMessage(queryClient, payload.message_id, payload.conversation_id);
  const matcher = (message: MessageDoc) =>
    message.id === payload.message_id &&
    (!payload.conversation_id || message.conversation_id === payload.conversation_id);
  const isActorCurrentUser = !!currentUserId && payload.actor_user_id === currentUserId;
  const isCurrentUsersMessage = !!currentUserId && cachedMessage?.sender_id === currentUserId;

  if (payload.hidden_for_me || isActorCurrentUser) {
    removeMessageAcrossCacheGroup(queryClient, 'messages', matcher);
    removeMessageAcrossCacheGroup(queryClient, 'threadMessages', matcher);
    rebuildConversationPreview(queryClient, payload.conversation_id);
    return true;
  }

  const updatedAt = payload.updated_at || new Date().toISOString();
  const preserveContentForOwnerSoftDelete = isCurrentUsersMessage && !isActorCurrentUser;
  const shouldMarkDeleted = payload.deleted_for_everyone || preserveContentForOwnerSoftDelete;
  const applyDeleteMutation = (message: MessageDoc) => ({
    ...message,
    text:
      preserveContentForOwnerSoftDelete
        ? message.text
        : payload.deleted_for_everyone
          ? null
          : message.text,
    media:
      preserveContentForOwnerSoftDelete
        ? message.media
        : payload.deleted_media
          ? null
          : message.media,
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
    rebuildConversationPreview(queryClient, payload.conversation_id);
  }

  return true;
};

const isThreadMessage = (message: MessageDoc) =>
  message.reply_mode === 'thread' && !!message.thread_root_id;

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

  queryClient.setQueryData(['threadMessages', message.thread_root_id], (old: any) =>
    prependMessageToMessageCache(old, message)
  );

  incrementThreadSummaryCache(queryClient, message.thread_root_id, message.created_at);
  if (openThreadRootId === message.thread_root_id) {
    updateThreadUnreadCount(queryClient, message.thread_root_id, () => 0);
  } else if (message.sender_id !== currentUserId) {
    updateThreadUnreadCount(queryClient, message.thread_root_id, (current) => current + 1);
  }
  updateConversationActivity(
    queryClient,
    message.conversation_id,
    message.created_at,
    message.sender_id !== currentUserId && selectedUser !== message.sender_id ? 1 : 0
  );
};

const routeIncomingMainChatMessage = (
  queryClient: ReturnType<typeof useQueryClient>,
  message: MessageDoc,
  currentUserId?: string | null,
  selectedUser?: string | null
) => {
  const conversationPartnerId = message.sender_id === currentUserId
    ? message.receiver_id
    : message.sender_id;

  queryClient.setQueryData(
    ['messages', conversationPartnerId],
    (old: any) => prependMessageToMessageCache(old, message)
  );

  const peerId = getPeerIdForConversation(queryClient, message.conversation_id);
  if (peerId) {
    updateConversationLastMessage(queryClient, peerId, message, currentUserId, selectedUser);
  } else {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }
};

const extractThreadReplyEvent = (
  payload: MessageDoc | ({ message: MessageDoc } & ThreadSummary)
): { message: MessageDoc; summary: ThreadSummary | null } => {
  if ('message' in payload) {
    return {
      message: payload.message,
      summary: {
        thread_root_id: payload.thread_root_id,
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
  const setOnlineUsers = useSocketStore((state) => state.setOnlineUsers);
  return { onlineUsers, setOnlineUsers };
};

export const useTypingIndicator = (userId?: string) => {
  const typingUsers = useSocketStore((state) => state.typingUsers);
  const socket = useSocketStore((state) => state.socket);
  
  const isTyping = userId ? !!typingUsers[userId] : false;
  
  const startTyping = (receiverId: string) => {
    socket?.emit(EVENTS.CLIENT_TYPING_START, { to: receiverId });
  };

  const stopTyping = (receiverId: string) => {
    socket?.emit(EVENTS.CLIENT_TYPING_STOP, { to: receiverId });
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
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!openThreadRootId) return;
    updateThreadUnreadCount(queryClient, openThreadRootId, () => 0);
  }, [openThreadRootId, queryClient]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: MessageDoc) => {
      if (isThreadMessage(message)) {
        // Check cache before routing — reload-safe dedup for MESSAGE_DELIVERED.
        // prependMessageToMessageCache handles duplicate cache insertions independently.
        const alreadyCached = !!findCachedMessage(queryClient, message.id);
        routeIncomingThreadMessage(
          queryClient,
          message,
          openThreadRootId,
          currentUserId,
          selectedUser
        );

        if (!alreadyCached && message.receiver_id === currentUserId) {
          socket.emit(EVENTS.MESSAGE_DELIVERED, { message_id: message.id });
        }

        return;
      }

      routeIncomingMainChatMessage(queryClient, message, currentUserId, selectedUser);

      if (message.receiver_id === currentUserId) {
        socket.emit(EVENTS.MESSAGE_DELIVERED, { message_id: message.id });
        
        if (document.hidden || message.sender_id !== selectedUser) {
          // Try to find sender name from conversations
          const conversationsData = queryClient.getQueryData<any>(['conversations']);
          let senderName = message.sender_id;
          
          if (conversationsData?.pages) {
            const allConversations = conversationsData.pages.flatMap((p: any) => p.data);
            const conv = allConversations.find((c: any) => c.peer_user.id === message.sender_id);
            if (conv) {
              senderName = conv.peer_user.display_name || conv.peer_user.username || message.sender_id;
            }
          }
          
          const title = senderName ? `New message from ${senderName}` : 'New Message';
          const body = message.type === 'voice' ? '🎤 Voice message' : message.text || 'New message';
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

    const handleThreadReplyCreated = (payload: MessageDoc | ({ message: MessageDoc } & ThreadSummary)) => {
      const { message, summary } = extractThreadReplyEvent(payload);
      // Use cache presence for reload-safe dedup — avoids double delivery
      // acknowledgment when both RECEIVE_MESSAGE and THREAD_REPLY_CREATED fire.
      const alreadyCached = !!findCachedMessage(queryClient, message.id);

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

      if (!alreadyCached && message.receiver_id === currentUserId) {
        socket.emit(EVENTS.MESSAGE_DELIVERED, { message_id: message.id });
      }
    };

    const handleThreadSummaryUpdated = (payload: ThreadSummary) => {
      updateThreadSummaryCaches(queryClient, payload);
    };

    socket.on(EVENTS.RECEIVE_MESSAGE, handleReceiveMessage);
    socket.on(EVENTS.MESSAGE_STATUS, handleMessageStatus);
    socket.on(EVENTS.MESSAGE_EDITED, handleMessageEdited);
    socket.on(EVENTS.MESSAGE_DELETED, handleMessageDeleted);
    socket.on(EVENTS.MESSAGE_REACTED, handleMessageReacted);
    socket.on(EVENTS.THREAD_REPLY_CREATED, handleThreadReplyCreated);
    socket.on(EVENTS.THREAD_SUMMARY_UPDATED, handleThreadSummaryUpdated);

    return () => {
      socket.off(EVENTS.RECEIVE_MESSAGE, handleReceiveMessage);
      socket.off(EVENTS.MESSAGE_STATUS, handleMessageStatus);
      socket.off(EVENTS.MESSAGE_EDITED, handleMessageEdited);
      socket.off(EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      socket.off(EVENTS.MESSAGE_REACTED, handleMessageReacted);
      socket.off(EVENTS.THREAD_REPLY_CREATED, handleThreadReplyCreated);
      socket.off(EVENTS.THREAD_SUMMARY_UPDATED, handleThreadSummaryUpdated);
    };
  }, [queryClient, currentUserId, socket, selectedUser, openThreadRootId]);
};
