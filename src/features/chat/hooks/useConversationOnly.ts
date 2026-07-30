import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi, messagesApi } from '@/api/endpoints';
import { inboxKeys } from '@/api/queryKeys';
import type { Conversation, MessageContainerRef, PresenceState } from '@/api/types';
import type { ConversationOnlyAffordances } from '@/container/types';
import { useSocketStore } from '@/socket/socket';

/**
 * The affordances only a conversation has.
 *
 * Returns `null` for a channel so the descriptor's `conversationOnly` is absent
 * rather than a bag of disabled flags — a channel cannot then accidentally
 * render a draft box or a typing indicator.
 *
 * Marking read is deliberately NOT here: channels have their own read endpoint
 * and unread count, so that lives on `descriptor.endpoints.markRead`. What is
 * genuinely conversation-shaped is the per-message delivery receipt.
 */
export function useConversationOnly(
  ref: MessageContainerRef | null,
  conversation: Conversation | null,
  /** From the caller's participant view — `draft_text` is not on `Conversation`. */
  draftText: string | null = null
): ConversationOnlyAffordances | null {
  const queryClient = useQueryClient();
  const socket = useSocketStore((state) => state.socket);
  const presenceByUserId = useSocketStore((state) => state.presenceByUserId);
  const typingUsers = useSocketStore((state) => state.typingUsers);

  const conversationId = ref?.container_type === 'conversation' ? ref.container_id : null;

  const saveDraft = useMutation({
    mutationFn: (text: string) =>
      conversationsApi.setDraft(conversationId as string, text),
  });
  const clearDraft = useMutation({
    mutationFn: () => conversationsApi.clearDraft(conversationId as string),
  });
  const moveFolder = useMutation({
    mutationFn: (folder: string | null) =>
      conversationsApi.updateInboxState(conversationId as string, { folder }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inboxKeys.conversations });
      void queryClient.invalidateQueries({ queryKey: inboxKeys.folders });
    },
  });
  const togglePin = useMutation({
    mutationFn: (messageId: string) => messagesApi.pinMessage(messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inboxKeys.conversations });
    },
  });

  return useMemo(() => {
    if (!conversationId) return null;

    const peerUserId = conversation?.peer_user?.id ?? null;

    return {
      typing: {
        start: () => socket?.emit('typing_start', { conversation_id: conversationId }),
        stop: () => socket?.emit('typing_stop', { conversation_id: conversationId }),
        typingUserIds: Object.keys(typingUsers?.[conversationId] ?? {}),
      },
      receipts: {
        // Receipts are DM and small-group focused by design; a large group's
        // per-recipient state is a summary, not a list.
        enabled: conversation?.type === 'dm' || (conversation?.member_count ?? 0) <= 10,
        markDelivered: (messageId: string) => messagesApi.markDelivered(messageId),
      },
      drafts: {
        value: draftText,
        save: (text: string) => saveDraft.mutateAsync(text),
        clear: () => clearDraft.mutateAsync(),
      },
      folder: {
        current: conversation?.folder ?? null,
        move: (folder: string | null) => moveFolder.mutateAsync(folder),
      },
      pins: {
        ids: conversation?.pinned_message_ids ?? [],
        toggle: (messageId: string) => togglePin.mutateAsync(messageId),
      },
      forward: (messageId: string, targetConversationId: string) =>
        messagesApi.forwardMessage(messageId, targetConversationId),
      presence: {
        peerUserId,
        state: (peerUserId
          ? presenceByUserId?.[peerUserId]?.state ?? null
          : null) as PresenceState | null,
      },
    };
  }, [
    conversationId,
    conversation,
    draftText,
    socket,
    typingUsers,
    presenceByUserId,
    saveDraft,
    clearDraft,
    moveFolder,
    togglePin,
  ]);
}
