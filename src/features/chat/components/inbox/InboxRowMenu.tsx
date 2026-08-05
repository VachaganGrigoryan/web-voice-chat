import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  FolderInput,
  LogOut,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import type { ChannelInboxRow, Conversation, NotificationLevel } from '@/api/types';
import { ContextMenuItem, ContextMenuPanel, type ContextMenuRect } from './contextMenuShell';
import {
  INBOX_MENU_SEPARATORS_AFTER,
  buildInboxMenuItemIds,
  type InboxMenuItemId,
  type InboxRowKind,
} from './inboxMenuItems';

export type InboxMenuState =
  | {
      readonly kind: 'conversation';
      readonly peerUserId: string;
      readonly unreadCount: number;
      /** Drives the leave gate: a DM is deleted, not left. */
      readonly conversationType: 'dm' | 'group';
      readonly rect: ContextMenuRect;
    }
  | {
      readonly kind: 'channel';
      readonly channelId: string;
      readonly unreadCount: number;
      readonly rect: ContextMenuRect;
    };

/** all → mentions → none → all, matching the conversation notification cycle. */
const nextNotificationLevel = (level: NotificationLevel): NotificationLevel =>
  level === 'all' ? 'mentions' : level === 'mentions' ? 'none' : 'all';

const NOTIFICATION_LABEL: Record<NotificationLevel, string> = {
  all: 'All messages',
  mentions: 'Mentions only',
  none: 'Muted',
};

const NOTIFICATION_ICON: Record<NotificationLevel, typeof Bell> = {
  all: BellRing,
  mentions: Bell,
  none: BellOff,
};

interface InboxRowMenuProps {
  menu: InboxMenuState | null;
  isMobile: boolean;
  conversation: Conversation | null;
  channelRow: ChannelInboxRow | null;
  isUpdatingInbox: boolean;
  isMarkingReadConversation: boolean;
  isClearingConversation: boolean;
  isDeletingConversation: boolean;
  isUpdatingConversationNotifications: boolean;
  isLeavingGroup: boolean;
  isUpdatingChannel: boolean;
  isMarkingReadChannel: boolean;
  isLeavingChannel: boolean;
  onOpenChange: (open: boolean) => void;
  onTogglePinConversation: (peerUserId: string) => void | Promise<void>;
  onToggleArchiveConversation: (peerUserId: string) => void | Promise<void>;
  onMoveToFolderConversation: (peerUserId: string) => void;
  onCycleConversationNotifications: (
    peerUserId: string,
    level: NotificationLevel
  ) => void | Promise<void>;
  onMarkAsReadConversation: (peerUserId: string) => void | Promise<void>;
  onClearConversation: (peerUserId: string) => void | Promise<void>;
  onLeaveGroup: (peerUserId: string) => void | Promise<void>;
  onDeleteConversation: (peerUserId: string) => void | Promise<void>;
  onTogglePinChannel: (channelId: string, pinned: boolean) => void | Promise<void>;
  onToggleArchiveChannel: (channelId: string, archived: boolean) => void | Promise<void>;
  onCycleChannelNotifications: (
    channelId: string,
    level: NotificationLevel
  ) => void | Promise<void>;
  onMarkAsReadChannel: (channelId: string) => void | Promise<void>;
  onLeaveChannel: (channelId: string) => void | Promise<void>;
}

/** What one rendered row of the menu needs. */
interface MenuEntry {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly hint: string;
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
  readonly onSelect: () => void;
}

/**
 * The one row context menu for the inbox.
 *
 * Which items appear is decided by `inboxMenuItems.ts` from the row kind; this
 * component only builds the concrete entry for each allowed id. The two
 * hand-maintained branches it replaced are why a conversation had no
 * notification control and no leave, and a channel had no archive even though
 * `channelsApi.setInboxState` accepts one.
 */
