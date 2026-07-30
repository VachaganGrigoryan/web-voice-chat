import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Hash, Info, Radio, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { rolesApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { APP_ROUTES } from '@/app/routes';
import { useChannelManagement } from '@/hooks/useChannelManagement';
import { ManageLayout } from './ManageLayout';
import { GeneralSection } from './sections/GeneralSection';
import { AccessPolicySection } from './sections/AccessPolicySection';
import { MembersSection, type ManageMemberRow } from './sections/MembersSection';
import { RolesSection } from './sections/RolesSection';
import { InvitesSection } from './sections/InvitesSection';
import { RequestsSection } from './sections/RequestsSection';
import { DangerSection } from './sections/DangerSection';
import type { ManageSectionId } from './types';

const SECTIONS = [
  { id: 'general' as const, label: 'General', icon: Hash },
  { id: 'access' as const, label: 'Access', icon: Info },
  { id: 'members' as const, label: 'Members', icon: Users },
  { id: 'roles' as const, label: 'Roles', icon: ShieldCheck },
  { id: 'invites' as const, label: 'Invites', icon: UserPlus },
  { id: 'requests' as const, label: 'Requests', icon: Radio },
  { id: 'danger' as const, label: 'Danger', icon: Info },
];

/** `/spaces/:spaceId/channels/:channelId/manage/:section` or legacy `/channels/:channelId/manage/:section`. */
export default function ManageChannelPage() {
  const { spaceId, channelId, section = 'general' } = useParams<{
    spaceId?: string;
    channelId: string;
    section?: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const management = useChannelManagement(channelId ?? null);
  const activeSection = (section as ManageSectionId) ?? 'general';

  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: ['roles', 'channel', channelId] });

  const createRole = useMutation({
    mutationFn: (name: string) => rolesApi.create('channel', channelId as string, { name, permissions: [] }),
    onSuccess: invalidateRoles,
    onError: (error) => toast.error(extractApiError(error, 'Failed to create role')),
  });

  const deleteRole = useMutation({
    mutationFn: (roleId: string) => rolesApi.remove('channel', channelId as string, roleId),
    onSuccess: invalidateRoles,
    onError: (error) => toast.error(extractApiError(error, 'Failed to delete role')),
  });

  if (!channelId || !management.channel) {
    return null;
  }

  const { channel } = management;
  const ownerSpaceId = spaceId ?? channel.space_id ?? null;
  const channelPath = ownerSpaceId
    ? APP_ROUTES.spaceChannel(ownerSpaceId, channelId)
    : APP_ROUTES.channel(channelId);
  const managePath = (next: ManageSectionId) =>
    ownerSpaceId
      ? APP_ROUTES.spaceChannelManage(ownerSpaceId, channelId, next)
      : APP_ROUTES.channelManage(channelId, next);
  const activeMembers = management.members.filter((member) => member.status === 'active');
  const pendingMembers = management.pendingMembers;

  const memberRows: ManageMemberRow[] = activeMembers.map((member) => ({
    id: member.relationship_id,
    userId: member.user_id,
    isOwner: channel.owner.type === 'user' && channel.owner.id === member.user_id,
  }));

  const requestRows = pendingMembers.map((member) => ({ id: member.relationship_id, userId: member.user_id }));

  return (
    <ManageLayout
      resource={{ type: 'channel', id: channelId }}
      resourceLabel="channel"
      title={channel.name}
      description="Channel management"
      onBack={() => navigate(channelPath)}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={(next) => navigate(managePath(next))}
    >
      {(capabilities) => {
        switch (activeSection) {
          case 'access':
            return <AccessPolicySection policy={capabilities.policy} />;
          case 'members':
            return (
              <MembersSection
                members={memberRows}
                isLoading={management.isLoading}
                roleSelect={
                  capabilities.canManageMembers
                    ? {
                        options: management.roles.map((role) => ({ id: role.id, label: role.name })),
                        valueFor: (row) =>
                          activeMembers.find((member) => member.relationship_id === row.id)?.role_ids[0] ?? '',
                        onChange: (row, roleId) =>
                          management.assignRoles.mutate({ relationshipId: row.id, roleIds: roleId ? [roleId] : [] }),
                        isUpdating: management.assignRoles.isPending,
                      }
                    : undefined
                }
              />
            );
          case 'roles':
            return (
              <RolesSection
                roles={management.roles}
                isLoading={management.isLoading}
                onCreate={(name) => createRole.mutate(name)}
                isCreating={createRole.isPending}
                onDelete={(roleId) => deleteRole.mutate(roleId)}
                isDeleting={deleteRole.isPending}
              />
            );
          case 'invites':
            return (
              <InvitesSection
                onInviteUser={(userId) => management.invite.mutate(userId)}
                isInvitingUser={management.invite.isPending}
              />
            );
          case 'requests':
            return (
              <RequestsSection
                requests={requestRows}
                isLoading={management.isLoading}
                onApprove={(id) => management.acceptMember.mutate(id)}
                onReject={(id) => management.declineMember.mutate(id)}
                isMutating={management.acceptMember.isPending || management.declineMember.isPending}
              />
            );
          case 'danger':
            return (
              <DangerSection
                actions={[
                  {
                    id: 'leave',
                    label: 'Leave channel',
                    description: 'Stop following this channel. You can rejoin later.',
                    confirmTitle: 'Leave this channel?',
                    confirmDescription: 'You can rejoin later if the channel is still open to you.',
                    onConfirm: async () => {
                      await management.leave.mutateAsync();
                    },
                    isPending: management.leave.isPending,
                  },
                ]}
              />
            );
          case 'general':
          default:
            return (
              <GeneralSection
                resourceType="channel"
                channel={channel}
                onSave={(updates) => management.update.mutate(updates)}
                isSaving={management.update.isPending}
              />
            );
        }
      }}
    </ManageLayout>
  );
}
