import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { spacesApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { useManageCapabilities } from '@/features/manage/useManageCapabilities';
import type { ManageDangerAction } from '@/features/manage/sections/DangerSection';

import type { Role } from '@/api/types';
import { useSpaces } from '@/hooks/useSpaces';
import type { ManageMemberRow } from '@/features/manage/sections/MembersSection';
import type { RuleOption } from './primitives';
import { unknownPermissions } from './permissionCatalog';
import type { SettingsSectionData } from './sectionData';

/**
 * The space half of the settings data contract.
 *
 * A space speaks `spacesApi` rather than the conversation/channel endpoints, so
 * it gets its own adapter rather than a branch inside the container one. Both
 * produce the same `SettingsSectionData`, which is what lets one component and
 * one section registry serve all four subject kinds.
 *
 * `notifications` is `null` because a space is not a container and has no
 * per-viewer inbox state. `danger` offers deletion, which cascades into every
 * channel and group the space owns — a child left behind would resolve no
 * owner and could never be managed again.
 */

const SPACE_VISIBILITY_RULES: readonly RuleOption<string>[] = [
  {
    value: 'public',
    label: 'Anyone',
    meaning: 'Anyone can find this space and see what is inside it.',
  },
  {
    value: 'private',
    label: 'Members',
    meaning: 'Only members can find this space or see what is inside it.',
  },
];

export interface SpaceSettingsOptions {
  /** Called after the delete succeeds, so the surface can close and navigate. */
  readonly onDeleted?: () => void;
}

export function useSpaceSettingsData(
  spaceId: string,
  options: SpaceSettingsOptions = {}
): SettingsSectionData {
  const manage = useSpaces(spaceId);
  const [savingRoleIds, setSavingRoleIds] = useState<ReadonlySet<string>>(new Set());
  const manageCapabilities = useManageCapabilities({ type: 'space', id: spaceId });

  const deleteSpace = useMutation({
    mutationFn: () => spacesApi.remove(spaceId),
    onSuccess: () => {
      toast.success(`Deleted ${manage.space?.name ?? 'the space'}`);
      options.onDeleted?.();
    },
    onError: (error) => toast.error(extractApiError(error, 'Could not delete this space')),
  });

  const space = manage.space;

  const overview = useMemo(
    () => ({
      edit: space
        ? {
            name: space.name,
            description: null,
            supportsDescription: false,
            isSaving: manage.isUpdatingSpace,
            onSave: ({ name }: { name: string }) => {
              void manage.updateSpace({ spaceId, data: { name } });
            },
          }
        : null,
      facts: space
        ? [
            { label: 'Type', value: 'Space' },
            { label: 'Members', value: String(manage.members.length) },
            { label: 'Channels', value: String(manage.channels.length) },
            { label: 'Groups', value: String(manage.groups.length) },
          ]
        : [],
    }),
    [space, spaceId, manage]
  );

  // Visibility used to be a select on the general form and the access section
  // was a read-only echo. It is a rule here, like every other access question.
  const access = useMemo(
    () => ({
      rules: space
        ? [
            {
              id: 'visibility',
              question: 'Who can find this space?',
              value: space.visibility,
              options: SPACE_VISIBILITY_RULES,
              onChange: (value: string) => {
                void manage.updateSpace({ spaceId, data: { visibility: value } });
              },
            },
          ]
        : [],
      isSaving: manage.isUpdatingSpace,
    }),
    [space, spaceId, manage]
  );

  const members = useMemo(() => {
    // `id` is the relationship id `assignMemberRoles` expects; `userId` keeps the
    // display name the space page already showed rather than a raw id.
    const rows: ManageMemberRow[] = manage.members.map((member) => ({
      id: member.id,
      userId: member.user?.display_name || member.user?.username || member.user_id,
      isOwner: space?.owner_user_id === member.user_id,
      roleLabel: member.role,
    }));

    return {
      members: rows,
      isLoading: manage.isLoadingMembers,
      roleOptions: manage.roles.map((role) => ({ id: role.id, label: role.name })),
      // A space member carries a flat role name, not role ids, so the current
      // selection is resolved by matching that name back to a role.
      roleValueFor: (row: ManageMemberRow) => {
        const member = manage.members.find((entry) => entry.id === row.id);
        return manage.roles.find((role) => role.name === member?.role)?.id ?? '';
      },
      onChangeRole: (row: ManageMemberRow, roleId: string) => {
        void manage.assignMemberRoles({
          relationshipId: row.id,
          roleIds: roleId ? [roleId] : [],
        });
      },
      isUpdatingRole: manage.isAssigningMemberRoles,
      // No space member-removal route exists, so the affordance is absent.
      onRemove: null,
      isRemoving: false,
    };
  }, [manage, space]);

  const roles = useMemo(
    () => ({
      roles: manage.roles,
      isLoading: manage.isLoadingMembers,
      onCreate: (name: string) => {
        void manage.createRole({ spaceId, data: { name, permissions: [] } });
      },
      isCreating: manage.isCreatingRole,
      onDelete: (roleId: string) => {
        void manage.deleteRole({ spaceId, roleId });
      },
      isDeleting: manage.isDeletingRole,
      onSetPermissions: (role: Role, permissions: readonly string[]) => {
        setSavingRoleIds((current) => new Set(current).add(role.id));
        // Permissions this build does not know are carried through untouched.
        const preserved = unknownPermissions(role.permissions);
        void manage
          .updateRole({
            spaceId,
            roleId: role.id,
            data: { permissions: Array.from(new Set([...permissions, ...preserved])) },
          })
          .catch(() => toast.error('Could not update this role'))
          .finally(() =>
            setSavingRoleIds((current) => {
              const next = new Set(current);
              next.delete(role.id);
              return next;
            })
          );
      },
      savingRoleIds,
    }),
    [manage, spaceId, savingRoleIds]
  );

  const invites = useMemo(
    () => ({
      onInviteUser: (userId: string) => {
        void manage.inviteUser({ spaceId, userId });
      },
      isInvitingUser: manage.isInvitingUser,
      links: {
        links: manage.invites
          .filter((invite) => !invite.revoked)
          .map((invite) => ({
            id: invite.id,
            code: invite.code,
            useCount: invite.uses,
            maxUses: invite.max_uses,
            revoked: invite.revoked,
          })),
        isLoading: manage.isLoadingInvites,
        onCreate: () => {
          void manage.createInvite({ spaceId, data: {} });
        },
        isCreating: manage.isCreatingInvite,
        onRevoke: (inviteId: string) => {
          void manage.revokeInvite({ spaceId, inviteId });
        },
        isRevoking: manage.isRevokingInvite,
      },
    }),
    [manage, spaceId]
  );

  const requests = useMemo(
    () => ({
      requests: manage.joinRequests.map((request) => ({
        id: request.id,
        userId: request.user_id,
      })),
      isLoading: manage.isLoadingJoinRequests,
      onApprove: (requestId: string) => {
        void manage.approveRequest({ spaceId, requestId });
      },
      onReject: (requestId: string) => {
        void manage.rejectRequest({ spaceId, requestId });
      },
      isMutating: manage.isApprovingRequest || manage.isRejectingRequest,
    }),
    [manage, spaceId]
  );

  const childCount = manage.channels.length + manage.groups.length;

  const danger = useMemo<ManageDangerAction[]>(() => {
    if (!space || !manageCapabilities.canDeleteResource) return [];
    // The default space is reserved; the backend refuses to delete it, so the
    // affordance is absent rather than offered and rejected. `is_default` is
    // computed server-side, so the reserved slug is not duplicated here.
    if (space.is_default) return [];

    return [
      {
        id: 'delete',
        label: 'Delete space',
        description: 'Delete this space and everything inside it. This cannot be undone.',
        confirmTitle: 'Delete this space?',
        // The cascade is stated before it runs: a space cannot be deleted
        // without its children, because a child left behind would resolve no
        // owner and could never be managed again.
        confirmDescription:
          childCount > 0
            ? `This also permanently deletes ${manage.channels.length} channel${
                manage.channels.length === 1 ? '' : 's'
              } and ${manage.groups.length} group${
                manage.groups.length === 1 ? '' : 's'
              } inside it, with all of their messages and files. This cannot be undone.`
            : 'The space, its members, roles and invites are permanently removed. This cannot be undone.',
        confirmPhrase: space.name,
        onConfirm: async () => {
          await deleteSpace.mutateAsync();
        },
        isPending: deleteSpace.isPending,
      },
    ];
  }, [
    space,
    manageCapabilities.canDeleteResource,
    childCount,
    manage.channels.length,
    manage.groups.length,
    deleteSpace,
  ]);

  return {
    overview,
    notifications: null,
    access,
    members,
    roles,
    invites,
    requests,
    danger,
  };
}
