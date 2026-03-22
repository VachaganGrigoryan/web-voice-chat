import { useEffect, useRef, useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { Conversation, MessageDoc } from '@/api/types';
import { messagesApi } from '@/api/endpoints';
import {
  applyMessageStatusUpdateToCaches,
  MessageStatusPayload,
} from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { ChatMessage } from '../types/message';

interface UseChatReadStateParams {
  queryClient: QueryClient;
  socket: { emit: (event: string, payload: unknown) => void } | null;
  userId?: string | null;
  selectedUser: string | null;
  selectedThreadRootId: string | null;
  contacts: Conversation[];
  mainChatMessages: ChatMessage[];
  threadReplyMessages: ChatMessage[];
  selectedThreadRootMessage: ChatMessage | null;
}

export function useChatReadState({
  queryClient,
  socket,
  userId,
  selectedUser,
  selectedThreadRootId,
  contacts,
  mainChatMessages,
  threadReplyMessages,
  selectedThreadRootMessage,
}: UseChatReadStateParams) {
  const [highlightedMessageIds, setHighlightedMessageIds] = useState<Set<string>>(new Set());
  const mainReadEmittedMessagesRef = useRef<Set<string>>(new Set());
  const threadReadEmittedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mainReadEmittedMessagesRef.current.clear();
    threadReadEmittedMessagesRef.current.clear();
    setHighlightedMessageIds(new Set());
  }, [selectedUser]);

  useEffect(() => {
    threadReadEmittedMessagesRef.current.clear();
  }, [selectedThreadRootId]);

  const emitMessageRead = (messageIds: string[], payload: MessageStatusPayload) => {
    if (!messageIds.length) return;

    if (socket) {
      messageIds.forEach((messageId) => {
        socket.emit(EVENTS.MESSAGE_READ, { message_id: messageId });
      });
    }

    applyMessageStatusUpdateToCaches(queryClient, payload);
  };

  const highlightReadMessages = (messageIds: string[]) => {
    if (!messageIds.length) return;

    setHighlightedMessageIds((prev) => {
      const next = new Set(prev);
      messageIds.forEach((id) => next.add(id));
      return next;
    });

    window.setTimeout(() => {
      setHighlightedMessageIds((prev) => {
        const next = new Set(prev);
        messageIds.forEach((id) => next.delete(id));
        return next;
      });
    }, 3000);
  };

  const resetConversationUnreadCount = (peerUserId: string) => {
    queryClient.setQueryData(['conversations'], (old: any) => {
      if (!old?.pages) return old;

      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          data: page.data.map((conversation: Conversation) =>
            conversation.peer_user.id === peerUserId
              ? { ...conversation, unread_count: 0 }
              : conversation
          ),
        })),
      };
    });
  };

  useEffect(() => {
    if (!selectedUser) return;
    resetConversationUnreadCount(selectedUser);
  }, [selectedUser]);

  const markConversationCachesAsRead = (conversationId: string) => {
    const collectedIds = new Set<string>();

    const collectUnreadIds = (datasets: Array<[unknown, any]>) => {
      datasets.forEach(([, data]) => {
        const pages = data?.pages || [];
        pages.forEach((page: any) => {
          (page.data || []).forEach((message: MessageDoc) => {
            if (
              message.conversation_id === conversationId &&
              message.receiver_id === userId &&
              message.status !== 'read'
            ) {
              collectedIds.add(message.id);
            }
          });
        });
      });
    };

    collectUnreadIds(queryClient.getQueriesData({ queryKey: ['messages'] }));
    collectUnreadIds(queryClient.getQueriesData({ queryKey: ['threadMessages'] }));

    if (collectedIds.size > 0) {
      applyMessageStatusUpdateToCaches(queryClient, {
        conversation_id: conversationId,
        message_ids: [...collectedIds],
        status: 'read',
        read_at: new Date().toISOString(),
        scope: 'main',
      });
    }

    queryClient.setQueriesData({ queryKey: ['messages'] }, (old: any) => {
      if (!old?.pages) return old;

      let changed = false;
      const pages = old.pages.map((page: any) => ({
        ...page,
        data: (page.data || []).map((message: MessageDoc) => {
          if (message.conversation_id !== conversationId) {
            return message;
          }

          if ((message.thread_unread_count ?? 0) === 0) {
            return message;
          }

          changed = true;
          return {
            ...message,
            thread_unread_count: 0,
          };
        }),
      }));

      return changed ? { ...old, pages } : old;
    });
  };

  const handleMarkConversationAsRead = async (peerUserId: string) => {
    const conversation = contacts.find((item) => item.peer_user.id === peerUserId);
    if (!conversation) return;

    await messagesApi.markConversationRead(peerUserId);
    socket?.emit(EVENTS.CONVERSATION_READ, {
      peer_user_id: peerUserId,
    });
    resetConversationUnreadCount(peerUserId);
    markConversationCachesAsRead(conversation.conversation_id);
  };

  const handleVisibleMainMessageIds = (visibleMessageIds: string[]) => {
    if (!socket || !selectedUser || !visibleMessageIds.length) {
      return;
    }

    const visibleIdSet = new Set(visibleMessageIds);
    const unreadVisibleMessages = mainChatMessages.filter(
      (message) =>
        visibleIdSet.has(message.id) &&
        message.receiverId === userId &&
        message.status !== 'read' &&
        !mainReadEmittedMessagesRef.current.has(message.id)
    );

    const visibleIds = unreadVisibleMessages.map((message) => message.id);
    if (!visibleIds.length) {
      return;
    }

    visibleIds.forEach((id) => mainReadEmittedMessagesRef.current.add(id));

    emitMessageRead(visibleIds, {
      conversation_id: unreadVisibleMessages[0]?.chatId,
      peer_user_id: selectedUser,
      message_ids: visibleIds,
      status: 'read',
      scope: 'main',
      read_at: new Date().toISOString(),
    } as MessageStatusPayload & { peer_user_id: string });

    highlightReadMessages(visibleIds);
  };

  const handleVisibleThreadMessageIds = (visibleMessageIds: string[]) => {
    if (!socket || !selectedUser || !selectedThreadRootId || !visibleMessageIds.length) {
      return;
    }

    const visibleIdSet = new Set(visibleMessageIds);
    const unreadIds = threadReplyMessages
      .filter(
        (message) =>
          visibleIdSet.has(message.id) &&
          message.receiverId === userId &&
          message.status !== 'read' &&
          !threadReadEmittedMessagesRef.current.has(message.id)
      )
      .map((message) => message.id);
    if (!unreadIds.length) return;

    unreadIds.forEach((id) => threadReadEmittedMessagesRef.current.add(id));

    emitMessageRead(unreadIds, {
      conversation_id: selectedThreadRootMessage?.chatId,
      peer_user_id: selectedUser,
      thread_root_id: selectedThreadRootId,
      message_ids: unreadIds,
      status: 'read',
      scope: 'thread',
      read_at: new Date().toISOString(),
    } as MessageStatusPayload & { peer_user_id: string });

    highlightReadMessages(unreadIds);
  };

  return {
    highlightedMessageIds,
    resetConversationUnreadCount,
    handleMarkConversationAsRead,
    handleVisibleMainMessageIds,
    handleVisibleThreadMessageIds,
  };
}
