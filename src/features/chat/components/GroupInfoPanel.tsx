import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '@/app/routes';
import {
  Camera,
  Check,
  Crown,
  Loader2,
  LogOut,
  Pencil,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';

import { Conversation, ParticipantRole, UserSummary } from '@/api/types';
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
import { Input } from '@/components/ui/Input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { useGroupManagement } from '@/hooks/useGroupManagement';
import { cn } from '@/lib/utils';
import { ConfirmDestructiveActionDialog } from './ConfirmDestructiveActionDialog';

interface GroupInfoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  currentUserId: string | null;
  /** DM contacts, used to pick new members to add. */
  contacts: Conversation[];
  /** Called after the current user leaves or the group is deleted. */
  onExitConversation: () => void;
}

type PendingAction =
  | { kind: 'remove'; userId: string; label: string }
  | { kind: 'clearAll' }
  | { kind: 'delete' }
  | { kind: 'leave' };

function roleLabel(role: ParticipantRole): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
}

function RoleBadge({ role }: { role: ParticipantRole }) {
  if (role === 'member') return null;
  const Icon = role === 'owner' ? Crown : Shield;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        role === 'owner'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
          : 'bg-primary/10 text-primary'
      )}
    >
      <Icon className="h-3 w-3" />
      {roleLabel(role)}
    </span>
  );
}

