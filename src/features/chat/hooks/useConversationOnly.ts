import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationsApi, messagesApi } from '@/api/endpoints';
import { inboxKeys } from '@/api/queryKeys';
import type { Conversation, MessageContainerRef, PresenceState } from '@/api/types';
import type { ConversationOnlyAffordances } from '@/container/types';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';

/**
 * The affordances only a conversation has.
 *
 * Returns `null` for a channel so the descriptor's `conversationOnly` is absent
 * rather than a bag of disabled flags — a channel cannot then accidentally
 * render a draft box or a typing indicator.
 *
 * Marking a container read is deliberately NOT here: channels have their own
 * read endpoint and unread count, so that lives on `descriptor.endpoints.markRead`.
 * What is genuinely conversation-shaped is the per-message receipt and the
 * acknowledgement that announces it to the other participants.
 *
 * The conversation is read from the same query key `useContainer` resolves its
 * source from, so this shares one cache entry with it rather than being handed
 * a second copy by a caller that would have to fetch it first — the descriptor
 * takes this group as an input, so it cannot be the one to supply it.
 */
export function useConversationOnly(
  ref: MessageContainerRef | null,
  /** From the caller's participant view — `draft_text` is not on `Conversation`. */
  draftText: string | null = null
): ConversationOnlyAffordances | null {
  const queryClient = useQueryClient();
  const socket = useSocketStore((state) => state.socket);

  const conversationId = ref?.container_type === 'conversation' ? ref.container_id : null;

  const { data: conversation = null } = useQuery<Conversation>({
    // The idle key names no real cache entry: pointing it at the conversations
    // list would read that list's shape as though it were one conversation.
    queryKey: conversationId
      ? inboxKeys.conversation(conversationId)
      : ['conversations', 'none'],
    queryFn: () => conversationsApi.getConversation(conversationId as string),
    enabled: !!conversationId,
  });

  const peerUserId = conversation?.peer_user?.id ?? null;

  // Narrow selections, not the whole maps: this object is a dependency of the
  // descriptor's memo, so anything that changes here re-resolves the container
  // for every consumer.
  const peerPresence = useSocketStore((state) =>
    peerUserId ? state.presenceByUserId?.[peerUserId]?.state ?? null : null
  );
  const typingHere = useSocketStore((state) =>
    conversationId ? state.typingUsers?.[conversationId] : undefined
  );

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

  const saveDraftAsync = saveDraft.mutateAsync;
  const clearDraftAsync = clearDraft.mutateAsync;
  const moveFolderAsync = moveFolder.mutateAsync;
  const togglePinAsync = togglePin.mutateAsync;

  return useMemo(() => {
    if (!conversationId) return null;

    return {
      typing: {
        start: () => socket?.emit('typing_start', { conversation_id: conversationId }),
        stop: () => socket?.emit('typing_stop', { conversation_id: conversationId }),
        typingUserIds: Object.keys(typingHere ?? {}),
      },
      receipts: {
        // Receipts are DM and small-group focused by design; a large group's
        // per-recipient state is a summary, not a list.
        enabled: conversation?.type === 'dm' || (conversation?.member_count ?? 0) <= 10,
        markDelivered: (messageId: string) => messagesApi.markDelivered(messageId),
        markRead: (messageIds, scope) => {
          for (const messageId of messageIds) {
            socket?.emit(EVENTS.MESSAGE_READ, {
              container_type: 'conversation',
              container_id: conversationId,
              conversation_id: conversationId,
              message_id: messageId,
              thread_root_id: scope?.threadRootId ?? null,
            });
          }
        },
        acknowledgeContainerRead: () =>
          socket?.emit(EVENTS.CONVERSATION_READ, { conversation_id: conversationId }),
      },
      drafts: {
        value: draftText,
        save: (text: string) => saveDraftAsync(text),
        clear: () => clearDraftAsync(),
      },
      folder: {
        current: conversation?.folder ?? null,
        move: (folder: string | null) => moveFolderAsync(folder),
      },
      pins: {
        ids: conversation?.pinned_message_ids ?? [],
        toggle: (messageId: string) => togglePinAsync(messageId),
      },
      forward: (messageId: string, targetConversationId: string) =>
        messagesApi.forwardMessage(messageId, targetConversationId),
      presence: {
        peerUserId,
        state: peerPresence as PresenceState | null,
      },
    };
    // Every dependency here is a primitive or a stable function: this object is
    // what `useContainer` memoises the descriptor on, so an unstable one would
    // re-resolve the container on every render.
  }, [
    conversationId,
    conversation,
    draftText,
    socket,
    typingHere,
    peerUserId,
    peerPresence,
    saveDraftAsync,
    clearDraftAsync,
    moveFolderAsync,
    togglePinAsync,
  ]);
}
