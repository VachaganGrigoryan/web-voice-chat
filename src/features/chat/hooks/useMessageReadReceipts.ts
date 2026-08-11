import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { applyMessageStatusUpdateToCaches, MessageStatusPayload } from '@/socket/socket';
import type { ContainerDescriptor } from '@/container';
import { ChatMessage } from '../types/message';

/**
 * Per-message delivery/read receipts. Conversation-only: channels have no
 * per-recipient receipt concept, only a container-level unread count, which
 * is handled generically by `useMarkContainerRead` instead.
 *
 * That "conversation-only" is not asserted here — it is the descriptor's
 * `conversationOnly` group being absent for a channel, so the emit is
 * unreachable rather than guarded.
 */
export function useMessageReadReceipts({
  userId,
  descriptor,
  selectedThreadRootId,
  mainChatMessages,
  threadReplyMessages,
}: {
  userId?: string | null;
  descriptor: ContainerDescriptor | null;
  selectedThreadRootId: string | null;
  mainChatMessages: ChatMessage[];
  threadReplyMessages: ChatMessage[];
}) {
  const queryClient = useQueryClient();
  const [highlightedMessageIds, setHighlightedMessageIds] = useState<Set<string>>(new Set());
  const mainReadEmittedMessagesRef = useRef<Set<string>>(new Set());
  const threadReadEmittedMessagesRef = useRef<Set<string>>(new Set());

  const receipts = descriptor?.conversationOnly?.receipts ?? null;
  const containerId = descriptor?.ref.container_id ?? null;

  useEffect(() => {
    mainReadEmittedMessagesRef.current.clear();
    threadReadEmittedMessagesRef.current.clear();
    setHighlightedMessageIds(new Set());
  }, [containerId]);

  useEffect(() => {
    threadReadEmittedMessagesRef.current.clear();
  }, [selectedThreadRootId]);

  const emitMessageRead = (
    messageIds: string[],
    payload: Omit<MessageStatusPayload, 'container_type' | 'container_id'>
  ) => {
    if (!messageIds.length || !receipts || !descriptor) return;

    receipts.markRead(messageIds, { threadRootId: payload.thread_root_id ?? null });

    applyMessageStatusUpdateToCaches(queryClient, {
      ...payload,
      // The container says what it is; the caches match on it, so a literal
      // here would silently miss every message it was meant to update.
      container_type: descriptor.ref.container_type,
      container_id: descriptor.ref.container_id,
    } as MessageStatusPayload);
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
    if (!receipts || !visibleMessageIds.length) {
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
      conversation_id: unreadVisibleMessages[0]?.chatId,
      message_ids: visibleIds,
      status: 'read',
      scope: 'main',
    });

    highlightReadMessages(visibleIds);
  };

  const handleVisibleThreadMessageIds = (visibleMessageIds: string[]) => {
    if (!receipts || !selectedThreadRootId || !visibleMessageIds.length) {
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
      conversation_id: containerId ?? undefined,
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
