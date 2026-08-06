import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { applyMessageStatusUpdateToCaches, MessageStatusPayload, useSocketStore } from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import type { MessageContainerRef } from '@/api/types';
import { ChatMessage } from '../types/message';

/**
 * Per-message delivery/read receipts. Conversation-only: channels have no
 * per-recipient receipt concept, only a container-level unread count, which
 * is handled generically by `useMarkContainerRead` instead.
 */
export function useMessageReadReceipts({
  userId,
  selectedConversationId,
  selectedContainer,
  selectedThreadRootId,
  mainChatMessages,
  threadReplyMessages,
}: {
  userId?: string | null;
  selectedConversationId: string | null;
  selectedContainer: MessageContainerRef | null;
  selectedThreadRootId: string | null;
  mainChatMessages: ChatMessage[];
  threadReplyMessages: ChatMessage[];
}) {
  const queryClient = useQueryClient();
  const socket = useSocketStore((state) => state.socket);
  const [highlightedMessageIds, setHighlightedMessageIds] = useState<Set<string>>(new Set());
  const mainReadEmittedMessagesRef = useRef<Set<string>>(new Set());
  const threadReadEmittedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mainReadEmittedMessagesRef.current.clear();
    threadReadEmittedMessagesRef.current.clear();
    setHighlightedMessageIds(new Set());
  }, [selectedConversationId]);

  useEffect(() => {
    threadReadEmittedMessagesRef.current.clear();
  }, [selectedThreadRootId]);

  const emitMessageRead = (messageIds: string[], payload: MessageStatusPayload) => {
    if (!messageIds.length) return;

    if (socket) {
      messageIds.forEach((messageId) => {
        socket.emit(EVENTS.MESSAGE_READ, {
          container_type: payload.container_type,
          container_id: payload.container_id,
          conversation_id: payload.conversation_id,
          message_id: messageId,
        });
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

  const handleVisibleMainMessageIds = (visibleMessageIds: string[]) => {
    if (!socket || !selectedConversationId || !visibleMessageIds.length) {
      return;
    }

    const visibleIdSet = new Set(visibleMessageIds);
    const unreadVisibleMessages = mainChatMessages.filter(
      (message) =>
        visibleIdSet.has(message.id) &&
        message.senderId !== userId &&
        message.status !== 'read' &&
        !mainReadEmittedMessagesRef.current.has(message.id)
    );

    const visibleIds = unreadVisibleMessages.map((message) => message.id);
    if (!visibleIds.length) {
      return;
    }

    visibleIds.forEach((id) => mainReadEmittedMessagesRef.current.add(id));

    emitMessageRead(visibleIds, {
      container_type: 'conversation',
      container_id:
        unreadVisibleMessages[0].raw?.container_id ?? selectedContainer?.container_id,
      conversation_id: unreadVisibleMessages[0]?.chatId,
      message_ids: visibleIds,
      status: 'read',
      scope: 'main',
    });

    highlightReadMessages(visibleIds);
  };

  const handleVisibleThreadMessageIds = (visibleMessageIds: string[]) => {
    if (
      !socket ||
      !selectedConversationId ||
      !selectedThreadRootId ||
      selectedContainer?.container_type !== 'conversation' ||
      !visibleMessageIds.length
    ) {
      return;
    }

    const visibleIdSet = new Set(visibleMessageIds);
    const unreadIds = threadReplyMessages
      .filter(
        (message) =>
          visibleIdSet.has(message.id) &&
          message.senderId !== userId &&
          message.status !== 'read' &&
          !threadReadEmittedMessagesRef.current.has(message.id)
      )
      .map((message) => message.id);
    if (!unreadIds.length) return;

    unreadIds.forEach((id) => threadReadEmittedMessagesRef.current.add(id));

    emitMessageRead(unreadIds, {
      container_type: 'conversation',
      container_id: selectedContainer.container_id,
      conversation_id: selectedContainer.container_id,
      thread_root_id: selectedThreadRootId,
      message_ids: unreadIds,
      status: 'read',
      scope: 'thread',
    });

    highlightReadMessages(unreadIds);
  };

  return {
    highlightedMessageIds,
    handleVisibleMainMessageIds,
    handleVisibleThreadMessageIds,
  };
}
