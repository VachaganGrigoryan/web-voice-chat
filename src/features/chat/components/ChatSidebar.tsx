import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Bell,
  Check,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Mic,
  MoreVertical,
  Music,
  Paperclip,
  Phone,
  Users,
  Video,
} from 'lucide-react';
import { CallHistoryItem, Conversation, User } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { ProfileTriggerButton } from '@/features/chat/components/ProfileTriggerButton';
import { UserSearch } from '@/features/discovery/UserSearch';
import { cn } from '@/lib/utils';
import { formatDuration, formatMessageDay, formatMessageTime, isSameLocalDay } from '@/utils/dateUtils';
import {
  getCallDirectionFromMeta,
  getCallStatusDetail,
  getCallSummaryText,
} from '../utils/callPresentation';
import { getPresentedMessageKind } from '../utils/messagePresentation';

type SidebarView = 'chats' | 'calls';

interface ChatSidebarProps {
  profile: User | null | undefined;
  userEmail: string | null;
  currentUserId: string | null;
  pendingIncomingCount: number;
  contacts: Conversation[];
  callHistory: CallHistoryItem[];
  sidebarView: SidebarView;
  selectedUser: string | null;
  typingUsers: Record<string, boolean>;
  activeConversationMenuPeerUserId: string | null;
  activeCallHistoryMenuPeerUserId: string | null;
  isLoadingCallHistory: boolean;
  hasMoreCallHistory: boolean;
  isFetchingMoreCallHistory: boolean;
  isClearingCallHistory: boolean;
  onOpenSettings: () => void;
  onOpenPings: () => void;
  onLogout: () => void;
  onSidebarViewChange: (view: SidebarView) => void;
  onLoadMoreCallHistory: () => void;
  onClearAllCallHistory: () => void;
  onCreateGroup: (data: { title: string; participantIds: string[] }) => Promise<void>;
  onSelectSearchUser: (peerUserId: string) => void;
  onSelectConversation: (peerUserId: string) => void;
  onSelectCallHistoryPeer: (peerUserId: string) => void;
  onOpenConversationMenu: (event: ReactMouseEvent<HTMLElement>, peerUserId: string, unreadCount: number) => void;
  onOpenConversationMenuAtPoint: (event: ReactMouseEvent<HTMLElement>, peerUserId: string, unreadCount: number) => void;
  onOpenCallHistoryMenu: (event: ReactMouseEvent<HTMLElement>, peerUserId: string) => void;
  onOpenCallHistoryMenuAtPoint: (event: ReactMouseEvent<HTMLElement>, peerUserId: string) => void;
}

function shortenMessageText(text: string | null | undefined, limit = 20): string {
  if (!text) return 'Click to chat';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > limit ? cleaned.slice(0, limit) + '…' : cleaned;
}

function formatConversationTimestamp(value: string | null) {
  if (!value) {
    return '';
  }

  return isSameLocalDay(value, new Date()) ? formatMessageTime(value) : formatMessageDay(value);
}

function getConversationLabel(conversation: Conversation) {
  if (conversation.type === 'group') {
    return conversation.title || 'Group chat';
  }

  const peer = conversation.peer_user;
  if (!peer) {
    return 'Conversation';
  }

  if (peer.is_ghost) {
    return 'Ghost chat';
  }

  return peer.display_name || peer.username || peer.id;
}

function getCallHistoryPeerLabel(peer: CallHistoryItem['peer_user']) {
  return peer.display_name || peer.username || peer.id;
}

