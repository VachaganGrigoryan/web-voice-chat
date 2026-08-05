import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { channelsApi, conversationsApi, membershipsApi, notificationsApi, rolesApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type {
  Channel,
  ChannelCommentPolicy,
  ChannelJoinPolicy,
  ChannelMemberView,
  ChannelPostingPolicy,
  ChannelVisibility,
  NotificationLevel,
  ParticipantView,
  Role,
} from '@/api/types';
import { useAuthStore } from '@/store/authStore';
import { useManageCapabilities } from '@/features/manage/useManageCapabilities';
import { useConnections } from '@/hooks/useConnections';
import { useConversationFolders } from '@/features/chat/hooks/useConversationFolders';
import { useConversationLifecycle } from '@/features/chat/hooks/useConversationLifecycle';
import type { ManageDangerAction } from '@/features/manage/sections/DangerSection';
import type { ManageMemberRow } from '@/features/manage/sections/MembersSection';
import type { RuleOption } from './primitives';
import type { AccessRule, SettingsSectionData } from './sectionData';
import type { SettingsSubject } from './types';

/**
 * Builds the section data for a message container — a DM, a group or a
 * channel. The only module that knows which endpoint a container kind speaks;
 * everything above it reads the normalized shape.
 *
 * A part is `null` where no endpoint exists rather than wired to something that
 * would 404: groups have no policy update route, and channels have no invite
 * link, join request or member removal route. The registry keeps those sections
 * off the nav, so the nulls are unreachable in normal use.
 */

const VISIBILITY_RULES: readonly RuleOption<string>[] = [
  { value: 'public', label: 'Anyone', meaning: 'Anyone can find this and read it, including people who are not members.' },
  { value: 'members', label: 'Members', meaning: 'Only members can read it, but people can find it and ask to join.' },
  { value: 'private', label: 'Invite only', meaning: 'Hidden. Only people you invite can find or read it.' },
];

const JOIN_RULES: readonly RuleOption<string>[] = [
  { value: 'open', label: 'Anyone', meaning: 'Anyone can join immediately without approval.' },
  { value: 'approval', label: 'On approval', meaning: 'People can ask to join and a manager decides.' },
  { value: 'invite_only', label: 'By invite', meaning: 'People can only join from an invite you send.' },
  { value: 'closed', label: 'Nobody', meaning: 'Nobody new can join, by invite or otherwise.' },
];

const POSTING_RULES: readonly RuleOption<string>[] = [
  { value: 'owner', label: 'Owner', meaning: 'Only the owner can post.' },
  { value: 'moderators', label: 'Moderators', meaning: 'The owner and moderators can post.' },
  { value: 'members', label: 'Members', meaning: 'Any member can post.' },
  { value: 'everyone', label: 'Anyone', meaning: 'Anyone who can read this can post, members or not.' },
];

const COMMENT_RULES: readonly RuleOption<string>[] = [
  { value: 'disabled', label: 'Nobody', meaning: 'Comments are turned off.' },
  { value: 'followers', label: 'Followers', meaning: 'Anyone following this can comment.' },
  { value: 'members', label: 'Members', meaning: 'Only members can comment.' },
  { value: 'everyone', label: 'Anyone', meaning: 'Anyone who can read this can comment.' },
];

const notify = (error: unknown, fallback: string) => toast.error(extractApiError(error, fallback));

export interface ContainerSettingsOptions {
  /** Called after a delete succeeds, so the surface can close and navigate. */
  readonly onDeleted?: () => void;
}

export function useContainerSettingsData(
  subject: SettingsSubject,
  options: ContainerSettingsOptions = {}
): SettingsSectionData {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.userId);
  const [savingRoleIds, setSavingRoleIds] = useState<ReadonlySet<string>>(new Set());
  const folders = useConversationFolders(true);
  const lifecycle = useConversationLifecycle();
  const { blockUser, isBlocking } = useConnections();
  // `resource.delete` is deliberately outside the default capability set, so
  // `descriptor.capabilities.canDeleteContainer` is absent-not-false for a
  // server-sourced descriptor — which hid this affordance from owners. This
  // hook asks for the action explicitly and shares the same cache entry.
  const manageCapabilities = useManageCapabilities(subject.resource);

  const { descriptor, kind, resource } = subject;
  const isChannel = kind === 'channel';
  const isGroup = kind === 'group';
  const isDm = kind === 'dm';
  const containerId = resource.id;

  const conversation =
    descriptor?.source.kind === 'conversation' ? descriptor.source.conversation : null;
  const channel = descriptor?.source.kind === 'channel' ? descriptor.source.channel : null;
  const channelState = descriptor?.source.kind === 'channel' ? descriptor.source.state : null;
  const canManage = descriptor?.capabilities.canManage ?? false;

  const invalidateContainer = () => {
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    void queryClient.invalidateQueries({ queryKey: ['channels'] });
    void queryClient.invalidateQueries({ queryKey: ['channel-inbox'] });
  };

  // --- overview -------------------------------------------------------------

  const renameGroup = useMutation({
    mutationFn: (title: string) => conversationsApi.updateGroup(containerId, { title }),
    onSuccess: invalidateContainer,
    onError: (error) => notify(error, 'Could not rename this group'),
  });

  const updateChannel = useMutation({
    mutationFn: (updates: Parameters<typeof channelsApi.update>[1]) =>
      channelsApi.update(containerId, updates),
    onSuccess: invalidateContainer,
    onError: (error) => notify(error, 'Could not save these settings'),
  });

  const overview = useMemo(() => {
    const facts: { label: string; value: string }[] = [];

    if (conversation) {
      facts.push({ label: 'Type', value: conversation.type === 'dm' ? 'Direct message' : 'Group' });
      facts.push({ label: 'Members', value: String(conversation.member_count) });
      facts.push({
        label: 'Encryption',
        value: conversation.encryption === 'e2ee' ? 'End-to-end encrypted' : 'Not end-to-end encrypted',
      });
      if (conversation.type === 'group') {
        facts.push({ label: 'Visibility', value: conversation.visibility === 'public' ? 'Public' : 'Private' });
      }
    }

    if (channel) {
      facts.push({ label: 'Type', value: 'Channel' });
      facts.push({ label: 'Followers', value: String(channel.follower_count) });
      facts.push({ label: 'Posts', value: String(channel.message_count) });
    }

    if (isGroup && canManage) {
      return {
        edit: {
          name: conversation?.title ?? '',
          description: null,
          supportsDescription: false,
          isSaving: renameGroup.isPending,
          onSave: ({ name }: { name: string }) => renameGroup.mutate(name),
        },
        facts,
      };
    }

    if (isChannel && canManage && channel) {
      return {
        edit: {
          name: channel.name,
          description: channel.description,
          supportsDescription: true,
          isSaving: updateChannel.isPending,
          onSave: ({ name, description }: { name: string; description: string | null }) =>
            updateChannel.mutate({ name, description }),
        },
        facts,
      };
    }

    return { edit: null, facts };
  }, [conversation, channel, isGroup, isChannel, canManage, renameGroup, updateChannel]);

  // --- notifications & inbox ------------------------------------------------

  // The two container kinds return different viewer-state shapes from the same
  // conceptual call; nothing here reads the result, so it is discarded.
  const setNotifications = useMutation({
    mutationFn: async (updates: {
      notification_level?: NotificationLevel;
      muted_until?: string | null;
    }): Promise<void> => {
      if (isChannel) await channelsApi.setNotifications(containerId, updates);
      else await notificationsApi.updateConversationSettings(containerId, updates);
    },
    onSuccess: invalidateContainer,
    onError: (error) => notify(error, 'Could not update notifications'),
  });

  const setInbox = useMutation({
    mutationFn: async (updates: {
      pinned?: boolean;
      archived?: boolean;
      folder?: string | null;
    }): Promise<void> => {
      if (isChannel) await channelsApi.setInboxState(containerId, updates);
      else await conversationsApi.updateInboxState(containerId, updates);
    },
    onSuccess: invalidateContainer,
    onError: (error) => notify(error, 'Could not update your inbox'),
  });

  const notifications = descriptor
    ? {
        level: (channelState?.notification_level ?? conversation?.notification_level ?? 'all') as NotificationLevel,
        onLevelChange: (level: NotificationLevel) =>
          setNotifications.mutate({ notification_level: level }),
        mutedUntil: channelState?.muted_until ?? conversation?.muted_until ?? null,
        onMutedUntilChange: (mutedUntil: string | null) =>
          setNotifications.mutate({ muted_until: mutedUntil }),
        pinned: channelState?.pinned ?? conversation?.pinned ?? false,
        onPinnedChange: (pinned: boolean) => setInbox.mutate({ pinned }),
        archived: channelState?.archived ?? conversation?.archived ?? false,
        onArchivedChange: (archived: boolean) => setInbox.mutate({ archived }),
        folder: channelState?.folder ?? conversation?.folder ?? null,
        folderOptions: folders.folderNames,
        onFolderChange: (folder: string | null) => setInbox.mutate({ folder }),
        isSaving: setNotifications.isPending || setInbox.isPending,
      }
    : null;

  // --- access ---------------------------------------------------------------

  const access = useMemo(() => {
    // Only channels have a policy update endpoint. A group's visibility and
    // posting policy are stored but not writable, so the section is omitted
    // rather than shown read-only.
    if (!isChannel || !channel) return null;

    const rules: AccessRule[] = [
      {
        id: 'visibility',
        question: 'Who can find and read this channel?',
        value: channel.visibility,
        options: VISIBILITY_RULES,
        onChange: (value) => updateChannel.mutate({ visibility: value as ChannelVisibility }),
      },
      {
        id: 'join_policy',
        question: 'Who can join?',
        value: channel.join_policy,
        options: JOIN_RULES,
        onChange: (value) => updateChannel.mutate({ join_policy: value as ChannelJoinPolicy }),
      },
      {
        id: 'posting_policy',
        question: 'Who can post?',
        value: channel.posting_policy,
        options: POSTING_RULES,
        onChange: (value) => updateChannel.mutate({ posting_policy: value as ChannelPostingPolicy }),
      },
      {
        id: 'comment_policy',
        question: 'Who can comment?',
        value: channel.comment_policy,
        options: COMMENT_RULES,
        onChange: (value) => updateChannel.mutate({ comment_policy: value as ChannelCommentPolicy }),
      },
    ];

    return { rules, isSaving: updateChannel.isPending };
  }, [isChannel, channel, updateChannel]);

  // --- members --------------------------------------------------------------

  const membersQuery = useQuery<readonly (ParticipantView | ChannelMemberView)[]>({
    queryKey: ['settings-members', resource.type, containerId],
    queryFn: () =>
      isChannel ? channelsApi.listMembers(containerId) : conversationsApi.listMembers(containerId),
    enabled: kind === 'group' || kind === 'channel',
  });

  const removeConversationMember = useMutation({
    mutationFn: (userId: string) => conversationsApi.removeMember(containerId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings-members'] });
      invalidateContainer();
    },
    onError: (error) => notify(error, 'Could not remove this member'),
  });

  const members = useMemo(() => {
    if (kind !== 'group' && kind !== 'channel') return null;

    const rows: ManageMemberRow[] = (membersQuery.data ?? []).map((member) => {
      if ('relationship_id' in member) {
        return {
          id: member.relationship_id,
          userId: member.user_id,
          roleLabel: member.role_ids.length ? `${member.role_ids.length} role(s)` : 'Member',
          isOwner: channel?.owner.type === 'user' && channel.owner.id === member.user_id,
          isSelf: member.user_id === currentUserId,
        };
      }
      return {
        id: member.user_id,
        userId: member.user_id,
        roleLabel: member.role ?? 'Member',
        isOwner: conversation?.owner_type === 'user' && conversation.owner_id === member.user_id,
        isSelf: member.user_id === currentUserId,
      };
    });

    return {
      members: rows,
      isLoading: membersQuery.isLoading,
      roleOptions: null,
      roleValueFor: null,
      onChangeRole: null,
      isUpdatingRole: false,
      // No channel member-removal route exists, so the affordance is absent there.
      onRemove: isGroup ? (member: ManageMemberRow) => removeConversationMember.mutate(member.userId) : null,
      isRemoving: removeConversationMember.isPending,
    };
  }, [kind, membersQuery.data, membersQuery.isLoading, channel, conversation, currentUserId, isGroup, removeConversationMember]);

  // --- roles ----------------------------------------------------------------

  const rolesQuery = useQuery({
    queryKey: ['settings-roles', resource.type, containerId],
    queryFn: () => rolesApi.list(resource.type, containerId),
    enabled: kind === 'group' || kind === 'channel',
  });

  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: ['settings-roles', resource.type, containerId] });

  const createRole = useMutation({
    mutationFn: (name: string) => rolesApi.create(resource.type, containerId, { name, permissions: [] }),
    onSuccess: () => void invalidateRoles(),
    onError: (error) => notify(error, 'Could not create this role'),
  });

  const deleteRole = useMutation({
    mutationFn: (roleId: string) => rolesApi.remove(resource.type, containerId, roleId),
    onSuccess: () => void invalidateRoles(),
    onError: (error) => notify(error, 'Could not delete this role'),
  });

  const setRolePermissions = useMutation({
    mutationFn: ({ role, permissions }: { role: Role; permissions: readonly string[] }) =>
      rolesApi.update(resource.type, containerId, role.id, { permissions: [...permissions] }),
    onMutate: ({ role }) => {
      setSavingRoleIds((current) => new Set(current).add(role.id));
    },
    onSuccess: () => void invalidateRoles(),
    onError: (error) => notify(error, 'Could not update this role'),
    onSettled: (_data, _error, { role }) => {
      setSavingRoleIds((current) => {
        const next = new Set(current);
        next.delete(role.id);
        return next;
      });
    },
  });

  const roles =
    kind === 'group' || kind === 'channel'
      ? {
          roles: rolesQuery.data ?? [],
          isLoading: rolesQuery.isLoading,
          onCreate: (name: string) => createRole.mutate(name),
          isCreating: createRole.isPending,
          onDelete: (roleId: string) => deleteRole.mutate(roleId),
          isDeleting: deleteRole.isPending,
          onSetPermissions: (role: Role, permissions: readonly string[]) =>
            setRolePermissions.mutate({ role, permissions }),
          savingRoleIds,
        }
      : null;

  // --- invites & join requests (groups only) --------------------------------

  const invitesQuery = useQuery({
    queryKey: ['settings-invites', containerId],
    queryFn: () => conversationsApi.listInvites(containerId),
    enabled: isGroup,
  });

  const requestsQuery = useQuery({
    queryKey: ['settings-requests', containerId],
    queryFn: () => conversationsApi.listJoinRequests(containerId),
    enabled: isGroup,
  });

  const inviteUser = useMutation({
    mutationFn: (userId: string) => membershipsApi.invite('conversation', containerId, userId),
    onSuccess: () => toast.success('Invite sent'),
    onError: (error) => notify(error, 'Could not invite this person'),
  });

  const createInvite = useMutation({
    mutationFn: () => conversationsApi.createInvite(containerId, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings-invites', containerId] }),
    onError: (error) => notify(error, 'Could not create an invite link'),
  });

  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => conversationsApi.revokeInvite(containerId, inviteId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings-invites', containerId] }),
    onError: (error) => notify(error, 'Could not revoke this invite'),
  });

  const decideRequest = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      approve
        ? conversationsApi.approveJoinRequest(containerId, requestId)
        : conversationsApi.rejectJoinRequest(containerId, requestId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings-requests', containerId] }),
    onError: (error) => notify(error, 'Could not update this request'),
  });

  const invites = isGroup
    ? {
        onInviteUser: (userId: string) => inviteUser.mutate(userId),
        isInvitingUser: inviteUser.isPending,
        links: {
          links: (invitesQuery.data ?? []).map((invite) => ({
            id: invite.id,
            code: invite.code,
            useCount: invite.use_count,
            maxUses: invite.max_uses,
            revoked: invite.revoked,
          })),
          isLoading: invitesQuery.isLoading,
          onCreate: () => createInvite.mutate(),
          isCreating: createInvite.isPending,
          onRevoke: (inviteId: string) => revokeInvite.mutate(inviteId),
          isRevoking: revokeInvite.isPending,
        },
      }
    : null;

  const requests = isGroup
    ? {
        requests: (requestsQuery.data ?? []).map((request) => ({
          id: request.id,
          userId: request.user_id,
        })),
        isLoading: requestsQuery.isLoading,
        onApprove: (requestId: string) => decideRequest.mutate({ requestId, approve: true }),
        onReject: (requestId: string) => decideRequest.mutate({ requestId, approve: false }),
        isMutating: decideRequest.isPending,
      }
    : null;

  // --- danger ---------------------------------------------------------------

  const leave = useMutation({
    mutationFn: () => (isChannel ? channelsApi.leave(containerId) : conversationsApi.leaveGroup(containerId)),
    onSuccess: invalidateContainer,
    onError: (error) => notify(error, 'Could not leave'),
  });

  const deleteGroup = useMutation({
    mutationFn: () => conversationsApi.deleteGroup(containerId),
    onSuccess: () => {
      toast.success(`Deleted ${descriptor?.identity.title ?? 'the group'}`);
      invalidateContainer();
      options.onDeleted?.();
    },
    onError: (error) => notify(error, 'Could not delete this group'),
  });

  const deleteChannel = useMutation({
    mutationFn: () => channelsApi.remove(containerId),
    onSuccess: () => {
      toast.success(`Deleted ${descriptor?.identity.title ?? 'the channel'}`);
      invalidateContainer();
      options.onDeleted?.();
    },
    onError: (error) => notify(error, 'Could not delete this channel'),
  });

  const danger = useMemo(() => {
    const actions: ManageDangerAction[] = [];

    if (isGroup || isChannel) {
      actions.push({
        id: 'leave',
        label: 'Leave',
        description: isChannel ? 'Stop following and leave this channel.' : 'Leave this group.',
        confirmTitle: 'Leave?',
        confirmDescription: 'You will stop receiving messages here.',
        onConfirm: () => leave.mutate(),
        isPending: leave.isPending,
      });
    }

    if (isGroup && manageCapabilities.canDeleteResource) {
      actions.push({
        id: 'delete',
        label: 'Delete group',
        description: 'Delete this group for everyone. This cannot be undone.',
        confirmTitle: 'Delete this group?',
        confirmDescription:
          'The group, its messages and every uploaded file are permanently removed for every member. This cannot be undone.',
        confirmPhrase: descriptor?.identity.title ?? null,
        onConfirm: () => deleteGroup.mutate(),
        isPending: deleteGroup.isPending,
      });
    }

    if (isChannel && manageCapabilities.canDeleteResource) {
      actions.push({
        id: 'delete',
        label: 'Delete channel',
        description: 'Delete this channel for everyone. This cannot be undone.',
        confirmTitle: 'Delete this channel?',
        confirmDescription:
          'The channel, its posts, comments and every uploaded file are permanently removed, and its followers lose it. This cannot be undone.',
        confirmPhrase: descriptor?.identity.title ?? null,
        onConfirm: () => deleteChannel.mutate(),
        isPending: deleteChannel.isPending,
      });
    }

    // A DM is not left, it is cleared, deleted or blocked. The registry has
    // always shown this section for a DM; until now it rendered empty.
    if (isDm) {
      const peerUserId = conversation?.peer_user?.id ?? null;

      actions.push({
        id: 'clear',
        label: 'Clear history',
        description: 'Remove your copy of this conversation. The other person keeps theirs.',
        confirmTitle: 'Clear this chat?',
        confirmDescription: 'Your message history here is removed. The chat itself stays.',
        onConfirm: async () => {
          await lifecycle.clearConversation(containerId);
        },
        isPending: lifecycle.isClearingConversation,
      });

      actions.push({
        id: 'delete',
        label: 'Delete chat',
        description: 'Remove this chat and the ping behind it.',
        confirmTitle: 'Delete this chat?',
        confirmDescription:
          'The chat is removed for you. The other side may still see it until they ping again.',
        onConfirm: async () => {
          await lifecycle.deleteConversation(containerId);
        },
        isPending: lifecycle.isDeletingConversation,
      });

      if (peerUserId) {
        actions.push({
          id: 'block',
          label: 'Block',
          description: 'Stop this person from messaging or pinging you.',
          confirmTitle: 'Block this person?',
          confirmDescription:
            'They will not be able to message or ping you. You can unblock later.',
          onConfirm: async () => {
            await blockUser(peerUserId);
          },
          isPending: isBlocking,
        });
      }
    }

    return actions;
  }, [
    isGroup,
    isChannel,
    isDm,
    conversation,
    containerId,
    descriptor,
    leave,
    deleteGroup,
    deleteChannel,
    manageCapabilities,
    lifecycle,
    blockUser,
    isBlocking,
  ]);

  return { overview, notifications, access, members, roles, invites, requests, danger };
}

/** Narrow a channel for the callers that only have the descriptor's source. */
export type { Channel };
