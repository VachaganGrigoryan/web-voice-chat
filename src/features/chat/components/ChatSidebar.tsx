import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  Bell,
  BellOff,
  Check,
  ChevronLeft,
  Compass,
  Contact,
  FolderInput,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  MessageSquare,
  MessageSquareText,
  Mic,
  MoreVertical,
  Music,
  Paperclip,
  Pencil,
  Phone,
  Pin,
  Plus,
  Radio,
  Rss,
  Search,
  Settings,
  Trash2,
  UserRound,
  Users,
  Video,
  X,
} from 'lucide-react';
import { CallHistoryItem, Conversation, ConversationType, PresenceStatus, ThreadConversationView, User } from '@/api/types';
import { conversationsApi } from '@/api/endpoints';
import { resolveMessageContent } from '@/api/messageContent';
import { useConversationFolders } from '../hooks/useConversationFolders';
import { useConversationActions } from '../hooks/useConversationActions';
import { MoveToFolderDialog } from './MoveToFolderDialog';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { UserSearch } from '@/features/discovery/UserSearch';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/haptics';
import { formatDuration, formatMessageDay, formatMessageTime, isSameLocalDay } from '@/utils/dateUtils';
import {
  getCallDirectionFromMeta,
  getCallStatusDetail,
  getCallSummaryText,
} from '../utils/callPresentation';
import { getPresentedMessageKind } from '../utils/messagePresentation';
import { SpaceSwitcher } from './SpaceSwitcher';

type SidebarView = 'chats' | 'calls' | 'threads';

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
  presenceByUserId?: Record<string, PresenceStatus>;
  activeCallHistoryMenuPeerUserId: string | null;
  isLoadingCallHistory: boolean;
  hasMoreCallHistory: boolean;
  isFetchingMoreCallHistory: boolean;
  isClearingCallHistory: boolean;
  selectedSpaceId: string | null;
  onSpaceChange: (spaceId: string | null) => void;
  onOpenSettings: () => void;
  onOpenOwnProfile: () => void;
  onOpenPings: () => void;
  onOpenContacts: () => void;
  onOpenSpaces: () => void;
  onOpenFeeds: () => void;
  onLogout: () => void;
  onNewGroup: () => void;
  onNewChannel: () => void;
  onSidebarViewChange: (view: SidebarView) => void;
  onLoadMoreCallHistory: () => void;
  onClearAllCallHistory: () => void;
  onSelectSearchUser: (peerUserId: string) => void;
  onSelectConversation: (peerUserId: string) => void;
  onSelectThread: (thread: ThreadConversationView) => void;
  onSelectCallHistoryPeer: (peerUserId: string) => void;
  onOpenConversationMenuAtPoint: (event: ReactMouseEvent<HTMLElement>, peerUserId: string, unreadCount: number) => void;
  onOpenConversationMenuAtCoordinates: (point: { x: number; y: number }, peerUserId: string, unreadCount: number) => void;
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
    case 'poll':
      return lastMessage.text?.trim() || <PreviewIcon icon={BarChart3} label="Poll" />;
    case 'location':
      return lastMessage.text?.trim() || <PreviewIcon icon={MapPin} label="Location" />;
    case 'contact':
      return lastMessage.text?.trim() || <PreviewIcon icon={UserRound} label="Contact" />;
    case 'link':
      return lastMessage.text?.trim() || <PreviewIcon icon={Link2} label="Link" />;
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

// Threshold in px beyond which a touch counts as a scroll and cancels the
// long-press; hold duration that triggers the mobile context menu.
const LONG_PRESS_MOVE_THRESHOLD = 10;
const LONG_PRESS_DURATION_MS = 500;

