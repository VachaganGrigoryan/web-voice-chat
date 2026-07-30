import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '@/app/routes';
import { Crown, Settings, Shield, Users } from 'lucide-react';

import { Conversation, ParticipantRole, ROLE_MEMBER, UserSummary } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { useGroupMembers } from '@/hooks/useGroupManagement';
import { useManageCapabilities } from '@/features/manage/useManageCapabilities';
import { cn } from '@/lib/utils';

interface GroupInfoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  currentUserId: string | null;
}

function roleLabel(role: ParticipantRole | null, isOwner: boolean): string {
  if (isOwner) return 'Owner';
  return role ?? ROLE_MEMBER;
}

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

/**
 * A lightweight, read-only look at a group while chatting: who's in it and
 * their role. Renaming, avatar changes, membership, and danger actions all
 * live in `ManageConversationPage` now — see its General/Members/Danger
 * sections, reached through the "Manage" affordance this panel does not have.
 */
export function GroupInfoPanel({ open, onOpenChange, conversation, currentUserId }: GroupInfoPanelProps) {
  const membersQuery = useGroupMembers(open ? conversation.id : null);
  const members = membersQuery.data ?? [];
  const navigate = useNavigate();
  const capabilities = useManageCapabilities({ type: 'conversation', id: conversation.id });

  const summaryById = useMemo(() => {
    const map = new Map<string, UserSummary>();
    for (const summary of conversation.participant_users ?? []) {
      map.set(summary.id, summary);
    }
    return map;
  }, [conversation.participant_users]);

  const groupName = conversation.title || 'Group chat';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Group info</DialogTitle>
          <DialogDescription>
            {members.length} participant{members.length === 1 ? '' : 's'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <Avatar className="h-24 w-24 border">
            {conversation.image?.url ? <AvatarImage src={conversation.image.url} className="object-cover" /> : null}
            <AvatarFallback className="text-2xl">
              <Users className="h-8 w-8 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <span className="text-lg font-semibold">{groupName}</span>
        </div>

        <div className="mt-2">
          <span className="text-sm font-medium text-muted-foreground">Participants</span>
        </div>

        <ScrollArea className="max-h-64">
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
                    onOpenChange(false);
                    navigate(APP_ROUTES.profile(member.user_id));
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9 border">
                      {summary?.avatar ? <AvatarImage src={summary.avatar.url} /> : null}
                      <AvatarFallback>{(label[0] || '?').toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 truncate text-sm font-medium">
                      {label}
                      {isSelf ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
                    </div>
                  </div>
                  <RoleBadge role={member.role} isOwner={isMemberOwner} />
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {capabilities.canManage ? (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate(APP_ROUTES.chatManage(conversation.id));
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Manage group
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
