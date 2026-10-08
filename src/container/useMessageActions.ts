import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { messagesApi } from '@/api/endpoints';
import type {
  MessageContainerType,
  MessageDoc,
  MessageReactionGroup,
  MessageReactionsUpdate,
} from '@/api/types';
import { applyMessageDeletedEventToCaches } from '@/socket/socket';
import {
  applyReactionUpdate,
  applyReactionUpdateToFeeds,
  findCachedFeedPost,
  toggleLocalReactionGroups,
  updateConversationPreview,
  updateMessageEverywhere,
} from './messageCache';
import type { ContainerDescriptor } from './types';

/** What the optimistic toggle needs: where the message lives and how it stands. */
interface CachedReactionState {
  container_type: MessageContainerType;
  container_id: string;
  conversation_id: string;
  reactions: MessageReactionGroup[];
}

/**
 * Locate a message in any cache that renders it. The message caches answer for
 * the chat lens; the feed projections answer for a post the viewer has only ever
 * seen in a feed, which the message caches have never held.
 */
const findCachedMessage = (
  queryClient: QueryClient,
  messageId: string
): CachedReactionState | null => {
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

    return {
      container_type: found.container_type,
      container_id: found.container_id,
      conversation_id: found.conversation_id,
      reactions: found.reactions ?? [],
    };
  }

  const post = findCachedFeedPost(queryClient, messageId);
  if (!post) return null;

  // A feed post names its channel rather than a container, and a post is always
  // a channel message.
  return {
    container_type: 'channel',
    container_id: post.channel_id,
    conversation_id: post.channel_id,
    reactions: post.reactions ?? [],
  };
};

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

      // Find the message wherever it is cached, so the optimistic update works
      // from a feed card as readily as from a chat row.
      const current = findCachedMessage(queryClient, messageId);
      if (!current) return;

      const updatedAt = new Date().toISOString();
      const payload: MessageReactionsUpdate = {
        message_id: messageId,
        container_type: current.container_type,
        container_id: current.container_id,
        conversation_id: current.conversation_id,
        reactions: toggleLocalReactionGroups(
          current.reactions,
          emoji,
          currentUserId,
          updatedAt
        ),
        updated_at: updatedAt,
      };
      applyReactionUpdate(queryClient, payload);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
      void queryClient.invalidateQueries({ queryKey: ['threadMessages'] });
      void queryClient.invalidateQueries({ queryKey: ['feeds'] });
      void queryClient.invalidateQueries({ queryKey: ['channel-feed'] });
      void queryClient.invalidateQueries({ queryKey: ['post-comments'] });
    },
    onSuccess: (updated) => {
      updateMessageEverywhere(queryClient, updated.id, () => updated);
      applyReactionUpdateToFeeds(queryClient, updated.id, updated.reactions);
      // The post detail route holds its post as a single document under this
      // key, which the paginated writers skip.
      queryClient.setQueryData<MessageDoc>(['messages', updated.id], (old) =>
        old ? updated : old
      );
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
