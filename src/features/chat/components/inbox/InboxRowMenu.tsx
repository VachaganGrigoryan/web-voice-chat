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

export type InboxMenuState =
  | { readonly kind: 'conversation'; readonly peerUserId: string; readonly unreadCount: number; readonly rect: ContextMenuRect }
  | { readonly kind: 'channel'; readonly channelId: string; readonly rect: ContextMenuRect };

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
  isUpdatingChannel: boolean;
  isMarkingReadChannel: boolean;
  isLeavingChannel: boolean;
  onOpenChange: (open: boolean) => void;
  onTogglePinConversation: (peerUserId: string) => void | Promise<void>;
  onToggleArchiveConversation: (peerUserId: string) => void | Promise<void>;
  onMoveToFolderConversation: (peerUserId: string) => void;
  onMarkAsReadConversation: (peerUserId: string) => void | Promise<void>;
  onClearConversation: (peerUserId: string) => void | Promise<void>;
  onDeleteConversation: (peerUserId: string) => void | Promise<void>;
  onTogglePinChannel: (channelId: string, pinned: boolean) => void | Promise<void>;
  onCycleChannelNotifications: (channelId: string, level: NotificationLevel) => void | Promise<void>;
  onMarkAsReadChannel: (channelId: string) => void | Promise<void>;
  onLeaveChannel: (channelId: string) => void | Promise<void>;
}

/**
 * The one row context menu for the inbox, merging the conversation and channel
 * action menus that used to be separate components. They existed as two files
 * only because there was no unified row model to key off of.
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
  isUpdatingChannel,
  isMarkingReadChannel,
  isLeavingChannel,
  onOpenChange,
  onTogglePinConversation,
  onToggleArchiveConversation,
  onMoveToFolderConversation,
  onMarkAsReadConversation,
  onClearConversation,
  onDeleteConversation,
  onTogglePinChannel,
  onCycleChannelNotifications,
  onMarkAsReadChannel,
  onLeaveChannel,
}: InboxRowMenuProps) {
  if (!menu) return null;

  const close = () => onOpenChange(false);

  if (menu.kind === 'conversation') {
    if (!conversation) return null;

    const clearDisabled = isClearingConversation || isDeletingConversation;
    const deleteDisabled = isDeletingConversation || isClearingConversation;

    return (
      <ContextMenuPanel
        rect={menu.rect}
        isMobile={isMobile}
        onOpenChange={onOpenChange}
        ariaLabel="Conversation actions"
      >
        <ContextMenuItem
          icon={conversation.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          label={conversation.pinned ? 'Unpin chat' : 'Pin chat'}
          hint={
            conversation.pinned
              ? 'Remove this chat from the pinned section.'
              : 'Keep this chat at the top of your inbox.'
          }
          busy={isUpdatingInbox}
          onSelect={() => {
            void onTogglePinConversation(menu.peerUserId);
            close();
          }}
        />
        <ContextMenuItem
          icon={conversation.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          label={conversation.archived ? 'Unarchive chat' : 'Archive chat'}
          hint={conversation.archived ? 'Move this chat back to your main inbox.' : 'Hide this chat in your archive.'}
          busy={isUpdatingInbox}
          onSelect={() => {
            void onToggleArchiveConversation(menu.peerUserId);
            close();
          }}
        />
        <ContextMenuItem
          icon={<FolderInput className="h-4 w-4" />}
          label="Move to folder…"
          hint="Organize this chat into a folder."
          busy={isUpdatingInbox}
          onSelect={() => {
            onMoveToFolderConversation(menu.peerUserId);
            close();
          }}
        />

        <div className="my-1 border-t border-border/60" />

        <ContextMenuItem
          icon={<CheckCheck className="h-4 w-4" />}
          label="Mark as read"
          hint={
            menu.unreadCount > 0
              ? `Mark ${menu.unreadCount} unread message${menu.unreadCount === 1 ? '' : 's'} as read.`
              : 'This chat is already up to date.'
          }
          disabled={menu.unreadCount === 0}
          busy={isMarkingReadConversation}
          onSelect={() => {
            void onMarkAsReadConversation(menu.peerUserId);
            close();
          }}
        />
        <ContextMenuItem
          icon={<Trash2 className="h-4 w-4" />}
          label="Clear chat"
          hint="Remove your message history in this chat, but keep the conversation available."
          disabled={clearDisabled}
          busy={isClearingConversation}
          onSelect={() => {
            void onClearConversation(menu.peerUserId);
            close();
          }}
        />
        <ContextMenuItem
          icon={<Trash2 className="h-4 w-4" />}
          label="Delete chat"
          hint="Remove this chat and delete the ping between both users. The other side may still see a ghost chat until they ping again."
          disabled={deleteDisabled}
          busy={isDeletingConversation}
          destructive
          onSelect={() => {
            void onDeleteConversation(menu.peerUserId);
            close();
          }}
        />
      </ContextMenuPanel>
    );
  }

  if (!channelRow) return null;

  const { state, unread_count: unreadCount } = channelRow;
  const level = state.notification_level;
  const NotificationIcon = NOTIFICATION_ICON[level];
  const nextLevel = nextNotificationLevel(level);

  return (
    <ContextMenuPanel
      rect={menu.rect}
      isMobile={isMobile}
      onOpenChange={onOpenChange}
      ariaLabel={`Actions for ${channelRow.channel.name}`}
    >
      <ContextMenuItem
        icon={state.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        label={state.pinned ? 'Unpin channel' : 'Pin channel'}
        hint={
          state.pinned
            ? 'Remove this channel from the pinned section.'
            : 'Keep this channel at the top of your inbox.'
        }
        busy={isUpdatingChannel}
        onSelect={() => {
          void onTogglePinChannel(menu.channelId, !state.pinned);
          close();
        }}
      />
      <ContextMenuItem
        icon={<NotificationIcon className="h-4 w-4" />}
        label={`Notifications: ${NOTIFICATION_LABEL[level]}`}
        hint={`Switch to "${NOTIFICATION_LABEL[nextLevel]}".`}
        busy={isUpdatingChannel}
        onSelect={() => {
          void onCycleChannelNotifications(menu.channelId, nextLevel);
          close();
        }}
      />
      <ContextMenuItem
        icon={<CheckCheck className="h-4 w-4" />}
        label="Mark as read"
        hint={
          unreadCount > 0
            ? `Mark ${unreadCount} unread message${unreadCount === 1 ? '' : 's'} as read.`
            : 'This channel is already up to date.'
        }
        disabled={unreadCount === 0}
        busy={isMarkingReadChannel}
        onSelect={() => {
          void onMarkAsReadChannel(menu.channelId);
          close();
        }}
      />

      <div className="my-1 border-t border-border/60" />

      <ContextMenuItem
        icon={<LogOut className="h-4 w-4" />}
        label={channelRow.joined ? 'Leave channel' : 'Unfollow channel'}
        hint={
          channelRow.joined
            ? 'Remove this channel from your inbox. You can rejoin later.'
            : 'Stop following this channel.'
        }
        destructive
        busy={isLeavingChannel}
        onSelect={() => {
          void onLeaveChannel(menu.channelId);
          close();
        }}
      />
    </ContextMenuPanel>
  );
}
