import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  FolderInput,
  Globe,
  Loader2,
  Pencil,
  Pin,
  Plus,
  Radio,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { PresenceStatus } from '@/api/types';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useChatDialogs } from './ChatDialogsProvider';
import { useConversationActions } from './hooks/useConversationActions';
import { useConversationFolders } from './hooks/useConversationFolders';
import { MoveToFolderDialog } from './components/MoveToFolderDialog';
import { Button } from '@/components/ui/Button';
import { InboxRow } from './components/inbox/InboxRow';
import { InboxRowMenu, type InboxMenuState } from './components/inbox/InboxRowMenu';
import { InboxSection } from './components/inbox/InboxSection';
import { INBOX_SECTION_LABEL, useInboxSections } from './components/inbox/useInboxSections';
import { getConversationLabel } from './components/inbox/inboxPreview';
import { useInboxData, type InboxRowData } from './components/inbox/useInboxData';
import { useInboxSelection } from './components/inbox/useInboxSelection';

type InboxMenuTarget =
  | {
      kind: 'conversation';
      peerUserId: string;
      unreadCount: number;
      conversationType: 'dm' | 'group';
    }
  | { kind: 'channel'; channelId: string; unreadCount: number };

const openMenuAtPoint = (
  setMenu: (menu: InboxMenuState) => void,
  event: ReactMouseEvent<HTMLElement>,
  next: InboxMenuTarget
) => {
  const rect = event.currentTarget.getBoundingClientRect();
  setMenu({ ...next, rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left } });
};

const openMenuAtCoordinates = (
  setMenu: (menu: InboxMenuState) => void,
  point: { x: number; y: number },
  next: InboxMenuTarget
) => {
  setMenu({ ...next, rect: { top: point.y, right: point.x, bottom: point.y, left: point.x } });
};

interface InboxPanelProps {
  className?: string;
  currentUserId: string | null;
  typingUsers: Record<string, boolean>;
  presenceByUserId?: Record<string, PresenceStatus>;
  /**
   * The clear/delete mutations run in `ChatShell`, so their pending state has
   * to come down as props — a second `useConversationLifecycle()` here would be
   * a different mutation instance and its flags would never flip.
   */
  isClearingConversation?: boolean;
  isDeletingConversation?: boolean;
  /** The id of whichever container is currently open, for row highlighting. */
  selectedContainerId: string | null;
  selectedSpaceId: string | null;
  onOpenSpaces: () => void;
  onNewGroup: () => void;
  onNewChannel: () => void;
  onSelectConversation: (row: Extract<InboxRowData, { kind: 'conversation' }>) => void;
  onSelectChannel: (row: Extract<InboxRowData, { kind: 'channel' }>) => void;
}

/**
 * The inbox column: always the chat list. Calls get their own main content, so
 * this frame never needs to know which chat-mode destination is active.
 */
