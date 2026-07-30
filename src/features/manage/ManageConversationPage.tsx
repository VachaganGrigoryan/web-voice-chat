import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, MessagesSquare, Radio, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { conversationsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { ROLE_ADMIN, ROLE_MEMBER } from '@/api/types';
import { APP_ROUTES } from '@/app/routes';
import { useGroupManagement } from '@/hooks/useGroupManagement';
import { useAuthStore } from '@/store/authStore';
import { ManageLayout } from './ManageLayout';
import { GeneralSection } from './sections/GeneralSection';
import { AccessPolicySection } from './sections/AccessPolicySection';
import { MembersSection, type ManageMemberRow } from './sections/MembersSection';
import { InvitesSection } from './sections/InvitesSection';
import { RequestsSection } from './sections/RequestsSection';
import { DangerSection } from './sections/DangerSection';
import type { ManageSectionId } from './types';

const SECTIONS = [
  { id: 'general' as const, label: 'General', icon: MessagesSquare },
  { id: 'access' as const, label: 'Access', icon: Info },
  { id: 'members' as const, label: 'Members', icon: Users },
  { id: 'invites' as const, label: 'Invites', icon: UserPlus },
  { id: 'requests' as const, label: 'Requests', icon: Radio },
  { id: 'danger' as const, label: 'Danger', icon: Info },
];

const ROLE_OPTIONS = [
  { id: ROLE_MEMBER, label: 'Member' },
  { id: ROLE_ADMIN, label: 'Admin' },
];

/** `/spaces/:spaceId/groups/:conversationId/manage/:section` or legacy `/chat/:conversationId/manage/:section`. */
export default function ManageConversationPage() {
  const { spaceId, conversationId, section = 'general' } = useParams<{
    spaceId?: string;
    conversationId: string;
    section?: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId } = useAuthStore();
  const activeSection = (section as ManageSectionId) ?? 'general';

  const conversationQuery = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationsApi.getConversation(conversationId as string),
    enabled: !!conversationId,
  });
  const conversation = conversationQuery.data ?? null;
  const management = useGroupManagement(conversationId ?? null, conversation);

  const invitesQuery = useQuery({
    queryKey: ['conversation-invites', conversationId],
    queryFn: () => conversationsApi.listInvites(conversationId as string),
    enabled: !!conversationId && activeSection === 'invites',
  });
  const createInvite = useMutation({
    mutationFn: () => conversationsApi.createInvite(conversationId as string, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversation-invites', conversationId] }),
    onError: (error) => toast.error(extractApiError(error, 'Failed to create invite link')),
  });
  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => conversationsApi.revokeInvite(conversationId as string, inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversation-invites', conversationId] }),
    onError: (error) => toast.error(extractApiError(error, 'Failed to revoke invite link')),
  });

  const requestsQuery = useQuery({
    queryKey: ['conversation-join-requests', conversationId],
    queryFn: () => conversationsApi.listJoinRequests(conversationId as string),
    enabled: !!conversationId && activeSection === 'requests',
  });
  const approveRequest = useMutation({
    mutationFn: (requestId: string) => conversationsApi.approveJoinRequest(conversationId as string, requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversation-join-requests', conversationId] }),
    onError: (error) => toast.error(extractApiError(error, 'Failed to approve request')),
  });
  const rejectRequest = useMutation({
    mutationFn: (requestId: string) => conversationsApi.rejectJoinRequest(conversationId as string, requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversation-join-requests', conversationId] }),
    onError: (error) => toast.error(extractApiError(error, 'Failed to reject request')),
  });

  if (!conversationId || !conversation) {
    return null;
  }

  const memberRows: ManageMemberRow[] = management.members.map((member) => ({
    id: member.user_id,
    userId: member.user_id,
    isOwner: conversation.owner_type === 'user' && conversation.owner_id === member.user_id,
    isSelf: member.user_id === userId,
  }));
  const ownerSpaceId = spaceId ?? conversation.space_id ?? null;
  const groupPath = ownerSpaceId
    ? APP_ROUTES.spaceGroupChat(ownerSpaceId, conversationId)
    : APP_ROUTES.group(conversationId);
  const managePath = (next: ManageSectionId) =>
    ownerSpaceId
      ? APP_ROUTES.spaceGroupManage(ownerSpaceId, conversationId, next)
      : APP_ROUTES.chatManage(conversationId, next);

  return (
    <ManageLayout
      resource={{ type: 'conversation', id: conversationId }}
      resourceLabel="group"
      title={conversation.title || 'Group chat'}
      description="Group management"
      onBack={() => navigate(groupPath)}
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
                isLoading={management.membersQuery.isLoading}
                roleSelect={{
                  options: ROLE_OPTIONS,
                  valueFor: (row) =>
                    management.members.find((member) => member.user_id === row.userId)?.role ?? ROLE_MEMBER,
                  onChange: (row, role) =>
                    management.updateMemberRole.mutate({ memberUserId: row.userId, role }),
                  isUpdating: management.updateMemberRole.isPending,
                }}
                onRemove={(row) => management.removeMember.mutate(row.userId)}
                isRemoving={management.removeMember.isPending}
              />
            );
          case 'invites':
            return (
              <InvitesSection
                onInviteUser={(userId) => management.addMembers.mutate([userId])}
                isInvitingUser={management.addMembers.isPending}
                inviteLinks={{
                  links: (invitesQuery.data ?? [])
                    .filter((invite) => !invite.revoked)
                    .map((invite) => ({
                      id: invite.id,
                      code: invite.code,
                      useCount: invite.use_count,
                      maxUses: invite.max_uses,
                      revoked: invite.revoked,
                    })),
                  isLoading: invitesQuery.isLoading,
                  onCreate: () => createInvite.mutate(),
                  isCreating: createInvite.isPending,
                  onRevoke: (id) => revokeInvite.mutate(id),
                  isRevoking: revokeInvite.isPending,
                }}
              />
            );
          case 'requests':
            return (
              <RequestsSection
                requests={(requestsQuery.data ?? []).map((request) => ({ id: request.id, userId: request.user_id }))}
                isLoading={requestsQuery.isLoading}
                onApprove={(id) => approveRequest.mutate(id)}
                onReject={(id) => rejectRequest.mutate(id)}
                isMutating={approveRequest.isPending || rejectRequest.isPending}
              />
            );
          case 'danger':
            return (
              <DangerSection
                actions={[
                  {
                    id: 'clear',
                    label: 'Clear history for everyone',
                    description: 'Removes every message in this group for all members.',
                    confirmTitle: 'Clear this group’s history?',
                    confirmDescription: 'This removes every message for all members and cannot be undone.',
                    onConfirm: async () => {
                      await management.clearForEveryone.mutateAsync();
                    },
                    isPending: management.clearForEveryone.isPending,
                  },
                  management.isOwner
                    ? {
                        id: 'delete',
                        label: 'Delete group',
                        description: 'Permanently deletes this group for everyone.',
                        confirmTitle: 'Delete this group?',
                        confirmDescription: 'This permanently deletes the group for every member and cannot be undone.',
                        onConfirm: async () => {
                          await management.deleteGroup.mutateAsync();
                          navigate(APP_ROUTES.chat);
                        },
                        isPending: management.deleteGroup.isPending,
                      }
                    : {
                        id: 'leave',
                        label: 'Leave group',
                        description: 'You can be re-invited later.',
                        confirmTitle: 'Leave this group?',
                        confirmDescription: 'You will need a new invite to rejoin.',
                        onConfirm: async () => {
                          await management.leaveGroup.mutateAsync();
                          navigate(APP_ROUTES.chat);
                        },
                        isPending: management.leaveGroup.isPending,
                      },
                ]}
              />
            );
          case 'general':
          default:
            return (
              <GeneralSection
                resourceType="conversation"
                title={conversation.title || ''}
                onRename={(title) => management.rename.mutate(title)}
                isSaving={management.rename.isPending}
              />
            );
        }
      }}
    </ManageLayout>
  );
}
