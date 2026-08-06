import { Crown, Loader2, Shield, UserRound } from 'lucide-react';
import { ROLE_ADMIN, ROLE_MODERATOR } from '@/api/types';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Avatar, AvatarFallback } from '@/components/ui/Avatar';
import type { useChannelManagement } from '@/hooks/useChannelManagement';

interface ChannelMembersTabProps {
  channelId: string;
  management: ReturnType<typeof useChannelManagement>;
}

function RoleBadge({ names }: { names: string[] }) {
  if (names.includes(ROLE_ADMIN)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-muted px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide text-brand">
        <Crown className="h-3 w-3" />
        Admin
      </span>
    );
  }
  if (names.includes(ROLE_MODERATOR)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Shield className="h-3 w-3" />
        Moderator
      </span>
    );
  }
  return null;
}

/**
 * A read-only roster of this channel's members. Join-request approval and
 * leaving the channel are management actions now — see `ManageChannelPage`'s
 * Requests and Danger sections.
 */
export function ChannelMembersTab({ management }: ChannelMembersTabProps) {
  const { members, roles, isLoading } = management;

  const rolesById = new Map(roles.map((role) => [role.id, role.name]));
  const activeMembers = members.filter((member) => member.status === 'active');

  if (isLoading) {
    return (
      <PanelSection title="Members">
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PanelSection>
    );
  }

  return (
    <PanelSection
      title="Members"
      description={activeMembers.length ? `${activeMembers.length} members` : undefined}
    >
      {activeMembers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No members yet.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
          {activeMembers.map((member) => (
            <div key={member.relationship_id} className="flex items-center gap-3 p-4">
              <Avatar className="h-9 w-9 border border-border/60">
                <AvatarFallback>
                  <UserRound className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm">{member.user_id}</span>
              <RoleBadge
                names={member.role_ids
                  .map((roleId) => rolesById.get(roleId))
                  .filter((name): name is string => !!name)}
              />
            </div>
          ))}
        </div>
      )}
    </PanelSection>
  );
}
