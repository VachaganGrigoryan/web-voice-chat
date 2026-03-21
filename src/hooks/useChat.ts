import { useState, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { messagesApi, realtimeApi, conversationsApi } from '@/api/endpoints';
import { useSocket, usePresence, useRealtimeMessages, useSocketStore } from '@/socket/socket';
import { MessageDoc, ReplyMode } from '@/api/types';

export interface SendMediaInput {
  type: 'voice' | 'image' | 'sticker' | 'video' | 'file';
  receiver_id: string;
  file: File;
  text?: string;
  duration_ms?: number;
  reply_mode?: ReplyMode | null;
  reply_to_message_id?: string;
}

export interface SendTextInput {
  receiver_id: string;
  text: string;
  reply_mode?: ReplyMode | null;
  reply_to_message_id?: string;
}

const prependMessageToCache = (queryClient: ReturnType<typeof useQueryClient>, peerUserId: string, message: MessageDoc) => {
  queryClient.setQueryData(['messages', peerUserId], (old: any) => {
    if (!old) {
      return {
        pages: [{ data: [message], meta: { next_cursor: null, limit: 20, total: 1 }, success: true }],
        pageParams: [undefined],
      };
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
  });
};

const prependThreadMessageToCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  threadRootId: string,
  message: MessageDoc
) => {
  queryClient.setQueryData(['threadMessages', threadRootId], (old: any) => {
    if (!old) {
      return {
        pages: [{ data: [message], meta: { next_cursor: null, limit: 20, total: 1 }, success: true }],
        pageParams: [undefined],
      };
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
  });
};

const updateMessageAcrossCacheGroup = (
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string,
  messageId: string,
  updater: (message: MessageDoc) => MessageDoc
) => {
  queryClient.setQueriesData({ queryKey: [queryKey] }, (old: any) => {
    if (!old?.pages) return old;

    let changed = false;
    const pages = old.pages.map((page: any) => ({
      ...page,
      data: (page.data || []).map((message: MessageDoc) => {
        if (message.id !== messageId) {
          return message;
        }

        changed = true;
        return updater(message);
      }),
    }));

    return changed ? { ...old, pages } : old;
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

const updateConversationActivity = (
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  updatedAt: string,
  unreadIncrement: number = 0
) => {
  queryClient.setQueryData(['conversations'], (old: any) => {
    if (!old?.pages) return old;

    return {
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        data: page.data.map((conversation: any) =>
          conversation.conversation_id === conversationId
            ? {
                ...conversation,
                last_message_at: updatedAt,
                unread_count: (conversation.unread_count ?? 0) + unreadIncrement,
              }
            : conversation
        ),
      })),
    };
  });
};

const updateThreadRootSummaryFromReply = (
  queryClient: ReturnType<typeof useQueryClient>,
  threadRootId: string,
  replyCreatedAt: string
) => {
  queryClient.setQueriesData({ queryKey: ['messages'] }, (old: any) => {
    if (!old?.pages) return old;

    let changed = false;
    const pages = old.pages.map((page: any) => ({
      ...page,
      data: (page.data || []).map((message: MessageDoc) => {
        if (message.id !== threadRootId) {
          return message;
        }

        changed = true;
        return {
          ...message,
          is_thread_root: true,
          thread_reply_count: (message.thread_reply_count ?? 0) + 1,
          last_thread_reply_at: replyCreatedAt,
          updated_at: replyCreatedAt,
        };
      }),
    }));

    return changed ? { ...old, pages } : old;
  });
};

const integrateCreatedMessage = (
  queryClient: ReturnType<typeof useQueryClient>,
  selectedUser: string,
  message: MessageDoc
) => {
  if (message.reply_mode === 'thread' && message.thread_root_id) {
    prependThreadMessageToCache(queryClient, message.thread_root_id, message);
    updateThreadRootSummaryFromReply(queryClient, message.thread_root_id, message.created_at);
    updateConversationActivity(queryClient, message.conversation_id, message.created_at);
    return;
  }

  prependMessageToCache(queryClient, selectedUser, message);
};

export const useConversations = () => {
  return useInfiniteQuery({
    queryKey: ['conversations'],
    queryFn: async ({ pageParam }) => {
      const response = await conversationsApi.getConversations(20, pageParam as string | undefined);
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    initialPageParam: undefined,
  });
};

export const useThreadMessages = (threadRootId: string | null) => {
  return useInfiniteQuery({
    queryKey: ['threadMessages', threadRootId],
    queryFn: async ({ pageParam }) => {
      if (!threadRootId) {
        return { data: [], meta: { next_cursor: null, limit: 20, total: 0 }, success: true };
      }

      const response = await messagesApi.getThreadMessages(threadRootId, 20, pageParam as string | undefined);
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    enabled: !!threadRootId,
    initialPageParam: undefined,
  });
};

export const useChat = () => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Initialize socket and subscriptions
  useSocket();
  useRealtimeMessages(selectedUser);
  const { onlineUsers, setOnlineUsers } = usePresence();

  // Initial fetch of online users (fallback/initial population)
  useQuery({
    queryKey: ['onlineUsers'],
    queryFn: async () => {
      const response = await realtimeApi.getOnlineUsers();
      setOnlineUsers(response.data.data);
      return response.data.data;
    },
    // We rely on socket events for updates, but this fetches initial state
    staleTime: Infinity, 
  });

  const {
    data: messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['messages', selectedUser],
    queryFn: async ({ pageParam }) => {
      if (!selectedUser) return { data: [], meta: { next_cursor: null, limit: 20, total: 0 }, success: true };
      const response = await messagesApi.getHistory(selectedUser, 20, pageParam as string | undefined);
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    enabled: !!selectedUser,
    initialPageParam: undefined,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: SendMediaInput) => {
      const response = await messagesApi.uploadMedia(data);
      return response.data.data;
    },
    onSuccess: (newMessage, variables) => {
      if (selectedUser) {
        // Emit socket event to notify server
        const { socket } = useSocketStore.getState();
        socket?.emit('send_message', {
          to: selectedUser,
          message_id: newMessage.id,
          type: variables.type
        });

        integrateCreatedMessage(queryClient, selectedUser, newMessage);
      }
    },
  });

  const sendTextMutation = useMutation({
    mutationFn: async (data: SendTextInput) => {
      const response = await messagesApi.sendText(data);
      return response.data.data;
    },
    onSuccess: (newMessage) => {
      if (selectedUser) {
        // Emit socket event to notify server
        const { socket } = useSocketStore.getState();
        socket?.emit('send_message', {
          to: selectedUser,
          message_id: newMessage.id,
          type: 'text'
        });

        integrateCreatedMessage(queryClient, selectedUser, newMessage);
      }
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, text }: { messageId: string; text: string }) => {
      const response = await messagesApi.editMessage(messageId, text);
      return response.data;
    },
    onSuccess: (updatedMessage) => {
      updateMessageAcrossCacheGroup(queryClient, 'messages', updatedMessage.id, () => updatedMessage);
      updateMessageAcrossCacheGroup(queryClient, 'threadMessages', updatedMessage.id, () => updatedMessage);
      updateConversationPreview(queryClient, updatedMessage);
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await messagesApi.deleteMessage(messageId);
      return response.data;
    },
    onSuccess: (updatedMessage) => {
      updateMessageAcrossCacheGroup(queryClient, 'messages', updatedMessage.id, () => updatedMessage);
      updateMessageAcrossCacheGroup(queryClient, 'threadMessages', updatedMessage.id, () => updatedMessage);
      updateConversationPreview(queryClient, updatedMessage);
    },
  });

  return {
    selectedUser,
    setSelectedUser,
    onlineUsers,
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sendVoice: sendMessageMutation.mutateAsync as (data: SendMediaInput) => Promise<any>,
    sendText: sendTextMutation.mutateAsync as (data: SendTextInput) => Promise<any>,
    editMessage: editMessageMutation.mutateAsync as (data: { messageId: string; text: string }) => Promise<any>,
    deleteMessage: deleteMessageMutation.mutateAsync as (messageId: string) => Promise<any>,
    isSending: sendMessageMutation.isPending || sendTextMutation.isPending,
    isEditingMessage: editMessageMutation.isPending,
    isDeletingMessage: deleteMessageMutation.isPending,
  };
};