function PreviewIcon({ icon: Icon, label }: { icon: typeof Music; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

function getConversationPreview(conversation: Conversation, currentUserId: string | null) {
  const lastMessage = conversation.last_message;
  if (!lastMessage) {
    return conversation.peer_user?.is_ghost ? 'Send a ping to reconnect' : 'Click to chat';
  }

  if (lastMessage.type === 'call' && lastMessage.call) {
    return getCallSummaryText({
      direction: getCallDirectionFromMeta(lastMessage.call, currentUserId),
      type: lastMessage.call.type,
      status: lastMessage.call.status,
      durationMs: lastMessage.call.duration_ms,
    });
  }

  if (lastMessage.type === 'system') {
    return shortenMessageText(lastMessage.text);
  }

  switch (getPresentedMessageKind(lastMessage.type, lastMessage.media?.kind)) {
    case 'audio':
      return lastMessage.media?.kind === 'audio' ? (
        <PreviewIcon icon={Music} label="Audio" />
      ) : (
        <PreviewIcon icon={Mic} label="Voice message" />
      );
    case 'file':
      return <PreviewIcon icon={Paperclip} label="File" />;
    case 'image':
      return lastMessage.text?.trim() || <PreviewIcon icon={ImageIcon} label="Photo" />;
    case 'video':
      return lastMessage.text?.trim() || <PreviewIcon icon={Video} label="Video" />;
    default:
      return shortenMessageText(lastMessage.text);
  }
}

function CallHistoryListItem({
  item,
  isSelected,
  isMenuOpen,
  onSelect,
  onOpenMenu,
  onOpenMenuAtPoint,
}: {
  item: CallHistoryItem;
  isSelected: boolean;
  isMenuOpen: boolean;
  onSelect: () => void;
  onOpenMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenMenuAtPoint: (event: ReactMouseEvent<HTMLElement>) => void;
}) {
  const preview = getCallSummaryText({
    direction: item.direction,
    type: item.type,
    status: item.status,
    durationMs: item.duration_ms,
  });
  const detail = getCallStatusDetail({
    direction: item.direction,
    type: item.type,
    status: item.status,
    durationMs: item.duration_ms,
  });
  const timestamp = formatConversationTimestamp(item.ended_at || item.started_at);
  const secondaryLabel = detail
    ? detail
    : item.duration_ms > 0
      ? formatDuration(item.duration_ms)
      : item.type === 'video'
        ? 'Video call'
        : 'Audio call';
  const CallTypeIcon = item.type === 'video' ? Video : Phone;
  const peerLabel = getCallHistoryPeerLabel(item.peer_user);

  return (
    <div
      className={cn(
        'group relative w-full min-w-0 overflow-hidden rounded-2xl border p-1.5 transition-all',
        isSelected
          ? 'border-primary/20 bg-background/95 shadow-sm ring-1 ring-primary/10'
          : 'border-border/60 bg-background/75 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-border/80 hover:bg-background/95 hover:shadow-sm'
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenuAtPoint(event);
      }}
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-3 rounded-[18px] px-2.5 py-2 pr-14 text-left transition-colors"
        onClick={onSelect}
      >
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 border border-border/60 bg-background">
            {item.peer_user.avatar ? <AvatarImage src={item.peer_user.avatar.url} /> : null}
            <AvatarFallback>{(peerLabel[0] || '?').toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted text-muted-foreground">
            <CallTypeIcon className="h-3 w-3" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span className="truncate pr-1 text-left text-sm font-medium text-foreground/90">
              {peerLabel}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{timestamp}</span>
          </div>
          <div className="mt-1 truncate text-xs font-medium text-foreground">{preview}</div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{secondaryLabel}</div>
        </div>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'absolute right-1.5 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
          'opacity-100 md:opacity-0 md:group-hover:opacity-100',
          isMenuOpen && 'bg-muted text-foreground opacity-100'
        )}
        onClick={(event) => {
          event.stopPropagation();
          onOpenMenu(event);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ConversationListItem({
  conversation,
  isSelected,
  isCurrentUserConversation,
  currentUserId,
  isTyping,
  isMenuOpen,
  onSelect,
  onOpenMenu,
  onOpenMenuAtPoint,
}: {
  conversation: Conversation;
  isSelected: boolean;
  isCurrentUserConversation: boolean;
  currentUserId: string | null;
  isTyping: boolean;
  isMenuOpen: boolean;
  onSelect: () => void;
  onOpenMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenMenuAtPoint: (event: ReactMouseEvent<HTMLElement>) => void;
}) {
  const conversationLabel = getConversationLabel(conversation);
  const avatarUrl = conversation.peer_user?.avatar?.url;
  const isOnline = conversation.type === 'dm' && !!conversation.peer_user?.is_online;
  const isGhost = !!conversation.peer_user?.is_ghost;

  return (
    <div
      className={cn(
        'group relative w-full min-w-0 overflow-hidden rounded-2xl border p-1.5 transition-all',
        isSelected
          ? 'border-primary/20 bg-background/95 shadow-sm ring-1 ring-primary/10'
          : 'border-border/60 bg-background/75 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-border/80 hover:bg-background/95 hover:shadow-sm',
        isCurrentUserConversation && 'pointer-events-none opacity-50'
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenuAtPoint(event);
      }}
    >
      <button
        type="button"
        className="flex w-full min-w-0 max-w-full items-center gap-3 rounded-[18px] px-2.5 py-2 pr-14 text-left transition-colors"
        onClick={onSelect}
      >
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 border border-border/60 bg-background">
            {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
            <AvatarFallback>
              {(conversationLabel[0] || '?').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isOnline ? (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span
              className={cn(
                'truncate pr-1 text-left text-sm',
                conversation.unread_count > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
              )}
            >
              {conversationLabel}
            </span>
            {isGhost ? (
              <span className="shrink-0 rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ghost
              </span>
            ) : null}
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatConversationTimestamp(conversation.last_message_at)}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-left text-xs',
                conversation.unread_count > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {isTyping ? (
                <span className="animate-pulse font-medium text-primary">Typing...</span>
              ) : (
                getConversationPreview(conversation, currentUserId)
              )}
            </span>
            {conversation.unread_count > 0 ? (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'absolute right-1.5 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
          'opacity-100 md:opacity-0 md:group-hover:opacity-100',
          isMenuOpen && 'bg-muted text-foreground opacity-100'
        )}
        onClick={(event) => {
          event.stopPropagation();
          onOpenMenu(event);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ChatSidebar({
  profile,
  userEmail,
  currentUserId,
  pendingIncomingCount,
  contacts,
  callHistory,
  sidebarView,
  selectedUser,
  typingUsers,
  activeConversationMenuPeerUserId,
  activeCallHistoryMenuPeerUserId,
  isLoadingCallHistory,
  hasMoreCallHistory,
  isFetchingMoreCallHistory,
  isClearingCallHistory,
  onOpenSettings,
  onOpenPings,
  onLogout,
  onSidebarViewChange,
  onLoadMoreCallHistory,
  onClearAllCallHistory,
  onCreateGroup,
  onSelectSearchUser,
  onSelectConversation,
  onSelectCallHistoryPeer,
  onOpenConversationMenu,
  onOpenConversationMenuAtPoint,
  onOpenCallHistoryMenu,
  onOpenCallHistoryMenuAtPoint,
}: ChatSidebarProps) {
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const groupCandidates = useMemo(
    () =>
      contacts
        .filter(
          (conversation) =>
            conversation.type === 'dm' &&
            conversation.peer_user &&
            !conversation.peer_user.is_ghost &&
            conversation.peer_user.id !== currentUserId
        )
        .map((conversation) => conversation.peer_user!)
        .filter(
          (peer, index, peers) => peers.findIndex((candidate) => candidate.id === peer.id) === index
        ),
    [contacts, currentUserId]
  );

  const toggleGroupMember = (userId: string) => {
    setSelectedGroupMemberIds((current) =>
      current.includes(userId)
        ? current.filter((selectedId) => selectedId !== userId)
        : [...current, userId]
    );
  };

  const closeGroupDialog = () => {
    setIsGroupDialogOpen(false);
    setGroupTitle('');
    setSelectedGroupMemberIds([]);
  };

  const submitGroup = async () => {
    const title = groupTitle.trim();
    if (!title || selectedGroupMemberIds.length === 0 || isCreatingGroup) {
      return;
    }

    setIsCreatingGroup(true);
    try {
      await onCreateGroup({ title, participantIds: selectedGroupMemberIds });
      closeGroupDialog();
    } finally {
      setIsCreatingGroup(false);
    }
  };

  return (
    <div
      className={cn(
        'h-full min-h-0 w-full border-r bg-muted/10 md:w-80',
        selectedUser ? 'hidden md:flex' : 'flex'
      )}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between border-b p-4">
          <ProfileTriggerButton
            title={profile?.display_name || profile?.username || userEmail}
            subtitle={profile?.username ? `@${profile.username}` : undefined}
            avatarUrl={profile?.avatar?.url}
            fallback={(profile?.display_name || profile?.username || userEmail || '?')[0].toUpperCase()}
            onClick={onOpenSettings}
            className="max-w-[60%]"
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onOpenPings} className="relative">
              <Bell className="h-4 w-4" />
              {pendingIncomingCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              ) : null}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsGroupDialogOpen(true)}
              title="New group"
              aria-label="New group"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Dialog open={isGroupDialogOpen} onOpenChange={(open) => (open ? setIsGroupDialogOpen(true) : closeGroupDialog())}>
          <DialogContent className="max-w-md rounded-2xl p-5">
            <DialogHeader>
              <DialogTitle>New group</DialogTitle>
              <DialogDescription>Select members from existing chats.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Input
                value={groupTitle}
                onChange={(event) => setGroupTitle(event.target.value)}
                placeholder="Group title"
                maxLength={80}
              />

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {groupCandidates.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No available contacts
                  </div>
                ) : (
                  groupCandidates.map((peer) => {
                    const isSelected = selectedGroupMemberIds.includes(peer.id);
                    const label = peer.display_name || peer.username || peer.id;
                    return (
                      <button
                        key={peer.id}
                        type="button"
                        onClick={() => toggleGroupMember(peer.id)}
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
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {label}
                        </span>
                        {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeGroupDialog}
                disabled={isCreatingGroup}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitGroup()}
                disabled={!groupTitle.trim() || selectedGroupMemberIds.length === 0 || isCreatingGroup}
              >
                {isCreatingGroup ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-4 pt-4">
            <UserSearch onSelectUser={onSelectSearchUser} />

            <div className="mb-3 mt-4 flex items-center rounded-full bg-muted p-1">
              {([
                { value: 'chats', label: 'Chats' },
                { value: 'calls', label: 'Calls' },
              ] as const).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onSidebarViewChange(item.value)}
                  className={cn(
                    'flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors',
                    sidebarView === item.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mb-2 flex items-center justify-between px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{sidebarView === 'calls' ? 'Calls' : 'Chats'}</span>
              <div className="flex items-center gap-2">
                {(sidebarView === 'calls' ? callHistory.length : contacts.length) > 0 ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {sidebarView === 'calls' ? callHistory.length : contacts.length}
                  </span>
                ) : null}
                {sidebarView === 'calls' && callHistory.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wide"
                    onClick={onClearAllCallHistory}
                    disabled={isClearingCallHistory}
                  >
                    {isClearingCallHistory ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Clearing
                      </>
                    ) : (
                      'Clear all'
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            <div className="space-y-2 pb-4 pr-1">
              {sidebarView === 'calls'
                ? callHistory.map((item) => (
                    <CallHistoryListItem
                      key={item.id}
                      item={item}
                      isSelected={selectedUser === item.peer_user.id}
                      isMenuOpen={activeCallHistoryMenuPeerUserId === item.peer_user.id}
                      onSelect={() => onSelectCallHistoryPeer(item.peer_user.id)}
                      onOpenMenu={(event) => onOpenCallHistoryMenu(event, item.peer_user.id)}
                      onOpenMenuAtPoint={(event) => onOpenCallHistoryMenuAtPoint(event, item.peer_user.id)}
                    />
                  ))
                : contacts.map((conversation) => (
                    <ConversationListItem
                      key={conversation.conversation_id}
                      conversation={conversation}
                      isSelected={selectedUser === conversation.conversation_id}
                      isCurrentUserConversation={
                        conversation.type === 'dm' && conversation.peer_user?.id === currentUserId
                      }
                      currentUserId={currentUserId}
                      isTyping={!!typingUsers[conversation.conversation_id]}
                      isMenuOpen={activeConversationMenuPeerUserId === conversation.conversation_id}
                      onSelect={() => onSelectConversation(conversation.conversation_id)}
                      onOpenMenu={(event) => onOpenConversationMenu(event, conversation.conversation_id, conversation.unread_count ?? 0)}
                      onOpenMenuAtPoint={(event) =>
                        onOpenConversationMenuAtPoint(event, conversation.conversation_id, conversation.unread_count ?? 0)
                      }
                    />
                  ))}

              {sidebarView === 'calls' && isLoadingCallHistory ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading call history…
                </div>
              ) : null}

              {sidebarView === 'calls' && hasMoreCallHistory ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-2xl"
                  onClick={onLoadMoreCallHistory}
                  disabled={isFetchingMoreCallHistory}
                >
                  {isFetchingMoreCallHistory ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    'Load more calls'
                  )}
                </Button>
              ) : null}

              {sidebarView === 'calls' && !isLoadingCallHistory && callHistory.length === 0 ? (
                <div className="m-1 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  No recent calls
                </div>
              ) : null}

              {sidebarView === 'chats' && contacts.length === 0 ? (
                <div className="m-1 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  No recent conversations
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
