import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { conversationsApi, notificationsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type { NotificationLevel } from '@/api/types';

/**
 * Mutations for the generalized conversation model (channels, invites, join
 * requests, and per-participant inbox organization). Each write invalidates the
 * `['conversations']` inbox query so the sidebar reflects the new state.
 */
export const useConversationActions = () => {
  const queryClient = useQueryClient();
  const invalidateInbox = async () => {
    // Prefix-match covers ['conversations'], ['conversations','archived'] and
    // ['conversations','folders']; the singular ['conversation', id] key used to
    // resolve archived/off-page conversations needs a separate pass.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['conversations'] }),
      queryClient.invalidateQueries({ queryKey: ['conversation'] }),
    ]);
  };

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

  const setInboxStateBulk = useMutation({
    mutationFn: ({
      conversationIds,
      updates,
    }: {
      conversationIds: string[];
      updates: { pinned?: boolean; archived?: boolean; folder?: string | null };
    }) => conversationsApi.updateInboxStateBulk(conversationIds, updates),
    onSuccess: invalidateInbox,
  });

  const renameFolder = useMutation({
    mutationFn: ({ name, newName }: { name: string; newName: string }) =>
      conversationsApi.renameFolder(name, newName),
    onSuccess: invalidateInbox,
  });

  const deleteFolder = useMutation({
    mutationFn: (name: string) => conversationsApi.deleteFolder(name),
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

  /**
   * The conversation twin of `useChannelInbox.setNotifications`. It lives here
   * rather than in the settings adapter because the inbox row menu needs to
   * change a notification level per row, and a channel could already do that
   * while a conversation could not.
   */
  const setNotifications = useMutation({
    mutationFn: ({
      conversationId,
      level,
      mutedUntil,
    }: {
      conversationId: string;
      level?: NotificationLevel;
      mutedUntil?: string | null;
    }) =>
      notificationsApi.updateConversationSettings(conversationId, {
        notification_level: level,
        muted_until: mutedUntil,
      }),
    onSuccess: invalidateInbox,
    onError: (error) => toast.error(extractApiError(error, 'Could not update notifications')),
  });

  /**
   * Takes the id as an argument, unlike `useGroupManagement.leaveGroup` which
   * closes over one conversation — a list cannot call that without one hook
   * instance per row.
   */
  const leaveGroup = useMutation({
    mutationFn: (conversationId: string) => conversationsApi.leaveGroup(conversationId),
    onSuccess: invalidateInbox,
    onError: (error) => toast.error(extractApiError(error, 'Could not leave this group')),
  });

  return {
    redeemInvite,
    setInboxState,
    setInboxStateBulk,
    setNotifications,
    leaveGroup,
    renameFolder,
    deleteFolder,
    approveJoinRequest,
    rejectJoinRequest,
  };
};
