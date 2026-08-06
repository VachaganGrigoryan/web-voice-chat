import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '@/api/endpoints';
import {
  clearConversationMessages,
  clearConversationRow,
  removeConversationRow,
} from '@/container';

/**
 * Clearing and deleting a conversation.
 *
 * Conversation-only by nature — there is no channel equivalent — and separate
 * from the container adapter because these operate on the inbox row rather than
 * on the open container's timeline. The cache edits themselves are the tested
 * pure writers.
 */
export function useConversationLifecycle() {
  const queryClient = useQueryClient();

  const clear = useMutation({
    mutationFn: (conversationId: string) =>
      messagesApi.clearConversation(conversationId),
    onSuccess: (result, conversationId) => {
      clearConversationMessages(queryClient, conversationId, result.conversation_id);
      clearConversationRow(queryClient, conversationId, result.conversation_id);
    },
  });

  const remove = useMutation({
    mutationFn: (conversationId: string) =>
      messagesApi.deleteConversation(conversationId),
    onSuccess: (result, conversationId) => {
      clearConversationMessages(queryClient, conversationId, result.conversation_id);
      removeConversationRow(queryClient, conversationId, result.conversation_id);
      // A deleted DM can revive a pending connection request, which lives in a
      // different cache group.
      void queryClient.invalidateQueries({ queryKey: ['pings', 'incoming'] });
      void queryClient.invalidateQueries({ queryKey: ['pings', 'outgoing'] });
    },
  });

  return {
    clearConversation: clear.mutateAsync,
    deleteConversation: remove.mutateAsync,
    isClearingConversation: clear.isPending,
    isDeletingConversation: remove.isPending,
  };
}
