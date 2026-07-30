import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '@/api/endpoints';
import type { MessageDoc, MessageReactionsUpdate } from '@/api/types';
import { applyMessageDeletedEventToCaches } from '@/socket/socket';
import {
  applyReactionUpdate,
  toggleLocalReactionGroups,
  updateConversationPreview,
  updateMessageEverywhere,
} from './messageCache';
import type { ContainerDescriptor } from './types';

/**
 * Per-message operations.
 *
 * These routes are already flat and container-agnostic server-side, so the
 * descriptor is used for two things only: gating the affordance, and targeting
 * the right caches. It is not used to pick a URL.
 *
 * Every mutation here can still be refused. A capability check is an affordance
 * hint, not an authority — the server decides, and a 403 invalidates the cached
 * hint through the interceptor.
 */
export function useMessageActions(
  descriptor: ContainerDescriptor | null,
  currentUserId: string | null
) {
  const queryClient = useQueryClient();

  const editMessage = useMutation({
    mutationFn: ({ messageId, text }: { messageId: string; text: string }) =>
      messagesApi.editMessage(messageId, text),
    onSuccess: (updated) => {
      updateMessageEverywhere(queryClient, updated.id, () => updated);
      updateConversationPreview(queryClient, updated);
    },
  });

  const deleteMessage = useMutation({
    mutationFn: ({ messageId }: { messageId: string }) =>
      messagesApi.deleteMessage(messageId),
    onSuccess: (deleted) => {
      applyMessageDeletedEventToCaches(
        queryClient,
        { ...deleted, updated_at: new Date().toISOString() },
        currentUserId
      );
    },
  });

  const toggleReaction = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      messagesApi.toggleReaction(messageId, emoji),
    onMutate: ({ messageId, emoji }) => {
      if (!currentUserId) return;

      const updatedAt = new Date().toISOString();
      // Find the message wherever it is cached, so the optimistic update works
      // from a feed card as readily as from a chat row.
      const groups = [
        ...queryClient.getQueriesData<{ pages?: Array<{ data?: MessageDoc[] }> }>({
          queryKey: ['messages'],
        }),
        ...queryClient.getQueriesData<{ pages?: Array<{ data?: MessageDoc[] }> }>({
          queryKey: ['threadMessages'],
        }),
      ];

      for (const [, data] of groups) {
        const found = data?.pages
          ?.flatMap((page) => page.data ?? [])
          ?.find((message) => message.id === messageId);
        if (!found) continue;

        const payload: MessageReactionsUpdate = {
          message_id: messageId,
          container_type: found.container_type,
          container_id: found.container_id,
          conversation_id: found.conversation_id,
          reactions: toggleLocalReactionGroups(
            found.reactions ?? [],
            emoji,
            currentUserId,
            updatedAt
          ),
          updated_at: updatedAt,
        };
        applyReactionUpdate(queryClient, payload);
        return;
      }
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
      void queryClient.invalidateQueries({ queryKey: ['threadMessages'] });
    },
    onSuccess: (updated) => {
      updateMessageEverywhere(queryClient, updated.id, () => updated);
      updateConversationPreview(queryClient, updated);
    },
  });

  return {
    editMessage: editMessage.mutateAsync,
    deleteMessage: deleteMessage.mutateAsync,
    toggleReaction: toggleReaction.mutateAsync,
    isEditing: editMessage.isPending,
    isDeleting: deleteMessage.isPending,
    isTogglingReaction: toggleReaction.isPending,
    /** Mirrors the descriptor so callers gate on one source. */
    can: {
      edit: descriptor?.capabilities.canEditOwn ?? false,
      deleteOwn: descriptor?.capabilities.canDeleteOwn ?? false,
      react: descriptor?.capabilities.canReact ?? false,
      pin: descriptor?.capabilities.canPin ?? false,
      forward: descriptor?.capabilities.canForward ?? false,
    },
  };
}
