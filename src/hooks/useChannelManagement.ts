import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { channelsApi, membershipsApi, rolesApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { ROLE_ADMIN, ROLE_MODERATOR, type UpdateChannelRequest } from '@/api/types';
import { useAuthStore } from '@/store/authStore';

/**
 * The channel counterpart of useGroupManagement: membership, roles and settings
 * for one channel, plus the permission flags its UI gates on.
 */
export function useChannelManagement(channelId: string | null) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.userId);
  const enabled = Boolean(channelId);

  const channelQuery = useQuery({
    queryKey: ['channels', channelId],
    queryFn: () => channelsApi.get(channelId as string),
    enabled,
  });

  const membersQuery = useQuery({
    queryKey: ['channels', channelId, 'members'],
    queryFn: () => channelsApi.listMembers(channelId as string),
    enabled,
  });

  const rolesQuery = useQuery({
    queryKey: ['roles', 'channel', channelId],
    queryFn: () => rolesApi.list('channel', channelId as string),
    enabled,
  });

  const channel = channelQuery.data;
  const members = membersQuery.data ?? [];
  const roles = rolesQuery.data ?? [];

  const rolesById = new Map(roles.map((role) => [role.id, role.name]));
  const viewerMembership = members.find((member) => member.user_id === currentUserId);
  const viewerRoleNames = (viewerMembership?.role_ids ?? [])
    .map((roleId) => rolesById.get(roleId))
    .filter((name): name is string => !!name);

  // A user-owned channel is managed by its owner. A space-owned channel has no
  // user owner at all, so management must come from a role — the previous
  // `owner.type === 'user'` check hid every control on space-owned channels.
  const isOwner = Boolean(
    channel && currentUserId && channel.owner.type === 'user' && channel.owner.id === currentUserId
  );
  const isAdmin = viewerRoleNames.includes(ROLE_ADMIN);
  const isModerator = viewerRoleNames.includes(ROLE_MODERATOR);
  const canManage = isOwner || isAdmin;

  const invalidateChannel = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['channels', channelId] }),
      queryClient.invalidateQueries({ queryKey: ['channels', 'me'] }),
      queryClient.invalidateQueries({ queryKey: ['user-channels'] }),
    ]);

  const withError = (fallback: string) => (error: unknown) =>
    toast.error(extractApiError(error, fallback));

  const update = useMutation({
    mutationFn: (updates: UpdateChannelRequest) =>
      channelsApi.update(channelId as string, updates),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['channels', updated.id], updated);
      await invalidateChannel();
      toast.success('Channel updated');
    },
    onError: withError('Could not update this channel'),
  });

  const invite = useMutation({
    mutationFn: (userId: string) =>
      membershipsApi.invite('channel', channelId as string, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
      toast.success('Invitation sent');
    },
    onError: withError('Could not invite this person'),
  });

  const acceptMember = useMutation({
    mutationFn: (relationshipId: string) =>
      membershipsApi.accept('channel', channelId as string, relationshipId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
    },
    onError: withError('Could not approve this member'),
  });

  const declineMember = useMutation({
    mutationFn: (relationshipId: string) =>
      membershipsApi.decline('channel', channelId as string, relationshipId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
    },
    onError: withError('Could not decline this member'),
  });

  const assignRoles = useMutation({
    mutationFn: ({ relationshipId, roleIds }: { relationshipId: string; roleIds: string[] }) =>
      membershipsApi.assignRoles(relationshipId, roleIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
      toast.success('Roles updated');
    },
    onError: withError('Could not update roles'),
  });

  const leave = useMutation({
    mutationFn: () => channelsApi.leave(channelId as string),
    onSuccess: async () => {
      await invalidateChannel();
      toast.success('Left channel');
    },
    onError: withError('Could not leave this channel'),
  });

  return {
    channel,
    members,
    roles,
    pendingMembers: members.filter((member) => member.status === 'pending'),
    isLoading: channelQuery.isLoading || membersQuery.isLoading,
    isOwner,
    isAdmin,
    isModerator,
    canManage,
    update,
    invite,
    acceptMember,
    declineMember,
    assignRoles,
    leave,
  };
}
