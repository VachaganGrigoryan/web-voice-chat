import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/api/endpoints';

/**
 * Mutations for the generalized conversation model (channels, invites, join
 * requests, and per-participant inbox organization). Each write invalidates the
 * `['conversations']` inbox query so the sidebar reflects the new state.
 */
export const useConversationActions = () => {
  const queryClient = useQueryClient();
  const invalidateInbox = () =>
    queryClient.invalidateQueries({ queryKey: ['conversations'] });

  const createChannel = useMutation({
    mutationFn: conversationsApi.createChannel,
    onSuccess: invalidateInbox,
  });

  const redeemInvite = useMutation({
    mutationFn: (code: string) => conversationsApi.redeemInvite(code),
    onSuccess: (result) => {
      if (result.status === 'joined') {
        void invalidateInbox();
      }
    },
  });

  const setInboxState = useMutation({
    mutationFn: ({
      conversationId,
      updates,
    }: {
      conversationId: string;
      updates: { pinned?: boolean; archived?: boolean; folder?: string | null };
    }) => conversationsApi.updateInboxState(conversationId, updates),
    onSuccess: invalidateInbox,
  });

  const approveJoinRequest = useMutation({
    mutationFn: ({ conversationId, requestId }: { conversationId: string; requestId: string }) =>
      conversationsApi.approveJoinRequest(conversationId, requestId),
  });

  const rejectJoinRequest = useMutation({
    mutationFn: ({ conversationId, requestId }: { conversationId: string; requestId: string }) =>
      conversationsApi.rejectJoinRequest(conversationId, requestId),
  });

  return {
    createChannel,
    redeemInvite,
    setInboxState,
    approveJoinRequest,
    rejectJoinRequest,
  };
};
