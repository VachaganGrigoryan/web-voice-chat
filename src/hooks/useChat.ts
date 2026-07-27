import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { getApiErrorStatus } from '@/api/errors';
import { messagesApi, realtimeApi, conversationsApi, pollsApi } from '@/api/endpoints';
import { pollQueryKey } from '@/hooks/usePoll';
import { toSinglePageResponse } from '@/api/utils';
import { applyMessageDeletedEventToCaches, useSocket, usePresence, useRealtimeMessages, useSocketStore } from '@/socket/socket';
import {
  ClearConversationResponse,
  CreatePollRequest,
  CreatePollResponse,
  DeleteConversationResponse,
  MessageContainerRef,
  MessageDoc,
  MessageReactionGroup,
  MessageReactionsUpdate,
  PresenceStatus,
  PreviewMediaKind,
  ReplyMode,
  SendRichContentRequest,
} from '@/api/types';
import { useAuthStore } from '@/store/authStore';
import { resolveMessageContent } from '@/api/messageContent';
import { messageQueryKey, threadMessageQueryKey } from '@/api/queryKeys';

interface BaseSendMediaInput extends MessageContainerRef {
  file: File;
  text?: string;
  duration_ms?: number;
  reply_mode?: ReplyMode | null;
  reply_to_message_id?: string;
  client_batch_id?: string;
  signal?: AbortSignal;
  onUploadProgress?: (progress: number) => void;
}

export type SendMediaInput =
  | (BaseSendMediaInput & {
      type: 'media';
      media_kind: PreviewMediaKind;
    })
  | (BaseSendMediaInput & {
      type: 'file';
      media_kind?: never;
    });

export interface SendTextInput extends MessageContainerRef {
  text: string;
  reply_mode?: ReplyMode | null;
  reply_to_message_id?: string;
}

export type SendRichContentInput = SendRichContentRequest;

export interface ToggleReactionInput extends MessageContainerRef {
  messageId: string;
  emoji: string;
}

const prependMessageToCache = (queryClient: ReturnType<typeof useQueryClient>, conversationId: string, message: MessageDoc) => {
  queryClient.setQueryData(
    messageQueryKey({ container_type: 'conversation', container_id: conversationId }),
    (old: any) => {
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
    }
  );
};

const prependThreadMessageToCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  threadRootId: string,
  message: MessageDoc
) => {
  queryClient.setQueryData(threadMessageQueryKey(message, threadRootId), (old: any) => {
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

const createEmptyInfiniteData = () => ({
  pages: [{ data: [], meta: { next_cursor: null, limit: 20, total: 0 }, success: true }],
  pageParams: [undefined],
});

const clearConversationMessageCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  cacheConversationId: string,
  conversationId: string
) => {
  queryClient.setQueryData(
    messageQueryKey({ container_type: 'conversation', container_id: cacheConversationId }),
    () => createEmptyInfiniteData()
  );

  queryClient.setQueriesData({ queryKey: ['threadMessages'] }, (old: any) => {
    if (!old?.pages) return old;

    const belongsToConversation = old.pages.some((page: any) =>
      (page.data || []).some((message: MessageDoc) => message.conversation_id === conversationId)
    );

    return belongsToConversation ? createEmptyInfiniteData() : old;
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
            last_message: (() => {
              const resolved = resolveMessageContent(message);
              return {
                ...conversation.last_message,
                type: message.type,
                text: message.is_deleted ? 'Message deleted' : resolved.text,
                media: message.is_deleted ? null : resolved.media,
                call: message.is_deleted ? null : resolved.call,
                created_at: message.created_at,
              };
            })(),
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

const applyReactionUpdate = (
  queryClient: ReturnType<typeof useQueryClient>,
  payload: MessageReactionsUpdate
) => {
  updateMessageAcrossCacheGroup(queryClient, 'messages', payload.message_id, (message) => ({
    ...message,
    reactions: payload.reactions,
    updated_at: payload.updated_at,
  }));

  updateMessageAcrossCacheGroup(queryClient, 'threadMessages', payload.message_id, (message) => ({
    ...message,
    reactions: payload.reactions,
    updated_at: payload.updated_at,
  }));
};

const toggleLocalReactionGroups = (
  reactions: MessageReactionGroup[],
  emoji: string,
  currentUserId: string,
  updatedAt: string
) => {
  const existingReaction = reactions.find((reaction) => reaction.emoji === emoji);
  const nextReactions = [...reactions];

  if (!existingReaction) {
    if (nextReactions.length >= 10) {
      return nextReactions;
    }

    return [
      ...nextReactions,
      {
        emoji,
        user_ids: [currentUserId],
        count: 1,
        updated_at: updatedAt,
      },
    ];
  }

  const hasOwnReaction = existingReaction.user_ids.includes(currentUserId);
  const nextUserIds = hasOwnReaction
    ? existingReaction.user_ids.filter((userId) => userId !== currentUserId)
    : [...existingReaction.user_ids, currentUserId];

  return nextReactions
    .map((reaction) =>
      reaction.emoji !== emoji
        ? reaction
        : {
            ...reaction,
            user_ids: nextUserIds,
            count: nextUserIds.length,
            updated_at: updatedAt,
          }
    )
    .filter((reaction) => reaction.count > 0);
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
  if (message.conversation_id !== selectedUser) {
    prependThreadMessageToCache(queryClient, message.conversation_id, message);
    updateConversationActivity(queryClient, message.conversation_id, message.created_at);
    queryClient.invalidateQueries({ queryKey: ['threads'] });
    return;
  }

  if (message.reply_mode === 'thread' && message.thread_root_id) {
    prependThreadMessageToCache(queryClient, message.thread_root_id, message);
    updateThreadRootSummaryFromReply(queryClient, message.thread_root_id, message.created_at);
    updateConversationActivity(queryClient, message.conversation_id, message.created_at);
    return;
  }

  prependMessageToCache(queryClient, selectedUser, message);
};

const emitOutgoingMessage = (message: MessageDoc, type: string, conversationId: string) => {
  const { socket } = useSocketStore.getState();
  socket?.emit('send_message', {
    conversation_id: conversationId,
    message_id: message.id,
    type,
    reply_mode: message.reply_mode,
    reply_to_message_id: message.reply_to_message_id,
    thread_root_id: message.thread_root_id,
  });
};

export const useConversations = (spaceId?: string | null) => {
  return useInfiniteQuery({
    queryKey: ['conversations', spaceId],
    queryFn: ({ pageParam }) =>
      conversationsApi.getConversations(20, pageParam as string | undefined, {
        space_id: spaceId || undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    initialPageParam: undefined,
  });
};

export const useThreadMessages = (threadConversationId: string | null) => {
  return useInfiniteQuery({
    queryKey: threadMessageQueryKey(
      {
        container_type: 'conversation',
        container_id: threadConversationId ?? '',
      },
      threadConversationId ?? ''
    ),
    queryFn: async () => {
      if (!threadConversationId) {
        return toSinglePageResponse([], 0);
      }
      return toSinglePageResponse(
        await conversationsApi.getThreadConversationMessages(threadConversationId)
      );
    },
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    enabled: !!threadConversationId,
    initialPageParam: undefined,
  });
};

export const useChat = (selectedUser: string | null = null, openThreadRootId: string | null = null) => {
  const queryClient = useQueryClient();
  const { userId: currentUserId } = useAuthStore();
  
  // Initialize socket and subscriptions
  useSocket();
  useRealtimeMessages(selectedUser, openThreadRootId);
  const { onlineUsers, presenceByUserId, setOnlineUsers, setPresence } = usePresence();

  // Initial fetch of online users (fallback/initial population)
  useQuery({
    queryKey: ['onlineUsers'],
    queryFn: async () => {
      const onlineUserIds = await realtimeApi.getOnlineUsers();
      setOnlineUsers(onlineUserIds);
      return onlineUserIds;
    },
    // We rely on socket events for updates, but this fetches initial state
    staleTime: Infinity, 
  });

  useQuery({
    queryKey: ['presence', selectedUser],
    queryFn: async () => {
      if (!selectedUser) return {};
      const conversations = queryClient.getQueryData<any>(['conversations']);
      const selectedConversation = conversations?.pages
        ?.flatMap((page: any) => page.data || [])
        ?.find((conversation: any) => conversation.conversation_id === selectedUser);
      const userIds = [
        selectedConversation?.peer_user?.id,
        ...(selectedConversation?.participant_users || []).map((user: any) => user.id),
      ].filter(Boolean);
      const uniqueUserIds = Array.from(new Set(userIds));
      if (uniqueUserIds.length === 0) return {};
      const presence = await realtimeApi.getPresence(uniqueUserIds);
      Object.entries(presence).forEach(([userId, value]: [string, PresenceStatus]) => {
        setPresence(userId, value);
      });
      return presence;
    },
    enabled: !!selectedUser,
    staleTime: 30 * 1000,
  });

  const {
    data: messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error: messagesError,
    isError: isMessagesError,
  } = useInfiniteQuery({
    queryKey: messageQueryKey({
      container_type: 'conversation',
      container_id: selectedUser ?? '',
    }),
    queryFn: ({ pageParam }) => {
      if (!selectedUser) return Promise.resolve({ data: [], meta: { next_cursor: null, limit: 20, total: 0 }, success: true });
      return messagesApi.getHistory(
        { container_type: 'conversation', container_id: selectedUser },
        20,
        pageParam as string | undefined
      );
    },
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    enabled: !!selectedUser,
    initialPageParam: undefined,
    retry: (_count, error) => getApiErrorStatus(error) !== 404,
  });
  const isSelectedConversationMissing = isMessagesError && getApiErrorStatus(messagesError) === 404;

  const sendMessageMutation = useMutation({
    mutationFn: (data: SendMediaInput) =>
      messagesApi.uploadMedia({
        ...data,
        onUploadProgress: data.onUploadProgress
          ? (event) => {
              if (!event.total) return;
              data.onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
            }
          : undefined,
      }),
    onSuccess: (newMessage, variables) => {
      if (selectedUser) {
        const messageWithClientBatchId = variables.client_batch_id
          ? {
              ...newMessage,
              client_batch_id: variables.client_batch_id,
            }
          : newMessage;

        emitOutgoingMessage(messageWithClientBatchId, variables.type, newMessage.container_id);
        integrateCreatedMessage(queryClient, selectedUser, messageWithClientBatchId);
      }
    },
  });

  const sendTextMutation = useMutation({
    mutationFn: (data: SendTextInput) => messagesApi.sendText(data),
    onSuccess: (newMessage) => {
      if (selectedUser) {
        emitOutgoingMessage(newMessage, 'text', newMessage.container_id);
        integrateCreatedMessage(queryClient, selectedUser, newMessage);
      }
    },
  });

  const sendRichContentMutation = useMutation({
    mutationFn: (data: SendRichContentInput) => messagesApi.sendRichContent(data),
    onSuccess: (newMessage) => {
      if (selectedUser) {
        emitOutgoingMessage(newMessage, newMessage.type, newMessage.container_id);
        integrateCreatedMessage(queryClient, selectedUser, newMessage);
      }
    },
  });

  const createPollMutation = useMutation({
    mutationFn: (data: CreatePollRequest) => pollsApi.create(data),
    onSuccess: ({ poll, message }: CreatePollResponse) => {
      // Seed the poll query cache so the card renders tallies without an extra fetch.
      queryClient.setQueryData(pollQueryKey(poll.id), poll);
      if (selectedUser) {
        emitOutgoingMessage(message, message.type, message.container_id);
        integrateCreatedMessage(queryClient, selectedUser, message);
      }
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: ({
      conversationId,
      messageId,
      text,
    }: {
      conversationId?: string;
      messageId: string;
      text: string;
    }) =>
      (conversationId || selectedUser)
        ? messagesApi.editMessage(conversationId || (selectedUser as string), messageId, text)
        : Promise.reject(new Error('No conversation selected')),
    onSuccess: (updatedMessage) => {
      updateMessageAcrossCacheGroup(queryClient, 'messages', updatedMessage.id, () => updatedMessage);
      updateMessageAcrossCacheGroup(queryClient, 'threadMessages', updatedMessage.id, () => updatedMessage);
      updateConversationPreview(queryClient, updatedMessage);
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId?: string; messageId: string }) =>
      (conversationId || selectedUser)
        ? messagesApi.deleteMessage(conversationId || (selectedUser as string), messageId)
        : Promise.reject(new Error('No conversation selected')),
    onSuccess: (deletedMessage) => {
      applyMessageDeletedEventToCaches(
        queryClient,
        {
          ...deletedMessage,
          updated_at: new Date().toISOString(),
        },
        currentUserId
      );
    },
  });

  const clearConversationMutation = useMutation({
    mutationFn: (conversationId: string) => messagesApi.clearConversation(conversationId),
    onSuccess: (result, conversationId) => {
      clearConversationMessageCaches(queryClient, conversationId, result.conversation_id);

      queryClient.setQueryData(['conversations'], (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((conversation: any) =>
              conversation.conversation_id === result.conversation_id ||
              conversation.id === conversationId
                ? { ...conversation, last_message: null, last_message_at: null, unread_count: 0 }
                : conversation
            ),
          })),
        };
      });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) => messagesApi.deleteConversation(conversationId),
    onSuccess: (result, conversationId) => {
      clearConversationMessageCaches(queryClient, conversationId, result.conversation_id);

      queryClient.setQueryData(['conversations'], (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.filter(
              (conversation: any) =>
                conversation.conversation_id !== result.conversation_id &&
                conversation.id !== conversationId
            ),
          })),
        };
      });

      queryClient.invalidateQueries({ queryKey: ['pings', 'incoming'] });
      queryClient.invalidateQueries({ queryKey: ['pings', 'outgoing'] });
    },
  });

  const toggleReactionMutation = useMutation({
    mutationFn: ({
      container_type,
      container_id,
      messageId,
      emoji,
    }: ToggleReactionInput) =>
      messagesApi.toggleReaction(
        { container_type, container_id },
        messageId,
        emoji
      ),
    onMutate: async ({ messageId, emoji }) => {
      if (!currentUserId) {
        return;
      }

      const updatedAt = new Date().toISOString();
      let localPayload: MessageReactionsUpdate | null = null;

      const queryGroups = queryClient.getQueriesData<any>({ queryKey: ['messages'] });
      const threadQueryGroups = queryClient.getQueriesData<any>({ queryKey: ['threadMessages'] });

      [...queryGroups, ...threadQueryGroups].some(([, data]) => {
        const foundMessage = data?.pages
          ?.flatMap((page: any) => page.data || [])
          ?.find((message: MessageDoc) => message.id === messageId);

        if (!foundMessage) {
          return false;
        }

        localPayload = {
          message_id: messageId,
          container_type: foundMessage.container_type,
          container_id: foundMessage.container_id,
          conversation_id: foundMessage.conversation_id,
          reactions: toggleLocalReactionGroups(
            foundMessage.reactions || [],
            emoji,
            currentUserId,
            updatedAt
          ),
          updated_at: updatedAt,
        };

        return true;
      });

      if (localPayload) {
        applyReactionUpdate(queryClient, localPayload);
      }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['threadMessages'] });
    },
    onSuccess: (updatedMessage) => {
      updateMessageAcrossCacheGroup(queryClient, 'messages', updatedMessage.id, () => updatedMessage);
      updateMessageAcrossCacheGroup(queryClient, 'threadMessages', updatedMessage.id, () => updatedMessage);
      updateConversationPreview(queryClient, updatedMessage);
    },
  });

  return {
    selectedUser,
    onlineUsers,
    presenceByUserId,
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isSelectedConversationMissing,
    sendVoice: sendMessageMutation.mutateAsync as (data: SendMediaInput) => Promise<any>,
    sendText: sendTextMutation.mutateAsync as (data: SendTextInput) => Promise<any>,
    sendRichContent: sendRichContentMutation.mutateAsync as (data: SendRichContentInput) => Promise<MessageDoc>,
    createPoll: createPollMutation.mutateAsync as (data: CreatePollRequest) => Promise<CreatePollResponse>,
    editMessage: editMessageMutation.mutateAsync as (data: { conversationId?: string; messageId: string; text: string }) => Promise<any>,
    deleteMessage: deleteMessageMutation.mutateAsync as (data: { conversationId?: string; messageId: string }) => Promise<any>,
    clearConversation: clearConversationMutation.mutateAsync as (conversationId: string) => Promise<ClearConversationResponse>,
    deleteConversation: deleteConversationMutation.mutateAsync as (conversationId: string) => Promise<DeleteConversationResponse>,
    toggleReaction: toggleReactionMutation.mutateAsync as (
      data: ToggleReactionInput
    ) => Promise<MessageDoc>,
    isSending: sendMessageMutation.isPending || sendTextMutation.isPending || sendRichContentMutation.isPending,
    isEditingMessage: editMessageMutation.isPending,
    isDeletingMessage: deleteMessageMutation.isPending,
    isClearingConversation: clearConversationMutation.isPending,
    isDeletingConversation: deleteConversationMutation.isPending,
    isTogglingReaction: toggleReactionMutation.isPending,
  };
};
