import { useNavigate, useParams } from 'react-router-dom';
import { Globe, Info, Radio, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { APP_ROUTES } from '@/app/routes';
import { useSpaces } from '@/hooks/useSpaces';
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
  { id: 'general' as const, label: 'General', icon: Globe },
  { id: 'access' as const, label: 'Access', icon: Info },
  { id: 'members' as const, label: 'Members', icon: Users },
  { id: 'roles' as const, label: 'Roles', icon: ShieldCheck },
  { id: 'invites' as const, label: 'Invites', icon: UserPlus },
  { id: 'requests' as const, label: 'Requests', icon: Radio },
  { id: 'danger' as const, label: 'Danger', icon: Info },
];

/** `/spaces/:spaceId/manage/:section`. */
export default function ManageSpacePage() {
  const { spaceId, section = 'general' } = useParams<{ spaceId: string; section?: string }>();
  const navigate = useNavigate();
  const activeSection = (section as ManageSectionId) ?? 'general';
  const manage = useSpaces(spaceId);

  if (!spaceId || !manage.space) {
    return null;
  }

  const { space } = manage;
  const memberRows: ManageMemberRow[] = manage.members.map((member) => ({
    id: member.id,
    userId: member.user?.display_name || member.user?.username || member.user_id,
    isOwner: space.owner_user_id === member.user_id,
    roleLabel: member.role,
  }));

  return (
    <ManageLayout
      resource={{ type: 'space', id: spaceId }}
      resourceLabel="space"
      title={space.name}
      description="Space management"
      onBack={() => navigate(APP_ROUTES.spaceDetail(spaceId))}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={(next) => navigate(`${APP_ROUTES.spaceDetail(spaceId)}/manage/${next}`)}
    >
      {(capabilities) => {
        switch (activeSection) {
          case 'access':
            return <AccessPolicySection policy={capabilities.policy} />;
          case 'members':
            return (
              <MembersSection
                members={memberRows}
                isLoading={manage.isLoadingMembers}
                roleSelect={
                  capabilities.canManageMembers
                    ? {
                        options: manage.roles.map((role) => ({ id: role.id, label: role.name })),
                        valueFor: (row) => {
                          const member = manage.members.find((m) => m.id === row.id);
                          return manage.roles.find((role) => role.name === member?.role)?.id ?? '';
                        },
                        onChange: (row, roleId) =>
                          manage.assignMemberRoles({ relationshipId: row.id, roleIds: roleId ? [roleId] : [] }),
                        isUpdating: manage.isAssigningMemberRoles,
                      }
                    : undefined
                }
              />
            );
          case 'roles':
            return (
              <RolesSection
                roles={manage.roles}
                isLoading={manage.isLoadingMembers}
                onCreate={(name) => manage.createRole({ spaceId, data: { name, permissions: [] } })}
                isCreating={manage.isCreatingRole}
                onDelete={(roleId) => manage.deleteRole({ spaceId, roleId })}
                isDeleting={manage.isDeletingRole}
              />
            );
          case 'invites':
            return (
              <InvitesSection
                onInviteUser={(userId) => manage.inviteUser({ spaceId, userId })}
                isInvitingUser={manage.isInvitingUser}
                inviteLinks={{
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
                  onCreate: () => manage.createInvite({ spaceId, data: {} }),
                  isCreating: manage.isCreatingInvite,
                  onRevoke: (inviteId) => manage.revokeInvite({ spaceId, inviteId }),
                  isRevoking: manage.isRevokingInvite,
                }}
              />
            );
          case 'requests':
            return (
              <RequestsSection
                requests={manage.joinRequests.map((request) => ({ id: request.id, userId: request.user_id }))}
                isLoading={manage.isLoadingJoinRequests}
                onApprove={(requestId) => manage.approveRequest({ spaceId, requestId })}
                onReject={(requestId) => manage.rejectRequest({ spaceId, requestId })}
                isMutating={manage.isApprovingRequest || manage.isRejectingRequest}
              />
            );
          case 'danger':
            // No leave-space or delete-space endpoint exists yet (see design.md
            // Non-Goals) — the section renders honestly empty rather than faking one.
            return <DangerSection actions={[]} />;
          case 'general':
          default:
            return (
              <GeneralSection
                resourceType="space"
                name={space.name}
                visibility={space.visibility}
                onSave={(updates) => manage.updateSpace({ spaceId, data: updates })}
                isSaving={manage.isUpdatingSpace}
              />
            );
        }
      }}
    </ManageLayout>
  );
}