export function InboxPanel({
  className,
  currentUserId,
  typingUsers,
  presenceByUserId = {},
  isClearingConversation = false,
  isDeletingConversation = false,
  selectedContainerId,
  selectedSpaceId,
  onOpenSpaces,
  onNewGroup,
  onNewChannel,
  onSelectConversation,
  onSelectChannel,
}: InboxPanelProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [bulkFolderDialogOpen, setBulkFolderDialogOpen] = useState(false);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
  const [menu, setMenu] = useState<InboxMenuState | null>(null);
  const { isCollapsed, toggleSection } = useInboxSections();
  const isMobile = useIsMobile();

  const { setInboxState, setInboxStateBulk, setNotifications, leaveGroup } =
    useConversationActions();
  const folders = useConversationFolders(true);
  const selection = useInboxSelection();
  const dialogs = useChatDialogs();

  const {
    sections,
    unreadIn,
    conversations,
    channelRows,
    isLoadingArchived,
    channelInbox,
    markConversationRead,
    isEmpty,
    isArchivedEmpty,
  } = useInboxData({ selectedSpaceId, showArchived });

  const applyBulkInboxState = (updates: { pinned?: boolean; archived?: boolean; folder?: string | null }) => {
    if (selection.selectedIds.length === 0) return;
    setInboxStateBulk.mutate(
      { conversationIds: selection.selectedIds, updates },
      { onSuccess: selection.exitSelectionMode }
    );
  };

  /** Rows are keyed by peer id; the mutations need the conversation's own id. */
  const findConversation = (peerUserId: string) =>
    conversations.find((c) => c.conversation_id === peerUserId || c.id === peerUserId) ?? null;

  const menuConversation = menu?.kind === 'conversation' ? findConversation(menu.peerUserId) : null;
  const menuChannelRow =
    menu?.kind === 'channel' ? channelRows.find((row) => row.channel.id === menu.channelId) ?? null : null;

  const renderRow = (row: InboxRowData) => {
    if (row.kind === 'channel') {
      return (
        <InboxRow
          key={row.id}
          row={row}
          isSelected={selectedContainerId === row.id}
          currentUserId={currentUserId}
          isTyping={false}
          onSelect={() => onSelectChannel(row)}
          onOpenMenuAtPoint={(event) => openMenuAtPoint(setMenu, event, { kind: 'channel', channelId: row.id, unreadCount: row.unreadCount })}
          onOpenMenuAtCoordinates={(point) => openMenuAtCoordinates(setMenu, point, { kind: 'channel', channelId: row.id, unreadCount: row.unreadCount })}
        />
      );
    }

    const peerId = row.conversation.peer_user?.id;
    const livePresence = peerId ? presenceByUserId[peerId] : undefined;
    const conversation =
      livePresence && row.conversation.peer_user
        ? {
            ...row.conversation,
            peer_user: {
              ...row.conversation.peer_user,
              is_online: livePresence.is_online,
              presence_state: livePresence.state,
              last_seen_at: livePresence.last_seen_at,
            },
          }
        : row.conversation;

    return (
      <InboxRow
        key={row.id}
        row={{ ...row, conversation }}
        isSelected={selectedContainerId === row.id}
        currentUserId={currentUserId}
        isTyping={!!typingUsers[row.id]}
        selectionMode={selection.selectionMode}
        isChecked={selection.selectedIds.includes(row.id)}
        selectionDisabled={selection.isSelectionDisabledFor(row.conversation.type, row.id)}
        onSelect={() => onSelectConversation(row)}
        onToggleSelected={() => selection.toggleSelected(row.id, row.conversation.type)}
        onOpenMenuAtPoint={(event) =>
          openMenuAtPoint(setMenu, event, {
            kind: 'conversation',
            peerUserId: row.id,
            unreadCount: row.unreadCount,
            conversationType: row.conversation.type,
          })
        }
        onOpenMenuAtCoordinates={(point) =>
          openMenuAtCoordinates(setMenu, point, {
            kind: 'conversation',
            peerUserId: row.id,
            unreadCount: row.unreadCount,
            conversationType: row.conversation.type,
          })
        }
      />
    );
  };

  return (
    <>
      <MoveToFolderDialog
        open={bulkFolderDialogOpen}
        onOpenChange={setBulkFolderDialogOpen}
        folders={folders.folderNames}
        initialFolder={null}
        onSave={(folder) => {
          setBulkFolderDialogOpen(false);
          applyBulkInboxState({ folder });
        }}
      />
      <InboxRowMenu
        menu={menu}
        isMobile={isMobile}
        conversation={menuConversation}
        channelRow={menuChannelRow}
        isUpdatingInbox={setInboxState.isPending}
        isMarkingReadConversation={markConversationRead.isPending}
        isClearingConversation={isClearingConversation}
        isDeletingConversation={isDeletingConversation}
        isUpdatingChannel={channelInbox.setInboxState.isPending || channelInbox.setNotifications.isPending}
        isMarkingReadChannel={channelInbox.markRead.isPending}
        isLeavingChannel={channelInbox.leave.isPending}
        isUpdatingConversationNotifications={setNotifications.isPending}
        isLeavingGroup={leaveGroup.isPending}
        onOpenChange={(open) => {
          if (!open) setMenu(null);
        }}
        onTogglePinConversation={(peerUserId) => {
          const conversation = findConversation(peerUserId);
          if (conversation) {
            setInboxState.mutate({ conversationId: conversation.id, updates: { pinned: !conversation.pinned } });
          }
        }}
        onToggleArchiveConversation={(peerUserId) => {
          const conversation = findConversation(peerUserId);
          if (conversation) {
            setInboxState.mutate({ conversationId: conversation.id, updates: { archived: !conversation.archived } });
          }
        }}
        onCycleConversationNotifications={(peerUserId, level) => {
          const conversation = findConversation(peerUserId);
          if (conversation) {
            setNotifications.mutate({ conversationId: conversation.id, level });
          }
        }}
        onLeaveGroup={(peerUserId) => {
          const conversation = findConversation(peerUserId);
          if (conversation) {
            leaveGroup.mutate(conversation.id);
          }
        }}
        onToggleArchiveChannel={(channelId, archived) => {
          channelInbox.setInboxState.mutate({ channelId, updates: { archived } });
        }}
        onMoveToFolderConversation={() => {
          // Row-level "move to folder" reuses the bulk dialog with a single id.
          if (menuConversation) {
            selection.toggleSelected(menuConversation.conversation_id, menuConversation.type);
            setBulkFolderDialogOpen(true);
          }
        }}
        onMarkAsReadConversation={(peerUserId) => markConversationRead.mutate(peerUserId)}
        onClearConversation={(peerUserId) => {
          const conversation = conversations.find(
            (c) => c.conversation_id === peerUserId || c.id === peerUserId
          );
          dialogs.requestDestructiveAction({
            kind: 'clearConversation',
            peerUserId,
            label: conversation ? getConversationLabel(conversation) : peerUserId,
          });
        }}
        onDeleteConversation={(peerUserId) => {
          const conversation = conversations.find(
            (c) => c.conversation_id === peerUserId || c.id === peerUserId
          );
          dialogs.requestDestructiveAction({
            kind: 'deleteConversation',
            peerUserId,
            label: conversation ? getConversationLabel(conversation) : peerUserId,
          });
        }}
        onTogglePinChannel={(channelId, pinned) =>
          channelInbox.setInboxState.mutate({ channelId, updates: { pinned } })
        }
        onCycleChannelNotifications={(channelId, level) =>
          channelInbox.setNotifications.mutate({ channelId, level })
        }
        onMarkAsReadChannel={(channelId) => channelInbox.markRead.mutate(channelId)}
        onLeaveChannel={(channelId) => channelInbox.leave.mutate(channelId)}
      />

      <div className={cn('h-full min-h-0 w-full shrink-0 border-r bg-muted/10 md:w-80', className)}>
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-4 pt-3">
              {folders.folderNames.length > 0 || showArchived ? (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowArchived(false);
                      folders.setActiveFolder(null);
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs',
                      !showArchived && !folders.activeFolder
                        ? 'border-primary/40 bg-primary/5 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    All
                  </button>
                  {folders.folderNames.map((folder) => {
                    if (folders.renamingFolder === folder) {
                      return (
                        <span
                          key={folder}
                          className="flex items-center gap-1 rounded-full border border-primary/40 bg-background px-2 py-0.5"
                        >
                          <input
                            autoFocus
                            value={folders.renameValue}
                            maxLength={80}
                            onChange={(event) => folders.setRenameValue(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') folders.submitRenamingFolder();
                              if (event.key === 'Escape') folders.cancelRenamingFolder();
                            }}
                            className="w-24 bg-transparent text-xs outline-none"
                          />
                          <button
                            type="button"
                            aria-label="Save folder name"
                            onClick={folders.submitRenamingFolder}
                            disabled={folders.isRenamingFolder}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="Cancel rename"
                            onClick={folders.cancelRenamingFolder}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    }
                    const isActiveFolder = !showArchived && folders.activeFolder === folder;
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
                            folders.setActiveFolder(folder);
                          }}
                        >
                          {folder}
                        </button>
                        {isActiveFolder ? (
                          <>
                            <button
                              type="button"
                              aria-label={`Rename ${folder}`}
                              onClick={() => folders.startRenamingFolder(folder)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${folder}`}
                              onClick={() => folders.removeFolder(folder)}
                              disabled={folders.isDeletingFolder}
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
                <span>{showArchived ? 'Archived' : 'Chats'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowArchived((current) => !current);
                    folders.setActiveFolder(null);
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                    showArchived ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Archive className="h-3 w-3" />
                  {showArchived ? 'Back' : 'Archived'}
                </button>
                <button
                  type="button"
                  onClick={selection.toggleSelectionMode}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                    selection.selectionMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {selection.selectionMode ? 'Cancel' : 'Select'}
                </button>
                <div className="flex items-center gap-2">
                  {conversations.length + channelRows.length > 0 ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {conversations.length + channelRows.length}
                    </span>
                  ) : null}
                </div>
              </div>

              {selection.selectionMode ? (
                <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-2">
                  <span className="mr-auto text-xs font-medium text-muted-foreground">
                    {selection.selectedIds.length} selected
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2.5 text-xs"
                    disabled={selection.selectedIds.length === 0 || setInboxStateBulk.isPending}
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
                    disabled={selection.selectedIds.length === 0 || setInboxStateBulk.isPending}
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
                    disabled={selection.selectedIds.length === 0 || setInboxStateBulk.isPending}
                    onClick={() => applyBulkInboxState({ archived: !showArchived })}
                  >
                    {showArchived ? <ArchiveRestore className="mr-1 h-3 w-3" /> : <Archive className="mr-1 h-3 w-3" />}
                    {showArchived ? 'Unarchive' : 'Archive'}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
              <div className="space-y-2 pb-4 pr-1">
                <div className="space-y-3">
                  <InboxSection
                    label={INBOX_SECTION_LABEL.pinned}
                    count={sections.pinned.length}
                    unreadCount={unreadIn(sections.pinned)}
                    isCollapsed={isCollapsed('pinned')}
                    onToggle={() => toggleSection('pinned')}
                  >
                    {sections.pinned.map(renderRow)}
                  </InboxSection>

                  <InboxSection
                    label={INBOX_SECTION_LABEL.channels}
                    count={sections.channels.length}
                    unreadCount={unreadIn(sections.channels)}
                    isCollapsed={isCollapsed('channels')}
                    onToggle={() => toggleSection('channels')}
                  >
                    {sections.channels.map(renderRow)}
                  </InboxSection>

                  <InboxSection
                    label={INBOX_SECTION_LABEL.groups}
                    count={sections.groups.length}
                    unreadCount={unreadIn(sections.groups)}
                    isCollapsed={isCollapsed('groups')}
                    onToggle={() => toggleSection('groups')}
                  >
                    {sections.groups.map(renderRow)}
                  </InboxSection>

                  <InboxSection
                    label={INBOX_SECTION_LABEL.direct}
                    count={sections.direct.length}
                    unreadCount={unreadIn(sections.direct)}
                    isCollapsed={isCollapsed('direct')}
                    onToggle={() => toggleSection('direct')}
                  >
                    {sections.direct.map(renderRow)}
                  </InboxSection>
                </div>

                {showArchived && isLoadingArchived ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading archived…
                  </div>
                ) : null}

                {!(showArchived && isLoadingArchived) && (showArchived ? isArchivedEmpty : isEmpty) ? (
                  <div className="m-1 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                    {showArchived
                      ? 'No archived conversations'
                      : folders.activeFolder
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
                    <button
                      type="button"
                      onClick={() => {
                        setMobileCreateOpen(false);
                        onOpenSpaces();
                      }}
                      className="flex w-max items-center gap-2 rounded-full border bg-background py-2 pl-3 pr-4 text-sm font-medium shadow-md transition-colors hover:bg-muted"
                    >
                      <Globe className="h-4 w-4 shrink-0 text-primary" />
                      New Space
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
                className="relative z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-brand text-brand-foreground shadow-e2 transition-colors hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {mobileCreateOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