function ConversationListItem({
  conversation,
  isSelected,
  isCurrentUserConversation,
  currentUserId,
  isTyping,
  selectionMode = false,
  isChecked = false,
  selectionDisabled = false,
  onSelect,
  onOpenMenuAtPoint,
  onOpenMenuAtCoordinates,
}: {
  conversation: Conversation;
  isSelected: boolean;
  isCurrentUserConversation: boolean;
  currentUserId: string | null;
  isTyping: boolean;
  selectionMode?: boolean;
  isChecked?: boolean;
  selectionDisabled?: boolean;
  onSelect: () => void;
  onOpenMenuAtPoint: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenMenuAtCoordinates: (point: { x: number; y: number }) => void;
}) {
  const longPressTimer = useRef<number | null>(null);
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => clearLongPress, []);

  const handleTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    if (selectionMode || selectionDisabled) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchStartPoint.current = { x: touch.clientX, y: touch.clientY };
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      triggerHaptic('reaction');
      onOpenMenuAtCoordinates({ x: touch.clientX, y: touch.clientY });
    }, LONG_PRESS_DURATION_MS);
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLElement>) => {
    if (!touchStartPoint.current) return;
    const touch = event.touches[0];
    if (!touch) return;
    const movedX = Math.abs(touch.clientX - touchStartPoint.current.x);
    const movedY = Math.abs(touch.clientY - touchStartPoint.current.y);
    if (movedX > LONG_PRESS_MOVE_THRESHOLD || movedY > LONG_PRESS_MOVE_THRESHOLD) {
      clearLongPress();
    }
  };

  const handleTouchEnd = () => {
    clearLongPress();
    touchStartPoint.current = null;
  };

  const handleClick = () => {
    // Suppress the synthetic click the browser emits after a long-press.
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onSelect();
  };

  const conversationLabel = getConversationLabel(conversation);
  const avatarUrl = conversation.peer_user?.avatar?.url;
  const presenceState =
    conversation.type === 'dm'
      ? conversation.peer_user?.presence_state || (conversation.peer_user?.is_online ? 'online' : 'offline')
      : 'offline';
  const isOnline = presenceState !== 'offline';
  const presenceClassName =
    presenceState === 'dnd'
      ? 'bg-rose-500'
      : presenceState === 'away'
        ? 'bg-amber-500'
        : 'bg-green-500';
  const isGhost = !!conversation.peer_user?.is_ghost;

  return (
    <div
      className={cn(
        'group relative w-full min-w-0 overflow-hidden rounded-2xl border p-1.5 transition-all',
        (selectionMode ? isChecked : isSelected)
          ? 'border-primary/20 bg-background/95 shadow-sm ring-1 ring-primary/10'
          : 'border-border/60 bg-background/75 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-border/80 hover:bg-background/95 hover:shadow-sm',
        isCurrentUserConversation && 'pointer-events-none opacity-50',
        selectionDisabled && 'pointer-events-none opacity-40'
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!selectionMode) {
          onOpenMenuAtPoint(event);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <button
        type="button"
        className="flex w-full min-w-0 max-w-full items-center gap-3 rounded-[18px] px-2.5 py-2 text-left transition-colors"
        onClick={handleClick}
      >
        {selectionMode ? (
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
              isChecked
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/40'
            )}
          >
            {isChecked ? <Check className="h-3 w-3" /> : null}
          </span>
        ) : null}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 border border-border/60 bg-background">
            {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
            <AvatarFallback>
              {(conversationLabel[0] || '?').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isOnline ? (
            <span className={cn('absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-background', presenceClassName)} />
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
              {conversation.pinned ? (
                <Pin className="mr-1 inline h-3 w-3 -translate-y-px fill-current text-primary" />
              ) : null}
              {conversation.notification_level === 'none' ||
              (conversation.muted_until &&
                new Date(conversation.muted_until).getTime() > Date.now()) ? (
                <BellOff className="mr-1 inline h-3 w-3 -translate-y-px text-muted-foreground" />
              ) : conversation.notification_level === 'mentions' ? (
                <Bell className="mr-1 inline h-3 w-3 -translate-y-px text-primary" />
              ) : null}
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
    </div>
  );
}

function getThreadParentLabel(thread: ThreadConversationView) {
  const parent = thread.parent;
  if (!parent) return 'Conversation';
  if (parent.type === 'group') return parent.title || 'Group chat';
  return getConversationLabel(parent);
}

function getThreadRootPreview(thread: ThreadConversationView) {
  if (!thread.root_message) return 'Original message unavailable';
  const { text, media } = resolveMessageContent(thread.root_message);
  if (text) return shortenMessageText(text, 48);
  if (media?.kind === 'image') return 'Photo';
  if (media?.kind === 'video') return 'Video';
  if (media?.kind === 'voice' || media?.kind === 'audio') return 'Audio';
  if (media?.kind === 'file') return 'File';
  return 'Message';
}

function ThreadListItem({
  item,
  isSelected,
  onSelect,
}: {
  item: ThreadConversationView;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const thread = item.thread;
  const locked = item.locked || !!thread.settings?.locked_at;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative w-full rounded-lg border p-3 text-left transition-all duration-200',
        isSelected
          ? 'border-primary bg-primary/10 shadow-sm'
          : 'border-transparent bg-card/60 hover:border-border hover:bg-card hover:shadow-sm'
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {getThreadParentLabel(item)}
            </span>
            {locked ? <Lock className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {formatConversationTimestamp(thread.last_message_at)}
            </span>
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {getThreadRootPreview(item)}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">
              {getConversationPreview(thread, null)}
            </span>
            {thread.unread_count > 0 ? (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {thread.unread_count > 99 ? '99+' : thread.unread_count}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
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
  presenceByUserId = {},
  activeCallHistoryMenuPeerUserId,
  isLoadingCallHistory,
  hasMoreCallHistory,
  isFetchingMoreCallHistory,
  isClearingCallHistory,
  selectedSpaceId,
  onSpaceChange,
  onOpenSettings,
  onOpenOwnProfile,
  onOpenPings,
  onOpenContacts,
  onOpenSpaces,
  onOpenFeeds,
  onLogout,
  onNewGroup,
  onNewChannel,
  onSidebarViewChange,
  onLoadMoreCallHistory,
  onClearAllCallHistory,
  onSelectSearchUser,
  onSelectConversation,
  onSelectThread,
  onSelectCallHistoryPeer,
  onOpenConversationMenuAtPoint,
  onOpenConversationMenuAtCoordinates,
  onOpenCallHistoryMenu,
  onOpenCallHistoryMenuAtPoint,
}: ChatSidebarProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [bulkFolderDialogOpen, setBulkFolderDialogOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const archivedQuery = useQuery({
    queryKey: ['conversations', 'archived', selectedSpaceId],
    queryFn: () => conversationsApi.getConversations(50, undefined, { archived: true, space_id: selectedSpaceId || undefined }),
    enabled: sidebarView === 'chats' && showArchived,
  });
  const threadsQuery = useQuery({
    queryKey: ['threads'],
    queryFn: () => conversationsApi.getThreads(50),
    enabled: sidebarView === 'threads',
  });
  const threadItems = threadsQuery.data?.data ?? [];

  const { folderNames } = useConversationFolders(sidebarView === 'chats');
  const folders = folderNames;
  const { renameFolder, deleteFolder, setInboxStateBulk } = useConversationActions();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Type the multi-select is locked to, derived from the first checked item.
  // Selecting a conversation of a different type is disabled while this is set.
  const [selectionType, setSelectionType] = useState<ConversationType | null>(null);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    setSelectionType(null);
  };

  const toggleSelected = (conversationId: string, type: ConversationType) => {
    setSelectedIds((current) => {
      if (current.includes(conversationId)) {
        const next = current.filter((id) => id !== conversationId);
        if (next.length === 0) {
          setSelectionType(null);
        }
        return next;
      }
      // First selection locks the allowed type; ignore mismatched types.
      if (current.length === 0) {
        setSelectionType(type);
      } else if (selectionType && type !== selectionType) {
        return current;
      }
      return [...current, conversationId];
    });
  };

  const applyBulkInboxState = (updates: {
    pinned?: boolean;
    archived?: boolean;
    folder?: string | null;
  }) => {
    if (selectedIds.length === 0) {
      return;
    }
    setInboxStateBulk.mutate(
      { conversationIds: selectedIds, updates },
      { onSuccess: exitSelectionMode }
    );
  };

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (!renamingFolder || !trimmed || trimmed === renamingFolder) {
      setRenamingFolder(null);
      return;
    }
    renameFolder.mutate(
      { name: renamingFolder, newName: trimmed },
      {
        onSuccess: () => {
          if (activeFolder === renamingFolder) {
            setActiveFolder(trimmed);
          }
          setRenamingFolder(null);
        },
      }
    );
  };

  const handleDeleteFolder = (folder: string) => {
    deleteFolder.mutate(folder, {
      onSuccess: () => {
        if (activeFolder === folder) {
          setActiveFolder(null);
        }
      },
    });
  };

  const archivedConversations = archivedQuery.data?.data ?? [];
  const chatContacts = contacts;

  const visibleConversations = useMemo(() => {
    if (showArchived) {
      return archivedConversations;
    }
    if (activeFolder) {
      return chatContacts.filter((conversation) => conversation.folder === activeFolder);
    }
    return chatContacts;
  }, [showArchived, archivedConversations, activeFolder, chatContacts]);

  // Group conversations by type into Slack-style sections. Pinned items stay in
  // their type group (a pin badge marks them) instead of a separate section.
  const groupedConversations = useMemo(() => {
    const directMessages = visibleConversations.filter((c) => c.type === 'dm');
    const groups = visibleConversations.filter((c) => c.type === 'group');
    return [
      { key: 'groups', label: 'Groups', items: groups },
      { key: 'dms', label: 'Direct Messages', items: directMessages },
    ] as const;
  }, [visibleConversations]);

  const renderConversation = (conversation: Conversation) => {
    const peerId = conversation.peer_user?.id;
    const livePresence = peerId ? presenceByUserId[peerId] : undefined;
    const conversationWithPresence =
      livePresence && conversation.peer_user
        ? {
            ...conversation,
            peer_user: {
              ...conversation.peer_user,
              is_online: livePresence.is_online,
              presence_state: livePresence.state,
              last_seen_at: livePresence.last_seen_at,
            },
          }
        : conversation;

    return (
      <ConversationListItem
        key={conversation.conversation_id}
        conversation={conversationWithPresence}
        isSelected={selectedUser === conversation.conversation_id}
        isCurrentUserConversation={
          conversation.type === 'dm' && conversation.peer_user?.id === currentUserId
        }
        currentUserId={currentUserId}
        isTyping={!!typingUsers[conversation.conversation_id]}
        selectionMode={selectionMode}
        isChecked={selectedIds.includes(conversation.conversation_id)}
        selectionDisabled={
          selectionMode &&
          selectionType !== null &&
          conversation.type !== selectionType &&
          !selectedIds.includes(conversation.conversation_id)
        }
        onSelect={() =>
          selectionMode
            ? toggleSelected(conversation.conversation_id, conversation.type)
            : onSelectConversation(conversation.conversation_id)
        }
        onOpenMenuAtPoint={(event) =>
          onOpenConversationMenuAtPoint(event, conversation.conversation_id, conversation.unread_count ?? 0)
        }
        onOpenMenuAtCoordinates={(point) =>
          onOpenConversationMenuAtCoordinates(point, conversation.conversation_id, conversation.unread_count ?? 0)
        }
      />
    );
  };

  return (
    <>
      <MoveToFolderDialog
        open={bulkFolderDialogOpen}
        onOpenChange={setBulkFolderDialogOpen}
        folders={folders}
        initialFolder={null}
        onSave={(folder) => {
          setBulkFolderDialogOpen(false);
          applyBulkInboxState({ folder });
        }}
      />
      <div
        className={cn(
          'h-full min-h-0 w-full shrink-0 border-r bg-muted/10 md:w-80',
          selectedUser ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile-only top action header: Space switcher, expandable search, and
            the user menu. On desktop these controls live in the vertical rail. */}
        <div className="relative flex h-16 shrink-0 items-center justify-between gap-2 border-b px-3 md:hidden">
          <SpaceSwitcher
            variant="mobile"
            selectedSpaceId={selectedSpaceId}
            onSpaceChange={onSpaceChange}
          />

          <div className="flex flex-1 justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchExpanded(true)}
              title="Search"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMobileUserMenuOpen((current) => !current)}
              aria-expanded={mobileUserMenuOpen}
              aria-label="Account menu"
              className="relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Avatar className="h-9 w-9 border border-border/60">
                {profile?.avatar?.url ? <AvatarImage src={profile.avatar.url} className="object-cover" /> : null}
                <AvatarFallback>
                  {(profile?.display_name || profile?.username || userEmail || '?')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {pendingIncomingCount > 0 ? (
                <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-destructive" />
              ) : null}
            </button>
            {mobileUserMenuOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMobileUserMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border bg-popover p-1.5 shadow-xl shadow-foreground/5">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      onOpenOwnProfile();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <UserRound className="h-4 w-4 shrink-0" />
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      onOpenPings();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <span className="relative flex shrink-0">
                      <Bell className="h-4 w-4" />
                      {pendingIncomingCount > 0 ? (
                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                      ) : null}
                    </span>
                    Pings
                    {pendingIncomingCount > 0 ? (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                        {pendingIncomingCount > 99 ? '99+' : pendingIncomingCount}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      onOpenContacts();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <Contact className="h-4 w-4 shrink-0" />
                    Contacts
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      onOpenSpaces();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    Spaces
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      onOpenFeeds();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <Rss className="h-4 w-4 shrink-0" />
                    Home feed
                  </button>
                  <div className="my-1 border-t opacity-40" />
                  <button
                    type="button"
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Leave
                  </button>
                </div>
              </>
            ) : null}
          </div>

          {/* Expandable full-width search overlay */}
          {searchExpanded ? (
            <div className="absolute inset-0 z-30 flex items-center gap-2 bg-background px-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchExpanded(false)}
                title="Close search"
                aria-label="Close search"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <UserSearch
                autoFocus
                className="mb-0 flex-1"
                onSelectUser={(id) => {
                  setSearchExpanded(false);
                  onSelectSearchUser(id);
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Search bar — sidebar header on desktop; mobile uses the header icon. */}
        <div className="hidden shrink-0 border-b px-4 py-3 md:block">
          <UserSearch onSelectUser={onSelectSearchUser} />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-4 pt-3">
            {sidebarView === 'chats' && (folders.length > 0 || showArchived) ? (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowArchived(false);
                    setActiveFolder(null);
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs',
                    !showArchived && !activeFolder
                      ? 'border-primary/40 bg-primary/5 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  All
                </button>
                {folders.map((folder) => {
                  if (renamingFolder === folder) {
                    return (
                      <span
                        key={folder}
                        className="flex items-center gap-1 rounded-full border border-primary/40 bg-background px-2 py-0.5"
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          maxLength={80}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') submitRename();
                            if (event.key === 'Escape') setRenamingFolder(null);
                          }}
                          className="w-24 bg-transparent text-xs outline-none"
                        />
                        <button
                          type="button"
                          aria-label="Save folder name"
                          onClick={submitRename}
                          disabled={renameFolder.isPending}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Cancel rename"
                          onClick={() => setRenamingFolder(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  }
                  const isActiveFolder = !showArchived && activeFolder === folder;
                  return (
                    <span
                      key={folder}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-3 py-1 text-xs',
                        isActiveFolder
                          ? 'border-primary/40 bg-primary/5 text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowArchived(false);
                          setActiveFolder(folder);
                        }}
                      >
                        {folder}
                      </button>
                      {isActiveFolder ? (
                        <>
                          <button
                            type="button"
                            aria-label={`Rename ${folder}`}
                            onClick={() => {
                              setRenamingFolder(folder);
                              setRenameValue(folder);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${folder}`}
                            onClick={() => handleDeleteFolder(folder)}
                            disabled={deleteFolder.isPending}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            ) : null}

            <div className="mb-2 flex items-center justify-between px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>
                {sidebarView === 'calls'
                  ? 'Calls'
                  : sidebarView === 'threads'
                    ? 'Threads'
                    : showArchived
                      ? 'Archived'
                      : 'Chats'}
              </span>
              {sidebarView === 'chats' ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowArchived((current) => !current);
                    setActiveFolder(null);
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                    showArchived
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Archive className="h-3 w-3" />
                  {showArchived ? 'Back' : 'Archived'}
                </button>
              ) : null}
              {sidebarView === 'chats' ? (
                <button
                  type="button"
                  onClick={() =>
                    selectionMode ? exitSelectionMode() : setSelectionMode(true)
                  }
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                    selectionMode
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {selectionMode ? 'Cancel' : 'Select'}
                </button>
              ) : null}
              <div className="flex items-center gap-2">
                {(sidebarView === 'calls'
                  ? callHistory.length
                  : sidebarView === 'threads'
                    ? threadItems.length
                    : chatContacts.length) > 0 ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {sidebarView === 'calls'
                      ? callHistory.length
                      : sidebarView === 'threads'
                        ? threadItems.length
                        : chatContacts.length}
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

            {sidebarView === 'chats' && selectionMode ? (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-2">
                <span className="mr-auto text-xs font-medium text-muted-foreground">
                  {selectedIds.length} selected
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2.5 text-xs"
                  disabled={selectedIds.length === 0 || setInboxStateBulk.isPending}
                  onClick={() => applyBulkInboxState({ pinned: !showArchived })}
                >
                  <Pin className="mr-1 h-3 w-3" />
                  {showArchived ? 'Unpin' : 'Pin'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2.5 text-xs"
                  disabled={selectedIds.length === 0 || setInboxStateBulk.isPending}
                  onClick={() => setBulkFolderDialogOpen(true)}
                >
                  <FolderInput className="mr-1 h-3 w-3" />
                  Folder
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2.5 text-xs"
                  disabled={selectedIds.length === 0 || setInboxStateBulk.isPending}
                  onClick={() => applyBulkInboxState({ archived: !showArchived })}
                >
                  {showArchived ? (
                    <ArchiveRestore className="mr-1 h-3 w-3" />
                  ) : (
                    <Archive className="mr-1 h-3 w-3" />
                  )}
                  {showArchived ? 'Unarchive' : 'Archive'}
                </Button>
              </div>
            ) : null}
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
                : sidebarView === 'threads'
                  ? threadItems.map((item) => (
                      <ThreadListItem
                        key={item.thread.conversation_id}
                        item={item}
                        isSelected={
                          !!item.parent &&
                          selectedUser === item.parent.conversation_id
                        }
                        onSelect={() => onSelectThread(item)}
                      />
                    ))
                : (
                  <>
                    {groupedConversations.map((group) =>
                      group.items.length > 0 ? (
                        <div key={group.key} className="space-y-2">
                          <div className="mb-1 mt-1 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </div>
                          {group.items.map(renderConversation)}
                        </div>
                      ) : null
                    )}
                  </>
                )}

              {sidebarView === 'chats' && showArchived && archivedQuery.isLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading archived…
                </div>
              ) : null}

              {sidebarView === 'calls' && isLoadingCallHistory ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading call history…
                </div>
              ) : null}

              {sidebarView === 'threads' && threadsQuery.isLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading threads…
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

              {sidebarView === 'threads' && !threadsQuery.isLoading && threadItems.length === 0 ? (
                <div className="m-1 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  No joined threads
                </div>
              ) : null}

              {sidebarView === 'chats' &&
              !(showArchived && archivedQuery.isLoading) &&
              visibleConversations.length === 0 ? (
                <div className="m-1 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  {showArchived
                    ? 'No archived conversations'
                    : activeFolder
                      ? 'No conversations in this folder'
                      : 'No recent conversations'}
                </div>
              ) : null}
            </div>
          </div>

          {/* Mobile-only creation FAB, floating above the bottom navigation. */}
          <div className="absolute bottom-[72px] right-4 z-30 md:hidden">
            {mobileCreateOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMobileCreateOpen(false)} />
                <div className="absolute bottom-full right-0 z-50 mb-2 flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileCreateOpen(false);
                      onNewGroup();
                    }}
                    className="flex w-max items-center gap-2 rounded-full border bg-background py-2 pl-3 pr-4 text-sm font-medium shadow-md transition-colors hover:bg-muted"
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    New Group
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileCreateOpen(false);
                      onNewChannel();
                    }}
                    className="flex w-max items-center gap-2 rounded-full border bg-background py-2 pl-3 pr-4 text-sm font-medium shadow-md transition-colors hover:bg-muted"
                  >
                    <Radio className="h-4 w-4 shrink-0" />
                    New Channel
                  </button>
                </div>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setMobileCreateOpen((current) => !current)}
              aria-expanded={mobileCreateOpen}
              title="New conversation"
              aria-label="New conversation"
              className="relative z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {mobileCreateOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile-only sticky bottom navigation. Desktop uses the action rail. */}
          <nav
            role="tablist"
            aria-label="Views"
            className="flex shrink-0 items-stretch border-t bg-background md:hidden"
          >
            {([
              { value: 'chats', label: 'Chats', icon: MessageSquare },
              { value: 'threads', label: 'Threads', icon: MessageSquareText },
              { value: 'calls', label: 'Calls', icon: Phone },
            ] as const).map((item) => {
              const isActive = sidebarView === item.value;
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSidebarViewChange(item.value)}
                  className={cn(
                    'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        </div>
      </div>
    </>
  );
}
