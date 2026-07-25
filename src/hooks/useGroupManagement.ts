import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { conversationsApi } from '@/api/endpoints';
import { Conversation, ParticipantRole, ParticipantView, ROLE_ADMIN } from '@/api/types';
import { useAuthStore } from '@/store/authStore';

const membersKey = (conversationId: string) => ['members', conversationId] as const;

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { error?: { message?: string } } } })
      .response;
    const message = response?.data?.error?.message;
    if (message) return message;
  }
  return fallback;
}

export const useGroupMembers = (conversationId: string | null, enabled = true) =>
  useQuery({
    queryKey: membersKey(conversationId ?? ''),
    queryFn: () => conversationsApi.listMembers(conversationId as string),
    enabled: !!conversationId && enabled,
  });

/**
 * Group-management mutations + the caller's own role, derived from the members
 * list. All destructive/write actions surface a toast on failure so a backend
 * 403 (member attempting an owner/admin action) is shown, not swallowed.
 */
export const useGroupManagement = (
  conversationId: string | null,
  conversation?: Pick<Conversation, 'owner_type' | 'owner_id'> | null
) => {
  const queryClient = useQueryClient();
  const { userId: currentUserId } = useAuthStore();

  const membersQuery = useGroupMembers(conversationId);
  const members = useMemo<ParticipantView[]>(
    () => membersQuery.data ?? [],
    [membersQuery.data]
  );

  const currentUserRole = useMemo<ParticipantRole | null>(() => {
    if (!currentUserId) return null;
    return members.find((member) => member.user_id === currentUserId)?.role ?? null;
  }, [members, currentUserId]);

  // Ownership is read off the conversation, not off a role (§51).
  const isOwner = !!(
    currentUserId &&
    conversation?.owner_type === 'user' &&
    conversation.owner_id === currentUserId
  );
  const isAdmin = currentUserRole === ROLE_ADMIN;
  const canManage = isOwner || isAdmin;

  const invalidateMembers = () => {
    if (conversationId) {
      queryClient.invalidateQueries({ queryKey: membersKey(conversationId) });
    }
  };

  const invalidateConversations = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  const rename = useMutation({
    mutationFn: (title: string) =>
      conversationsApi.updateGroup(conversationId as string, { title }),
    onSuccess: invalidateConversations,
    onError: (error) => toast.error(errorMessage(error, 'Failed to rename group')),
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return conversationsApi.uploadGroupAvatar(conversationId as string, formData);
    },
    onSuccess: invalidateConversations,
    onError: (error) => toast.error(errorMessage(error, 'Failed to update group image')),
  });

  const removeAvatar = useMutation({
    mutationFn: () => conversationsApi.deleteGroupAvatar(conversationId as string),
    onSuccess: invalidateConversations,
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove group image')),
  });

  const addMembers = useMutation({
    mutationFn: (participantIds: string[]) =>
      conversationsApi.addMembers(conversationId as string, participantIds),
    onSuccess: () => {
      invalidateMembers();
      invalidateConversations();
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to add members')),
  });

  const removeMember = useMutation({
    mutationFn: (memberUserId: string) =>
      conversationsApi.removeMember(conversationId as string, memberUserId),
    onSuccess: () => {
      invalidateMembers();
      invalidateConversations();
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove member')),
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ memberUserId, role }: { memberUserId: string; role: ParticipantRole }) =>
      conversationsApi.updateMemberRole(conversationId as string, memberUserId, role),
    onSuccess: invalidateMembers,
    onError: (error) => toast.error(errorMessage(error, 'Failed to update role')),
  });

  const transferOwnership = useMutation({
    mutationFn: (memberUserId: string) =>
      conversationsApi.transferOwnership(conversationId as string, memberUserId),
    onSuccess: invalidateMembers,
    onError: (error) => toast.error(errorMessage(error, 'Failed to transfer ownership')),
  });

  const leaveGroup = useMutation({
    mutationFn: () => conversationsApi.leaveGroup(conversationId as string),
    onSuccess: invalidateConversations,
    onError: (error) => toast.error(errorMessage(error, 'Failed to leave group')),
  });

  const deleteGroup = useMutation({
    mutationFn: () => conversationsApi.deleteGroup(conversationId as string),
    onSuccess: invalidateConversations,
    onError: (error) => toast.error(errorMessage(error, 'Failed to delete group')),
  });

  const clearForEveryone = useMutation({
    mutationFn: () => conversationsApi.clearGroupForEveryone(conversationId as string),
    onSuccess: invalidateConversations,
    onError: (error) => toast.error(errorMessage(error, 'Failed to clear history')),
  });

  return {
    membersQuery,
    members,
    currentUserRole,
    isOwner,
    isAdmin,
    canManage,
    rename,
    uploadAvatar,
    removeAvatar,
    addMembers,
    removeMember,
    updateMemberRole,
    transferOwnership,
    leaveGroup,
    deleteGroup,
    clearForEveryone,
  };
};
