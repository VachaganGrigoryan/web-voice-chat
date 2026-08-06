import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { membershipsApi, rolesApi, spacesApi } from '@/api/endpoints';
import type { SpaceChannelCreateRequest, SpaceGroupCreateRequest } from '@/api/types';
import { toast } from 'sonner';
import { extractApiError } from '@/api/errors';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';

export function useSpaces(spaceId?: string) {
  const queryClient = useQueryClient();
  const { socket } = useSocketStore();

  useEffect(() => {
    if (!socket) return;

    const reconcileMemberships = () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    };
    socket.on(EVENTS.RELATIONSHIP_REQUESTED, reconcileMemberships);
    socket.on(EVENTS.RELATIONSHIP_ACTIVATED, reconcileMemberships);
    socket.on(EVENTS.RELATIONSHIP_REVOKED, reconcileMemberships);
    return () => {
      socket.off(EVENTS.RELATIONSHIP_REQUESTED, reconcileMemberships);
      socket.off(EVENTS.RELATIONSHIP_ACTIVATED, reconcileMemberships);
      socket.off(EVENTS.RELATIONSHIP_REVOKED, reconcileMemberships);
    };
  }, [queryClient, socket]);

  // Queries
  const spacesQuery = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });

  const detailQuery = useQuery({
    queryKey: ['spaces', 'detail', spaceId],
    queryFn: () => spacesApi.get(spaceId!),
    enabled: !!spaceId,
  });

  const membersQuery = useQuery({
    queryKey: ['spaces', spaceId, 'members'],
    queryFn: () => spacesApi.listMembers(spaceId!),
    enabled: !!spaceId,
  });

  const rolesQuery = useQuery({
    queryKey: ['spaces', spaceId, 'roles'],
    queryFn: () => rolesApi.list('space', spaceId!),
    enabled: !!spaceId,
  });

  const channelsQuery = useQuery({
    queryKey: ['spaces', spaceId, 'channels'],
    queryFn: () => spacesApi.listChannels(spaceId!),
    enabled: !!spaceId,
  });

  const groupsQuery = useQuery({
    queryKey: ['spaces', spaceId, 'groups'],
    queryFn: () => spacesApi.listGroups(spaceId!),
    enabled: !!spaceId,
  });

  const invitesQuery = useQuery({
    queryKey: ['spaces', spaceId, 'invites'],
    queryFn: () => spacesApi.listInvites(spaceId!),
    enabled: !!spaceId,
  });

  const joinRequestsQuery = useQuery({
    queryKey: ['spaces', spaceId, 'requests'],
    queryFn: () => spacesApi.listJoinRequests(spaceId!),
    enabled: !!spaceId,
  });

  // Mutations
  const createSpaceMutation = useMutation({
    mutationFn: spacesApi.create,
    onSuccess: (space) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success(`Space "${space.name}" created`);
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to create space'));
    },
  });

  const updateSpaceMutation = useMutation({
    mutationFn: ({ spaceId, data }: { spaceId: string; data: { name?: string; visibility?: string; settings?: Record<string, any> } }) =>
      spacesApi.update(spaceId, data),
    onSuccess: (space) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'detail', space.id] });
      toast.success('Space updated');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to update space'));
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: ({ spaceId, data }: { spaceId: string; data: { expires_at?: string | null; max_uses?: number | null; approval_required?: boolean } }) =>
      spacesApi.createInvite(spaceId, data),
    onSuccess: () => {
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'invites'] });
      }
      toast.success('Invite link created');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to create invite link'));
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: ({ spaceId, userId }: { spaceId: string; userId: string }) =>
      spacesApi.inviteUser(spaceId, userId),
    onSuccess: () => {
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'invites'] });
      }
      toast.success('User invited directly');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to invite user'));
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: ({ spaceId, inviteId }: { spaceId: string; inviteId: string }) =>
      spacesApi.revokeInvite(spaceId, inviteId),
    onSuccess: () => {
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'invites'] });
      }
      toast.success('Invite link revoked');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to revoke invite link'));
    },
  });

  const redeemInviteMutation = useMutation({
    mutationFn: (code: string) => spacesApi.redeemInvite(code),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      if (res.status === 'joined') {
        toast.success('Successfully joined the space');
      } else {
        toast.info('Join request submitted and pending approval');
      }
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to redeem invite code'));
    },
  });

  const joinSpaceMutation = useMutation({
    mutationFn: (spaceId: string) => spacesApi.join(spaceId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      if (res.status === 'approved') {
        toast.success('Successfully joined the space');
      } else {
        toast.info('Join request submitted and pending approval');
      }
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to join space'));
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: ({ spaceId, requestId }: { spaceId: string; requestId: string }) =>
      spacesApi.approveJoinRequest(spaceId, requestId),
    onSuccess: () => {
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'requests'] });
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'members'] });
      }
      toast.success('Join request approved');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to approve join request'));
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: ({ spaceId, requestId }: { spaceId: string; requestId: string }) =>
      spacesApi.rejectJoinRequest(spaceId, requestId),
    onSuccess: () => {
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'requests'] });
      }
      toast.success('Join request rejected');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to reject join request'));
    },
  });

  const joinChannelMutation = useMutation({
    mutationFn: ({ spaceId, channelId }: { spaceId: string; channelId: string }) =>
      spacesApi.joinChannel(spaceId, channelId),
    onSuccess: () => {
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'channels'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
      toast.success('Joined channel');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to join channel'));
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: ({
      spaceId,
      data,
    }: {
      spaceId: string;
      data: SpaceChannelCreateRequest;
    }) => spacesApi.createChannel(spaceId, data),
    onSuccess: () => {
      if (spaceId) {
        // The create response is a full Channel, not a SpaceChannelView, so
        // refetch the list rather than appending a differently-shaped object.
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'channels'] });
      }
      toast.success('Channel created');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to create channel'));
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: ({
      spaceId,
      data,
    }: {
      spaceId: string;
      data: SpaceGroupCreateRequest;
    }) => spacesApi.createGroup(spaceId, data),
    onSuccess: () => {
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'groups'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
      toast.success('Group created');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to create group'));
    },
  });

  const invalidateRoles = () => {
    if (spaceId) {
      queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'roles'] });
    }
  };

  const createRoleMutation = useMutation({
    mutationFn: ({
      spaceId,
      data,
    }: {
      spaceId: string;
      data: { name: string; permissions: string[]; priority?: number };
    }) => rolesApi.create('space', spaceId, data),
    onSuccess: () => {
      invalidateRoles();
      toast.success('Role created');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to create role'));
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      spaceId,
      roleId,
      data,
    }: {
      spaceId: string;
      roleId: string;
      data: { name?: string; permissions?: string[]; priority?: number };
    }) => rolesApi.update('space', spaceId, roleId, data),
    onSuccess: () => {
      invalidateRoles();
      toast.success('Role updated');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to update role'));
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: ({ spaceId, roleId }: { spaceId: string; roleId: string }) =>
      rolesApi.remove('space', spaceId, roleId),
    onSuccess: () => {
      invalidateRoles();
      // A deleted role may have been assigned to members.
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'members'] });
      }
      toast.success('Role deleted');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to delete role'));
    },
  });

  const assignMemberRolesMutation = useMutation({
    mutationFn: ({
      relationshipId,
      roleIds,
    }: {
      relationshipId: string;
      roleIds: string[];
    }) => membershipsApi.assignRoles(relationshipId, roleIds),
    onSuccess: () => {
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'members'] });
      }
      toast.success('Member role updated');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to update member role'));
    },
  });

  return {
    // Data
    spaces: spacesQuery.data || [],
    isLoadingSpaces: spacesQuery.isLoading,
    space: detailQuery.data || null,
    isLoadingSpace: detailQuery.isLoading,
    members: membersQuery.data || [],
    isLoadingMembers: membersQuery.isLoading,
    roles: rolesQuery.data || [],
    channels: channelsQuery.data || [],
    isLoadingChannels: channelsQuery.isLoading,
    groups: groupsQuery.data || [],
    isLoadingGroups: groupsQuery.isLoading,
    invites: invitesQuery.data || [],
    isLoadingInvites: invitesQuery.isLoading,
    joinRequests: joinRequestsQuery.data || [],
    isLoadingJoinRequests: joinRequestsQuery.isLoading,

    // Mutations
    createSpace: createSpaceMutation.mutateAsync,
    isCreatingSpace: createSpaceMutation.isPending,
    updateSpace: updateSpaceMutation.mutateAsync,
    isUpdatingSpace: updateSpaceMutation.isPending,
    createInvite: createInviteMutation.mutateAsync,
    isCreatingInvite: createInviteMutation.isPending,
    inviteUser: inviteUserMutation.mutateAsync,
    isInvitingUser: inviteUserMutation.isPending,
    revokeInvite: revokeInviteMutation.mutateAsync,
    isRevokingInvite: revokeInviteMutation.isPending,
    redeemInvite: redeemInviteMutation.mutateAsync,
    isRedeemingInvite: redeemInviteMutation.isPending,
    joinSpace: joinSpaceMutation.mutateAsync,
    isJoiningSpace: joinSpaceMutation.isPending,
    approveRequest: approveRequestMutation.mutateAsync,
    isApprovingRequest: approveRequestMutation.isPending,
    rejectRequest: rejectRequestMutation.mutateAsync,
    isRejectingRequest: rejectRequestMutation.isPending,
    joinChannel: joinChannelMutation.mutateAsync,
    isJoiningChannel: joinChannelMutation.isPending,
    createChannel: createChannelMutation.mutateAsync,
    isCreatingChannel: createChannelMutation.isPending,
    createGroup: createGroupMutation.mutateAsync,
    isCreatingGroup: createGroupMutation.isPending,
    createRole: createRoleMutation.mutateAsync,
    isCreatingRole: createRoleMutation.isPending,
    updateRole: updateRoleMutation.mutateAsync,
    isUpdatingRole: updateRoleMutation.isPending,
    deleteRole: deleteRoleMutation.mutateAsync,
    isDeletingRole: deleteRoleMutation.isPending,
    assignMemberRoles: assignMemberRolesMutation.mutateAsync,
    isAssigningMemberRoles: assignMemberRolesMutation.isPending,
  };
}