export function GroupInfoPanel({
  open,
  onOpenChange,
  conversation,
  currentUserId,
  contacts,
  onExitConversation,
}: GroupInfoPanelProps) {
  const gm = useGroupManagement(open ? conversation.id : null);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(conversation.title ?? '');
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const summaryById = useMemo(() => {
    const map = new Map<string, UserSummary>();
    for (const summary of conversation.participant_users ?? []) {
      map.set(summary.id, summary);
    }
    return map;
  }, [conversation.participant_users]);

  const memberIds = useMemo(
    () => new Set(gm.members.map((member) => member.user_id)),
    [gm.members]
  );

  const addCandidates = useMemo(
    () =>
      contacts
        .filter(
          (item) =>
            item.type === 'dm' &&
            item.peer_user &&
            !item.peer_user.is_ghost &&
            item.peer_user.id !== currentUserId &&
            !memberIds.has(item.peer_user.id)
        )
        .map((item) => item.peer_user as UserSummary)
        .filter(
          (peer, index, peers) => peers.findIndex((c) => c.id === peer.id) === index
        ),
    [contacts, currentUserId, memberIds]
  );

  const groupName = conversation.title || 'Group chat';
  const canManage = gm.canManage;
  const isOwner = gm.isOwner;

  const submitTitle = () => {
    const next = titleDraft.trim();
    if (!next || next === conversation.title) {
      setIsEditingTitle(false);
      return;
    }
    gm.rename.mutate(next, { onSuccess: () => setIsEditingTitle(false) });
  };

  const onPickAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      gm.uploadAvatar.mutate(file);
    }
  };

  const toggleAddMember = (userId: string) => {
    setSelectedToAdd((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  };

  const submitAddMembers = () => {
    if (selectedToAdd.length === 0) return;
    gm.addMembers.mutate(selectedToAdd, {
      onSuccess: () => {
        setSelectedToAdd([]);
        setAddMembersOpen(false);
      },
    });
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const done = () => setPendingAction(null);
    switch (pendingAction.kind) {
      case 'remove':
        gm.removeMember.mutate(pendingAction.userId, { onSuccess: done });
        break;
      case 'clearAll':
        gm.clearForEveryone.mutate(undefined, { onSuccess: done });
        break;
      case 'delete':
        gm.deleteGroup.mutate(undefined, {
          onSuccess: () => {
            done();
            onOpenChange(false);
            onExitConversation();
          },
        });
        break;
      case 'leave':
        gm.leaveGroup.mutate(undefined, {
          onSuccess: () => {
            done();
            onOpenChange(false);
            onExitConversation();
          },
        });
        break;
    }
  };

  const destructiveCopy = useMemo(() => {
    switch (pendingAction?.kind) {
      case 'remove':
        return {
          title: 'Remove member',
          description: `Remove ${pendingAction.label} from this group?`,
          actionLabel: 'Remove',
        };
      case 'clearAll':
        return {
          title: 'Clear history for everyone',
          description:
            'This permanently deletes all messages in this group for every participant. This cannot be undone.',
          actionLabel: 'Clear for everyone',
        };
      case 'delete':
        return {
          title: 'Delete group',
          description: 'This permanently deletes the group for everyone. This cannot be undone.',
          actionLabel: 'Delete group',
        };
      case 'leave':
        return {
          title: 'Leave group',
          description: 'You will no longer receive messages from this group.',
          actionLabel: 'Leave',
        };
      default:
        return { title: '', description: '', actionLabel: '' };
    }
  }, [pendingAction]);

  const isDestructivePending =
    gm.removeMember.isPending ||
    gm.clearForEveryone.isPending ||
    gm.deleteGroup.isPending ||
    gm.leaveGroup.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Group info</DialogTitle>
            <DialogDescription>
              {gm.members.length} participant{gm.members.length === 1 ? '' : 's'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-24 w-24 border">
                {conversation.image?.url ? (
                  <AvatarImage src={conversation.image.url} className="object-cover" />
                ) : null}
                <AvatarFallback className="text-2xl">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              {canManage ? (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={gm.uploadAvatar.isPending}
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
                    aria-label="Change group image"
                  >
                    {gm.uploadAvatar.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPickAvatar}
                  />
                </>
              ) : null}
            </div>

            {conversation.image?.url && canManage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => gm.removeAvatar.mutate()}
                disabled={gm.removeAvatar.isPending}
              >
                Remove image
              </Button>
            ) : null}

            {isEditingTitle && canManage ? (
              <div className="flex w-full items-center gap-2">
                <Input
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  maxLength={80}
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submitTitle();
                    if (event.key === 'Escape') setIsEditingTitle(false);
                  }}
                />
                <Button size="sm" onClick={submitTitle} disabled={gm.rename.isPending}>
                  {gm.rename.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{groupName}</span>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(conversation.title ?? '');
                      setIsEditingTitle(true);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Edit group name"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Participants</span>
            {canManage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAddMembersOpen(true)}
              >
                <UserPlus className="mr-1 h-4 w-4" />
                Add
              </Button>
            ) : null}
          </div>

          <ScrollArea className="max-h-64">
            <div className="space-y-1 pr-2">
              {gm.members.map((member) => {
                const summary = summaryById.get(member.user_id);
                const label =
                  summary?.display_name || summary?.username || member.user_id;
                const isSelf = member.user_id === currentUserId;
                const canRemove =
                  canManage &&
                  !isSelf &&
                  member.role !== 'owner' &&
                  (isOwner || member.role === 'member');
                return (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(APP_ROUTES.profile(member.user_id));
                      }}
                      className="flex items-center gap-3 min-w-0 text-left hover:opacity-85"
                    >
                      <Avatar className="h-9 w-9 border">
                        {summary?.avatar ? <AvatarImage src={summary.avatar.url} /> : null}
                        <AvatarFallback>{(label[0] || '?').toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {label}
                          {isSelf ? <span className="text-muted-foreground font-normal"> (you)</span> : null}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <RoleBadge role={member.role} />
                      {isOwner && !isSelf && member.role !== 'owner' ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="px-2 text-xs"
                            onClick={() =>
                              gm.updateMemberRole.mutate({
                                memberUserId: member.user_id,
                                role: member.role === 'admin' ? 'member' : 'admin',
                              })
                            }
                            disabled={gm.updateMemberRole.isPending}
                          >
                            {member.role === 'admin' ? 'Demote' : 'Make admin'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="px-2 text-xs"
                            onClick={() => gm.transferOwnership.mutate(member.user_id)}
                            disabled={gm.transferOwnership.isPending}
                            title="Transfer ownership"
                          >
                            <Crown className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({ kind: 'remove', userId: member.user_id, label })
                          }
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${label}`}
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            {canManage ? (
              <Button
                type="button"
                variant="outline"
                className="w-full text-destructive"
                onClick={() => setPendingAction({ kind: 'clearAll' })}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear history for everyone
              </Button>
            ) : null}
            {isOwner ? (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => setPendingAction({ kind: 'delete' })}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete group
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full text-destructive"
                onClick={() => setPendingAction({ kind: 'leave' })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Leave group
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addMembersOpen}
        onOpenChange={(next) => {
          setAddMembersOpen(next);
          if (!next) setSelectedToAdd([]);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add members</DialogTitle>
            <DialogDescription>Select from your existing chats.</DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {addCandidates.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No contacts available to add
              </div>
            ) : (
              addCandidates.map((peer) => {
                const isSelected = selectedToAdd.includes(peer.id);
                const label = peer.display_name || peer.username || peer.id;
                return (
                  <button
                    key={peer.id}
                    type="button"
                    onClick={() => toggleAddMember(peer.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                      isSelected
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-background hover:bg-muted/50'
                    )}
                  >
                    <Avatar className="h-9 w-9 border">
                      {peer.avatar ? <AvatarImage src={peer.avatar.url} /> : null}
                      <AvatarFallback>{(label[0] || '?').toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                    {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddMembersOpen(false);
                setSelectedToAdd([]);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitAddMembers}
              disabled={selectedToAdd.length === 0 || gm.addMembers.isPending}
            >
              {gm.addMembers.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDestructiveActionDialog
        open={!!pendingAction}
        title={destructiveCopy.title}
        description={destructiveCopy.description}
        actionLabel={destructiveCopy.actionLabel}
        isPending={isDestructivePending}
        onOpenChange={(next) => {
          if (!next && !isDestructivePending) setPendingAction(null);
        }}
        onConfirm={confirmPendingAction}
      />
    </>
  );
}
