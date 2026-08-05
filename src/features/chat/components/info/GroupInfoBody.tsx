import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Shield, Users } from 'lucide-react';

import { APP_ROUTES } from '@/app/routes';
import { type Conversation, type ParticipantRole, ROLE_MEMBER, type UserSummary } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { useGroupMembers } from '@/hooks/useGroupManagement';
import { cn } from '@/lib/utils';

const roleLabel = (role: ParticipantRole | null, isOwner: boolean): string =>
  isOwner ? 'Owner' : role ?? ROLE_MEMBER;

function RoleBadge({ role, isOwner }: { role: ParticipantRole | null; isOwner: boolean }) {
  if (!isOwner && (!role || role === ROLE_MEMBER)) return null;
  const Icon = isOwner ? Crown : Shield;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isOwner
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
          : 'bg-primary/10 text-primary'
      )}
    >
      <Icon className="h-3 w-3" />
      {roleLabel(role, isOwner)}
    </span>
  );
}

interface GroupInfoBodyProps {
  conversation: Conversation;
  currentUserId: string | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Who is in this group. Absorbed from the former `GroupInfoPanel`, including
 * its lazy member query — a closed summary must not fetch — and the owner and
 * role badges.
 *
 * `ParticipantView` carries only a user id, so display names come from the
 * conversation's `participant_users` summaries.
 */
export function GroupInfoBody({
  conversation,
  currentUserId,
  open,
  onClose,
}: GroupInfoBodyProps) {
  const membersQuery = useGroupMembers(open ? conversation.id : null);
  const members = membersQuery.data ?? [];
  const navigate = useNavigate();

  const summaryById = useMemo(() => {
    const map = new Map<string, UserSummary>();
    for (const summary of conversation.participant_users ?? []) {
      map.set(summary.id, summary);
    }
    return map;
  }, [conversation.participant_users]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-3">
        <Avatar className="h-20 w-20 border">
          {conversation.image?.url ? (
            <AvatarImage src={conversation.image.url} className="object-cover" />
          ) : null}
          <AvatarFallback>
            <Users className="h-7 w-7 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <div className="text-base font-semibold">{conversation.title || 'Group chat'}</div>
          <div className="text-sm text-muted-foreground">
            {conversation.member_count} member{conversation.member_count === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {conversation.description ? (
        <p className="text-center text-sm text-muted-foreground">{conversation.description}</p>
      ) : null}

      <div className="pt-1">
        <span className="text-sm font-medium text-muted-foreground">Participants</span>
      </div>

      <ScrollArea className="max-h-56">
        <div className="space-y-1 pr-2">
          {members.map((member) => {
            const summary = summaryById.get(member.user_id);
            const label = summary?.display_name || summary?.username || member.user_id;
            const isSelf = member.user_id === currentUserId;
            const isMemberOwner =
              conversation.owner_type === 'user' && conversation.owner_id === member.user_id;

            return (
              <button
                key={member.user_id}
                type="button"
                onClick={() => {
                  onClose();
                  navigate(APP_ROUTES.profile(member.user_id));
                }}
                className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9 border">
                    {summary?.avatar ? <AvatarImage src={summary.avatar.url} /> : null}
                    <AvatarFallback>{(label[0] || '?').toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">
                    {label}
                    {isSelf ? (
                      <span className="font-normal text-muted-foreground"> (you)</span>
                    ) : null}
                  </div>
                </div>
                <RoleBadge role={member.role} isOwner={isMemberOwner} />
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