export function InboxRowMenu({
  menu,
  isMobile,
  conversation,
  channelRow,
  isUpdatingInbox,
  isMarkingReadConversation,
  isClearingConversation,
  isDeletingConversation,
  isUpdatingConversationNotifications,
  isLeavingGroup,
  isUpdatingChannel,
  isMarkingReadChannel,
  isLeavingChannel,
  onOpenChange,
  onTogglePinConversation,
  onToggleArchiveConversation,
  onMoveToFolderConversation,
  onCycleConversationNotifications,
  onMarkAsReadConversation,
  onClearConversation,
  onLeaveGroup,
  onDeleteConversation,
  onTogglePinChannel,
  onToggleArchiveChannel,
  onCycleChannelNotifications,
  onMarkAsReadChannel,
  onLeaveChannel,
}: InboxRowMenuProps) {
  if (!menu) return null;

  const isConversation = menu.kind === 'conversation';
  if (isConversation && !conversation) return null;
  if (!isConversation && !channelRow) return null;

  const close = () => onOpenChange(false);
  const kind: InboxRowKind = isConversation ? menu.conversationType : 'channel';
  const allowedIds = buildInboxMenuItemIds({ kind, hasConversationOnly: isConversation });

  const pinned = isConversation ? !!conversation?.pinned : !!channelRow?.state.pinned;
  const archived = isConversation ? !!conversation?.archived : !!channelRow?.state.archived;
  const level: NotificationLevel = isConversation
    ? conversation?.notification_level ?? 'all'
    : channelRow?.state.notification_level ?? 'all';
  const nextLevel = nextNotificationLevel(level);
  const NotificationIcon = NOTIFICATION_ICON[level];
  const noun = isConversation ? 'chat' : 'channel';
  const inboxBusy = isConversation ? isUpdatingInbox : isUpdatingChannel;

  const entryFor = (id: InboxMenuItemId): MenuEntry | null => {
    switch (id) {
      case 'pin':
        return {
          icon: pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />,
          label: pinned ? `Unpin ${noun}` : `Pin ${noun}`,
          hint: pinned
            ? `Remove this ${noun} from the pinned section.`
            : `Keep this ${noun} at the top of your inbox.`,
          busy: inboxBusy,
          onSelect: () =>
            isConversation
              ? void onTogglePinConversation(menu.peerUserId)
              : void onTogglePinChannel(menu.channelId, !pinned),
        };

      case 'archive':
        return {
          icon: archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />,
          label: archived ? `Unarchive ${noun}` : `Archive ${noun}`,
          hint: archived
            ? `Move this ${noun} back to your main inbox.`
            : `Hide this ${noun} in your archive.`,
          busy: inboxBusy,
          onSelect: () =>
            isConversation
              ? void onToggleArchiveConversation(menu.peerUserId)
              : void onToggleArchiveChannel(menu.channelId, !archived),
        };

      case 'folder':
        if (!isConversation) return null;
        return {
          icon: <FolderInput className="h-4 w-4" />,
          label: 'Move to folder…',
          hint: 'Organize this chat into a folder.',
          busy: isUpdatingInbox,
          onSelect: () => onMoveToFolderConversation(menu.peerUserId),
        };

      case 'notifications':
        return {
          icon: <NotificationIcon className="h-4 w-4" />,
          label: `Notifications: ${NOTIFICATION_LABEL[level]}`,
          hint: `Switch to "${NOTIFICATION_LABEL[nextLevel]}".`,
          busy: isConversation ? isUpdatingConversationNotifications : isUpdatingChannel,
          onSelect: () =>
            isConversation
              ? void onCycleConversationNotifications(menu.peerUserId, nextLevel)
              : void onCycleChannelNotifications(menu.channelId, nextLevel),
        };

      case 'mark_read':
        return {
          icon: <CheckCheck className="h-4 w-4" />,
          label: 'Mark as read',
          hint:
            menu.unreadCount > 0
              ? `Mark ${menu.unreadCount} unread message${menu.unreadCount === 1 ? '' : 's'} as read.`
              : `This ${noun} is already up to date.`,
          disabled: menu.unreadCount === 0,
          busy: isConversation ? isMarkingReadConversation : isMarkingReadChannel,
          onSelect: () =>
            isConversation
              ? void onMarkAsReadConversation(menu.peerUserId)
              : void onMarkAsReadChannel(menu.channelId),
        };

      case 'clear':
        if (!isConversation) return null;
        return {
          icon: <Trash2 className="h-4 w-4" />,
          label: 'Clear chat',
          hint: 'Remove your message history in this chat, but keep the conversation available.',
          disabled: isClearingConversation || isDeletingConversation,
          busy: isClearingConversation,
          onSelect: () => void onClearConversation(menu.peerUserId),
        };

      case 'leave':
        return {
          icon: <LogOut className="h-4 w-4" />,
          label: isConversation
            ? 'Leave group'
            : channelRow?.joined
              ? 'Leave channel'
              : 'Unfollow channel',
          hint: isConversation
            ? 'Remove yourself from this group. You will stop receiving its messages.'
            : channelRow?.joined
              ? 'Remove this channel from your inbox. You can rejoin later.'
              : 'Stop following this channel.',
          destructive: true,
          busy: isConversation ? isLeavingGroup : isLeavingChannel,
          onSelect: () =>
            isConversation
              ? void onLeaveGroup(menu.peerUserId)
              : void onLeaveChannel(menu.channelId),
        };

      case 'delete':
        if (!isConversation) return null;
        return {
          icon: <Trash2 className="h-4 w-4" />,
          label: 'Delete chat',
          hint: 'Remove this chat and delete the ping between both users. The other side may still see a ghost chat until they ping again.',
          disabled: isDeletingConversation || isClearingConversation,
          busy: isDeletingConversation,
          destructive: true,
          onSelect: () => void onDeleteConversation(menu.peerUserId),
        };

      default: {
        const exhaustive: never = id;
        return exhaustive;
      }
    }
  };

  const rendered = allowedIds
    .map((id) => ({ id, entry: entryFor(id) }))
    .filter((row): row is { id: InboxMenuItemId; entry: MenuEntry } => row.entry !== null);

  return (
    <ContextMenuPanel
      rect={menu.rect}
      isMobile={isMobile}
      onOpenChange={onOpenChange}
      ariaLabel={
        isConversation ? 'Conversation actions' : `Actions for ${channelRow?.channel.name ?? 'channel'}`
      }
    >
      {rendered.map(({ id, entry }, index) => (
        <div key={id}>
          <ContextMenuItem
            icon={entry.icon}
            label={entry.label}
            hint={entry.hint}
            busy={entry.busy}
            disabled={entry.disabled}
            destructive={entry.destructive}
            onSelect={() => {
              entry.onSelect();
              close();
            }}
          />
          {INBOX_MENU_SEPARATORS_AFTER.has(id) && index < rendered.length - 1 ? (
            <div className="my-1 border-t border-border/60" />
          ) : null}
        </div>
      ))}
    </ContextMenuPanel>
  );
}
