import { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { EVENTS } from './events';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageDoc, MessageReactionsUpdate, ThreadSummary } from '@/api/types';
import { socketClient } from './socketClient';
import { useAuthStore } from '@/store/authStore';

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
  socketClient.onConnect((socket) => {
    const { setIsConnected, setOnlineUsers, setTypingUser, setSocket } = useSocketStore.getState();
    
    setSocket(socket);
    setIsConnected(true);

    socket.on(EVENTS.DISCONNECT, () => {
      setIsConnected(false);
    });

    socket.on(EVENTS.PRESENCE_UPDATE, (payload: any) => {
      // Assuming payload is { user_id: string, status: 'online' | 'offline' } or similar
      // The prompt says "existing presence payload shape"
      if (payload.status === 'online') {
        const currentUsers = useSocketStore.getState().onlineUsers;
        if (!currentUsers.includes(payload.user_id)) {
          setOnlineUsers([...currentUsers, payload.user_id]);
        }
      } else if (payload.status === 'offline') {
        const currentUsers = useSocketStore.getState().onlineUsers;
        setOnlineUsers(currentUsers.filter((id) => id !== payload.user_id));
      }
    });

    // Keep these if the backend still sends them separately, otherwise presence_update covers it
    socket.on(EVENTS.USER_ONLINE, ({ user_id }: { user_id: string }) => {
      const currentUsers = useSocketStore.getState().onlineUsers;
      if (!currentUsers.includes(user_id)) {
        setOnlineUsers([...currentUsers, user_id]);
      }
    });

    socket.on(EVENTS.USER_OFFLINE, ({ user_id }: { user_id: string }) => {
      const currentUsers = useSocketStore.getState().onlineUsers;
      setOnlineUsers(currentUsers.filter((id) => id !== user_id));
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
  const processedThreadReplyIdsRef = useRef<Set<string>>(new Set());

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
        if (processedThreadReplyIdsRef.current.has(message.id)) {
          return;
        }

        processedThreadReplyIdsRef.current.add(message.id);
        routeIncomingThreadMessage(
          queryClient,
          message,
          openThreadRootId,
          currentUserId,
          selectedUser
        );

        if (message.receiver_id === currentUserId) {
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

    const handleMessageStatus = ({ message_id, status }: { message_id: string, status: 'delivered' | 'read' }) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    };

    const handleMessageEdited = (message: MessageDoc) => {
      updateMessageDocumentCaches(queryClient, message);
    };

    const handleMessageDeleted = (message: MessageDoc) => {
      updateMessageDocumentCaches(queryClient, message);
    };

    const handleMessageReacted = (payload: MessageReactionsUpdate) => {
      updateReactionCaches(queryClient, payload);
    };

    const handleThreadReplyCreated = (payload: MessageDoc | ({ message: MessageDoc } & ThreadSummary)) => {
      const { message, summary } = extractThreadReplyEvent(payload);
      const alreadyProcessed = processedThreadReplyIdsRef.current.has(message.id);
      processedThreadReplyIdsRef.current.add(message.id);

      if (!alreadyProcessed && isThreadMessage(message)) {
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

      if (!alreadyProcessed && message.receiver_id === currentUserId) {
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
