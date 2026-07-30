import {
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useRef,
} from 'react';
import {
  BarChart3,
  Bell,
  BellOff,
  Check,
  Hash,
  Image as ImageIcon,
  Link2,
  MapPin,
  Megaphone,
  Mic,
  Music,
  Paperclip,
  Pin,
  UserRound,
  Video,
} from 'lucide-react';
import { PresenceDot, resolvePresenceState } from '@/components/presence/PresenceDot';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/haptics';
import type { InboxRowData } from './useInboxData';
import { formatConversationTimestamp, getConversationLabel, isChannelRowMuted, resolveConversationPreview } from './inboxPreview';

const PREVIEW_ICON = {
  audio: Music,
  voice: Mic,
  file: Paperclip,
  poll: BarChart3,
  location: MapPin,
  contact: UserRound,
  link: Link2,
  image: ImageIcon,
  video: Video,
} as const;

// Threshold in px beyond which a touch counts as a scroll and cancels the
// long-press; hold duration that triggers the mobile context menu.
const LONG_PRESS_MOVE_THRESHOLD = 10;
const LONG_PRESS_DURATION_MS = 500;

interface InboxRowProps {
  row: InboxRowData;
  isSelected: boolean;
  currentUserId: string | null;
  isTyping: boolean;
  selectionMode?: boolean;
  isChecked?: boolean;
  selectionDisabled?: boolean;
  onSelect: () => void;
  onToggleSelected?: () => void;
  onOpenMenuAtPoint: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenMenuAtCoordinates: (point: { x: number; y: number }) => void;
}

/**
 * The one row component for the inbox column, rendering both container types.
 * A channel has no peer, so a presence dot and DM avatar fallback would both be
 * meaningless there; everything else — pin/mute badges, unread count, preview,
 * long-press menu — is shared.
 */
export function InboxRow({
  row,
  isSelected,
  currentUserId,
  isTyping,
  selectionMode = false,
  isChecked = false,
  selectionDisabled = false,
  onSelect,
  onToggleSelected,
  onOpenMenuAtPoint,
  onOpenMenuAtCoordinates,
}: InboxRowProps) {
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
    if (selectionMode && row.kind !== 'conversation') return;
    if (selectionDisabled) return;
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
    if (selectionMode && row.kind === 'conversation' && onToggleSelected) {
      onToggleSelected();
      return;
    }
    onSelect();
  };

  if (row.kind === 'channel') {
    const { channel, state, unread_count: unreadCount } = row.channelRow;
    const KindIcon = channel.kind === 'announcement' ? Megaphone : Hash;
    const muted = isChannelRowMuted(row.channelRow);

    return (
      <div
        className={cn(
          'group relative w-full min-w-0 overflow-hidden rounded-2xl border p-1.5 transition-all',
          isSelected
            ? 'border-brand/25 bg-background/95 shadow-e1 ring-1 ring-brand/10'
            : 'border-border/60 bg-background/75 shadow-e1 hover:border-border/80 hover:bg-background/95'
        )}
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenMenuAtPoint(event);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <button
          type="button"
          onClick={handleClick}
          className="flex w-full min-w-0 max-w-full cursor-pointer items-center gap-3 rounded-[18px] px-2.5 py-2 text-left transition-colors"
        >
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60',
              row.channelRow.joined ? 'bg-brand-muted text-brand' : 'bg-muted text-muted-foreground'
            )}
          >
            <KindIcon className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <span
                className={cn(
                  'truncate pr-1 text-left text-sm',
                  unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
                )}
              >
                {state.pinned ? (
                  <Pin className="mr-1 inline h-3 w-3 -translate-y-px fill-current text-brand" />
                ) : null}
                {muted ? (
                  <BellOff className="mr-1 inline h-3 w-3 -translate-y-px text-muted-foreground" />
                ) : state.notification_level === 'mentions' ? (
                  <Bell className="mr-1 inline h-3 w-3 -translate-y-px text-brand" />
                ) : null}
                {channel.name}
              </span>
              {!row.channelRow.joined ? (
                <span className="shrink-0 rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Following
                </span>
              ) : null}
            </div>

            <div className="mt-1 flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-left text-xs',
                  unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {channel.description?.trim() ||
                  (channel.visibility === 'public' ? 'Public channel' : 'Space members')}
              </span>
              {unreadCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-3xs font-bold text-brand-foreground shadow-e1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </div>
          </div>
        </button>
      </div>
    );
  }

  const conversation = row.conversation;
  const conversationLabel = getConversationLabel(conversation);
  // Groups carry their own image; reading only `peer_user` left every group with
  // a bare letter fallback.
  const avatarUrl =
    conversation.type === 'group' ? conversation.image?.url : conversation.peer_user?.avatar?.url;
  // Presence describes a person, so it applies to DMs only.
  const presenceState = conversation.type === 'dm' ? resolvePresenceState(conversation.peer_user) : 'offline';
  const isGhost = !!conversation.peer_user?.is_ghost;
  const preview = resolveConversationPreview(conversation, currentUserId);
  const PreviewIcon = preview.kind === 'icon' ? PREVIEW_ICON[preview.icon] : null;

  return (
    <div
      className={cn(
        'group relative w-full min-w-0 overflow-hidden rounded-2xl border p-1.5 transition-all',
        (selectionMode ? isChecked : isSelected)
          ? 'border-primary/20 bg-background/95 shadow-sm ring-1 ring-primary/10'
          : 'border-border/60 bg-background/75 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-border/80 hover:bg-background/95 hover:shadow-sm',
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
              isChecked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
            )}
          >
            {isChecked ? <Check className="h-3 w-3" /> : null}
          </span>
        ) : null}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 border border-border/60 bg-background">
            {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
            <AvatarFallback>{(conversationLabel[0] || '?').toUpperCase()}</AvatarFallback>
          </Avatar>
          <PresenceDot state={presenceState} anchored />
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
                <Pin className="mr-1 inline h-3 w-3 -translate-y-px fill-current text-brand" />
              ) : null}
              {conversation.notification_level === 'none' ||
              (conversation.muted_until && new Date(conversation.muted_until).getTime() > Date.now()) ? (
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
              ) : preview.kind === 'text' ? (
                preview.text
              ) : (
                <span className="inline-flex items-center gap-1 align-middle">
                  {PreviewIcon ? <PreviewIcon className="h-3 w-3 shrink-0" /> : null}
                  {preview.label}
                </span>
              )}
            </span>
            {conversation.unread_count > 0 ? (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-3xs font-bold text-brand-foreground shadow-e1">
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </div>
  );
}
