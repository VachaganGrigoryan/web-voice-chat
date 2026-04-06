import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useChat, useConversations, useThreadMessages } from '@/hooks/useChat';
import { useCallHistory } from '@/hooks/useCallHistory';
import { usePings } from '@/hooks/usePings';
import { APP_ROUTES } from '@/app/routes';
import { extractApiError } from '@/api/errors';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/endpoints';
import { toast } from 'sonner';
import ChatComposer from './composer';
import { useChatAudioPlayerStore } from './media/players/audioPlayerStore';
import { MediaViewer } from './media/MediaViewer';
import { CallHistoryActionsMenu, CallHistoryMenuState } from './components/CallHistoryActionsMenu';
import { ConfirmDestructiveActionDialog } from './components/ConfirmDestructiveActionDialog';
import { MessageActionsDialog } from './components/MessageActionsDialog';
import { ThreadPanel } from './components/ThreadPanel';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatWelcomeState } from './components/ChatWelcomeState';
import { ConversationAccessState } from './components/ConversationAccessState';
import {
  ConversationActionsMenu,
} from './components/ConversationActionsMenu';
import { ChatHeader } from './components/ChatHeader';
import { MainChatPane } from './components/MainChatPane';
import { cn } from '@/lib/utils';
import { useTypingIndicator, useSocketStore } from '@/socket/socket';
import { useProfile } from '@/hooks/useProfile';
import { useChatLayoutDerivedData } from './hooks/useChatLayoutDerivedData';
import { useChatConversationView } from './hooks/useChatConversationView';
import { NotificationSoundPrompt } from './components/NotificationSoundPrompt';
import {
  closedMediaViewerState,
  useChatInteractionState,
} from './hooks/useChatInteractionState';
import { useChatReadState } from './hooks/useChatReadState';
import { useThreadPanelLayout } from './hooks/useThreadPanelLayout';
import { startCall, useCallStore } from '@/features/calls/callController';
import { useNotificationSoundStore } from '@/utils/notificationSound';

type SidebarDestructiveAction =
  | { kind: 'clearConversation'; peerUserId: string; label: string }
  | { kind: 'deleteConversation'; peerUserId: string; label: string }
  | { kind: 'clearCallHistoryPeer'; peerUserId: string; label: string }
  | { kind: 'clearCallHistoryAll' };

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function ChatLayout() {
  const { peerUserId, rootMessageId } = useParams<{
    peerUserId?: string;
    rootMessageId?: string;
  }>();
  const selectedUser = peerUserId || null;
  const selectedThreadRootId = rootMessageId || null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarView, setSidebarView] = useState<'chats' | 'calls'>('chats');
  const [callHistoryMenu, setCallHistoryMenu] = useState<CallHistoryMenuState | null>(null);
  const [pendingDestructiveAction, setPendingDestructiveAction] = useState<SidebarDestructiveAction | null>(null);

  const {
    onlineUsers,
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sendVoice,
    sendText,
    editMessage,
    deleteMessage,
    clearConversation,
    deleteConversation,
    toggleReaction,
    isSending,
    isEditingMessage,
    isDeletingMessage,
    isClearingConversation,
    isDeletingConversation,
    isTogglingReaction,
  } = useChat(selectedUser, selectedThreadRootId);

  const { data: conversationsData } = useConversations();
  const conversations = useMemo(
    () => conversationsData?.pages.flatMap((page) => page.data || []).filter(Boolean) || [],
    [conversationsData]
  );
  const {
    history: callHistory,
    fetchNextPage: fetchNextCallHistoryPage,
    hasNextPage: hasNextCallHistoryPage,
    isFetchingNextPage: isFetchingNextCallHistoryPage,
    isLoading: isLoadingCallHistory,
    deleteHistory,
    isDeletingHistory,
  } = useCallHistory({
    enabled: sidebarView === 'calls',
  });

  const { userEmail, userId, logout, refreshToken } = useAuthStore();
  const { profile } = useProfile();
  const { socket } = useSocketStore();
  const callPhase = useCallStore((state) => state.phase);
  const soundEnabled = useNotificationSoundStore((state) => state.soundEnabled);
  const soundCapability = useNotificationSoundStore((state) => state.soundCapability);
  const soundPromptDismissed = useNotificationSoundStore((state) => state.soundPromptDismissed);
  const isEnablingSound = useNotificationSoundStore((state) => state.isEnablingSound);
  const enableSoundFromUserGesture = useNotificationSoundStore((state) => state.enableSoundFromUserGesture);
  const dismissSoundPrompt = useNotificationSoundStore((state) => state.dismissSoundPrompt);
  const {
    incoming,
    outgoing,
    sendPing,
    acceptPing,
    declinePing,
    isSending: isSendingPing,
    isAccepting: isAcceptingPing,
    isDeclining: isDecliningPing,
  } = usePings();
  const syncAudioQueue = useChatAudioPlayerStore((state) => state.syncQueue);
  const closeAudioPlayer = useChatAudioPlayerStore((state) => state.close);
  const { isTyping, typingUsers } = useTypingIndicator(selectedUser || undefined);

  const {
    pendingIncomingCount,
    contacts,
    selectedUserSummary,
    incomingPing,
    pingStatus,
    isPingAccepted,
    selectedConversationUser,
    displaySelectedUser,
    isSelectedConversationGhost,
  } = useChatLayoutDerivedData({
    conversations,
    incoming,
    outgoing,
    selectedUser,
  });
  const isCallBusy = callPhase !== 'idle';

  const {
    data: threadMessagesPages,
    fetchNextPage: fetchNextThreadPage,
    hasNextPage: hasNextThreadPage,
    isFetchingNextPage: isFetchingNextThreadPage,
    isLoading: isLoadingThread,
  } = useThreadMessages(selectedThreadRootId);

  const {
    mainChatMessages,
    mainChatRenderItems,
    selectedThreadRootMessage,
    threadReplyMessages,
    threadRenderItems,
    mainAudioQueueKey,
    mainAudioQueue,
    threadAudioQueueKey,
    threadAudioQueue,
    mainImageGallery,
    threadImageGallery,
  } = useChatConversationView({
    messages,
    threadMessagesPages,
    userId,
    selectedUser,
    selectedThreadRootId,
  });

  const {
    splitLayoutRef,
    isMobileViewport,
    isResizingThread,
    threadPanelWidth,
    setThreadPanelMode,
    handleResizeHandleMouseDown,
  } = useThreadPanelLayout({
    selectedUser,
    selectedThreadRootId,
    isLayoutActive: !!selectedUser && isPingAccepted,
  });

  const {
    mediaViewer,
    setMediaViewer,
    activeMessage,
    activeMessageAnchor,
    conversationMenu,
    replyTarget,
    threadReplyTarget,
    setReplyTarget,
    setThreadReplyTarget,
    setConversationMenu,
    closeMessageMenu,
    openMessageMenu,
    handleSelectReplyMode,
    openThreadForMessage,
    handleSendText,
    handleSendThreadText,
    handleSendMedia,
    handleSendThreadMedia,
    handleEditMessage,
    handleDeleteMessage,
    handleToggleReaction,
    handleMainMediaClick,
    handleThreadMediaClick,
    openConversationMenu,
    openConversationMenuAtPoint,
  } = useChatInteractionState({
    selectedUser,
    selectedThreadRootId,
    displaySelectedUser,
    isMobileViewport,
    mainImageGallery,
    threadImageGallery,
    navigateToConversation: (peerId, threadRootId) =>
      navigate(
        threadRootId ? APP_ROUTES.chatThread(peerId, threadRootId) : APP_ROUTES.chatPeer(peerId)
      ),
    openThreadPanelInFullMode: () => setThreadPanelMode('full'),
    sendText,
    sendVoice,
    editMessage,
    deleteMessage,
    toggleReaction,
  });

  const {
    highlightedMessageIds,
    resetConversationUnreadCount,
    handleMarkConversationAsRead,
    handleVisibleMainMessageIds,
    handleVisibleThreadMessageIds,
  } = useChatReadState({
    queryClient,
    socket,
    userId,
    selectedUser,
    selectedThreadRootId,
    contacts,
    mainChatMessages,
    threadReplyMessages,
    selectedThreadRootMessage,
  });

  useEffect(() => {
    if (selectedUser && isPingAccepted && mainAudioQueueKey) {
      syncAudioQueue(mainAudioQueueKey, mainAudioQueue);
    }
  }, [isPingAccepted, mainAudioQueue, mainAudioQueueKey, selectedUser, syncAudioQueue]);

  useEffect(() => {
    if (threadAudioQueueKey) {
      syncAudioQueue(threadAudioQueueKey, threadAudioQueue);
    }
  }, [syncAudioQueue, threadAudioQueue, threadAudioQueueKey]);

  useEffect(() => {
    return () => closeAudioPlayer();
  }, [closeAudioPlayer]);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } finally {
      logout();
      navigate(APP_ROUTES.auth);
    }
  };

  const closeActiveConversation = () => {
    navigate(APP_ROUTES.chat);
  };

  const showNotificationSoundPrompt =
    soundEnabled && soundCapability === 'blocked' && !soundPromptDismissed;

  const closeThreadRoute = () => {
    if (!selectedUser) {
      navigate(APP_ROUTES.chat);
      return;
    }

    navigate(APP_ROUTES.chatPeer(selectedUser));
  };

  const handleConversationMenuMarkAsRead = async (peerUserId: string) => {
    setConversationMenu(null);
    await handleMarkConversationAsRead(peerUserId);
  };

  const getConversationLabel = (peerUserId: string) => {
    const conversation = contacts.find((item) => item.peer_user.id === peerUserId);
    if (conversation?.peer_user.is_ghost) {
      return 'Ghost chat';
    }

    return conversation?.peer_user.display_name || conversation?.peer_user.username || peerUserId;
  };

  const getCallHistoryLabel = (peerUserId: string) => {
    const historyItem = callHistory.find((item) => item.peer_user.id === peerUserId);
    return historyItem?.peer_user.display_name || historyItem?.peer_user.username || peerUserId;
  };

  const openCallHistoryMenu = (event: ReactMouseEvent<HTMLElement>, peerUserId: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCallHistoryMenu({
      peerUserId,
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      },
    });
  };

  const openCallHistoryMenuAtPoint = (event: ReactMouseEvent<HTMLElement>, peerUserId: string) => {
    setCallHistoryMenu({
      peerUserId,
      rect: {
        top: event.clientY,
        right: event.clientX,
        bottom: event.clientY,
        left: event.clientX,
      },
    });
  };

  const handleRequestClearConversation = (peerUserId: string) => {
    setConversationMenu(null);
    setPendingDestructiveAction({
      kind: 'clearConversation',
      peerUserId,
      label: getConversationLabel(peerUserId),
    });
  };

  const handleRequestDeleteConversation = (peerUserId: string) => {
    setConversationMenu(null);
    setPendingDestructiveAction({
      kind: 'deleteConversation',
      peerUserId,
      label: getConversationLabel(peerUserId),
    });
  };

  const handleRequestClearCallHistoryPeer = (peerUserId: string) => {
    setCallHistoryMenu(null);
    setPendingDestructiveAction({
      kind: 'clearCallHistoryPeer',
      peerUserId,
      label: getCallHistoryLabel(peerUserId),
    });
  };

  const handleRequestClearAllCallHistory = () => {
    setPendingDestructiveAction({ kind: 'clearCallHistoryAll' });
  };

  const isPendingDestructiveActionRunning =
    pendingDestructiveAction?.kind === 'clearConversation'
      ? isClearingConversation
      : pendingDestructiveAction?.kind === 'deleteConversation'
        ? isDeletingConversation
        : pendingDestructiveAction?.kind === 'clearCallHistoryPeer' ||
            pendingDestructiveAction?.kind === 'clearCallHistoryAll'
          ? isDeletingHistory
          : false;

  const destructiveDialogTitle =
    pendingDestructiveAction?.kind === 'clearConversation'
      ? `Clear chat with ${pendingDestructiveAction.label}`
      : pendingDestructiveAction?.kind === 'deleteConversation'
        ? `Delete chat with ${pendingDestructiveAction.label}`
        : pendingDestructiveAction?.kind === 'clearCallHistoryPeer'
          ? `Clear call history with ${pendingDestructiveAction.label}`
          : pendingDestructiveAction?.kind === 'clearCallHistoryAll'
            ? 'Clear all call history'
            : '';

  const destructiveDialogDescription =
    pendingDestructiveAction?.kind === 'clearConversation'
      ? 'This removes your messages from this chat, but keeps the conversation available.'
      : pendingDestructiveAction?.kind === 'deleteConversation'
        ? 'This removes the chat, clears its messages, and deletes the ping between both users.'
        : pendingDestructiveAction?.kind === 'clearCallHistoryPeer'
          ? 'This removes call history entries for this contact from your sidebar.'
          : pendingDestructiveAction?.kind === 'clearCallHistoryAll'
            ? 'This removes all call history entries from your sidebar.'
            : '';

  const destructiveDialogActionLabel =
    pendingDestructiveAction?.kind === 'deleteConversation'
      ? 'Delete chat'
      : pendingDestructiveAction?.kind === 'clearConversation'
        ? 'Clear chat'
        : 'Clear history';

  const handleConfirmDestructiveAction = async () => {
    if (!pendingDestructiveAction) {
      return;
    }

    try {
      switch (pendingDestructiveAction.kind) {
        case 'clearConversation': {
          const result = await clearConversation(pendingDestructiveAction.peerUserId);

          if (selectedUser === pendingDestructiveAction.peerUserId && selectedThreadRootId) {
            navigate(APP_ROUTES.chatPeer(pendingDestructiveAction.peerUserId));
          }

          toast.success(
            result.cleared_count > 0
              ? `Cleared ${formatCount(result.cleared_count, 'message')} from ${pendingDestructiveAction.label}.`
              : `Chat history with ${pendingDestructiveAction.label} is already empty.`
          );
          break;
        }
        case 'deleteConversation': {
          const result = await deleteConversation(pendingDestructiveAction.peerUserId);

          if (selectedUser === pendingDestructiveAction.peerUserId) {
            navigate(APP_ROUTES.chat);
          }

          toast.success(
            result.cleared_count > 0
              ? `Deleted chat with ${pendingDestructiveAction.label}. ${formatCount(result.cleared_count, 'message')} cleared${result.ping_deleted ? ', ping removed.' : '.'}`
              : `Deleted chat with ${pendingDestructiveAction.label}${result.ping_deleted ? ' and removed the ping.' : '.'}`
          );
          break;
        }
        case 'clearCallHistoryPeer': {
          const result = await deleteHistory(pendingDestructiveAction.peerUserId);
          const clearedCount = result.deleted_count + result.hidden_count;

          toast.success(
            clearedCount > 0
              ? `Cleared ${formatCount(clearedCount, 'call entry')} with ${pendingDestructiveAction.label}.`
              : `Call history with ${pendingDestructiveAction.label} is already empty.`
          );
          break;
        }
        case 'clearCallHistoryAll': {
          const result = await deleteHistory();
          const clearedCount = result.deleted_count + result.hidden_count;

          toast.success(
            clearedCount > 0
              ? `Cleared ${formatCount(clearedCount, 'call entry')} from call history.`
              : 'Call history is already empty.'
          );
          break;
        }
      }

      setPendingDestructiveAction(null);
    } catch (error) {
      const fallback =
        pendingDestructiveAction.kind === 'deleteConversation'
          ? 'Failed to delete chat'
          : pendingDestructiveAction.kind === 'clearConversation'
            ? 'Failed to clear chat'
            : 'Failed to clear call history';

      toast.error(extractApiError(error, fallback));
    }
  };

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <MediaViewer
        open={mediaViewer.open}
        type={mediaViewer.type}
        url={mediaViewer.url}
        items={mediaViewer.items}
        initialItemId={mediaViewer.initialItemId}
        downloadName={mediaViewer.downloadName}
        onClose={() => setMediaViewer(closedMediaViewerState)}
      />

      <MessageActionsDialog
        open={!!activeMessage}
        anchor={activeMessageAnchor}
        message={activeMessage}
        onOpenChange={(open) => !open && closeMessageMenu()}
        onReply={handleSelectReplyMode}
        onThread={() => activeMessage && openThreadForMessage(activeMessage)}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        isEditing={isEditingMessage}
        isDeleting={isDeletingMessage}
      />

      <ConversationActionsMenu
        menu={conversationMenu}
        isMobile={isMobileViewport}
        isMarkingRead={false}
        isClearingConversation={isClearingConversation}
        isDeletingConversation={isDeletingConversation}
        onOpenChange={(open) => {
          if (!open) {
            setConversationMenu(null);
          }
        }}
        onMarkAsRead={handleConversationMenuMarkAsRead}
        onClearConversation={handleRequestClearConversation}
        onDeleteConversation={handleRequestDeleteConversation}
      />

      <CallHistoryActionsMenu
        menu={callHistoryMenu}
        isMobile={isMobileViewport}
        isClearingHistory={isDeletingHistory}
        onOpenChange={(open) => {
          if (!open) {
            setCallHistoryMenu(null);
          }
        }}
        onClearHistory={handleRequestClearCallHistoryPeer}
      />

      <ConfirmDestructiveActionDialog
        open={!!pendingDestructiveAction}
        title={destructiveDialogTitle}
        description={destructiveDialogDescription}
        actionLabel={destructiveDialogActionLabel}
        isPending={isPendingDestructiveActionRunning}
        onOpenChange={(open) => {
          if (!open && !isPendingDestructiveActionRunning) {
            setPendingDestructiveAction(null);
          }
        }}
        onConfirm={handleConfirmDestructiveAction}
      />

      <ChatSidebar
        profile={profile}
        userEmail={userEmail}
        currentUserId={userId}
        pendingIncomingCount={pendingIncomingCount}
        contacts={contacts}
        callHistory={callHistory}
        sidebarView={sidebarView}
        selectedUser={selectedUser}
        typingUsers={typingUsers}
        activeConversationMenuPeerUserId={conversationMenu?.peerUserId || null}
        activeCallHistoryMenuPeerUserId={callHistoryMenu?.peerUserId || null}
        isLoadingCallHistory={isLoadingCallHistory}
        hasMoreCallHistory={hasNextCallHistoryPage}
        isFetchingMoreCallHistory={isFetchingNextCallHistoryPage}
        isClearingCallHistory={isDeletingHistory}
        onOpenSettings={() => navigate(APP_ROUTES.settingsTab('profile'))}
        onOpenPings={() => navigate(APP_ROUTES.pingsTab('incoming'))}
        onLogout={handleLogout}
        onSidebarViewChange={setSidebarView}
        onLoadMoreCallHistory={() => void fetchNextCallHistoryPage()}
        onClearAllCallHistory={handleRequestClearAllCallHistory}
        onSelectSearchUser={(id) => navigate(APP_ROUTES.chatPeer(id))}
        onSelectConversation={(peerUserId) => {
          navigate(APP_ROUTES.chatPeer(peerUserId));
          resetConversationUnreadCount(peerUserId);
        }}
        onSelectCallHistoryPeer={(peerUserId) => {
          navigate(APP_ROUTES.chatPeer(peerUserId));
          resetConversationUnreadCount(peerUserId);
        }}
        onOpenConversationMenu={openConversationMenu}
        onOpenConversationMenuAtPoint={openConversationMenuAtPoint}
        onOpenCallHistoryMenu={openCallHistoryMenu}
        onOpenCallHistoryMenuAtPoint={openCallHistoryMenuAtPoint}
      />

      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 bg-background h-full relative',
          selectedUser ? 'flex' : 'hidden md:flex'
        )}
      >
        {selectedUser ? (
          <>
            <ChatHeader
              selectedUser={selectedUser}
              displaySelectedUser={displaySelectedUser}
              selectedConversationUserAvatarUrl={selectedConversationUser?.avatar?.url}
              isTyping={isTyping}
              isOnline={onlineUsers?.includes(selectedUser) || false}
              isGhost={isSelectedConversationGhost}
              isPingAccepted={isPingAccepted}
              pingStatus={pingStatus}
              isSendingPing={isSendingPing}
              canPing={!selectedUserSummary || selectedUserSummary.can_ping}
              canCall={isPingAccepted && selectedUser !== userId}
              isCallBusy={isCallBusy}
              onCloseConversation={closeActiveConversation}
              onOpenProfile={() => navigate(APP_ROUTES.profile(selectedUser))}
              onSendPing={() => sendPing(selectedUser)}
              onStartAudioCall={() =>
                void startCall({
                  peerUserId: selectedUser,
                  type: 'audio',
                  peerUser: {
                    id: selectedUser,
                    username: selectedConversationUser?.username || selectedUserSummary?.username || '',
                    display_name:
                      selectedConversationUser?.display_name ||
                      selectedUserSummary?.display_name ||
                      displaySelectedUser ||
                      null,
                    avatar: selectedConversationUser?.avatar || selectedUserSummary?.avatar || null,
                    is_online:
                      onlineUsers?.includes(selectedUser) ||
                      selectedConversationUser?.is_online ||
                      selectedUserSummary?.is_online ||
                      false,
                  },
                })
              }
              onStartVideoCall={() =>
                void startCall({
                  peerUserId: selectedUser,
                  type: 'video',
                  peerUser: {
                    id: selectedUser,
                    username: selectedConversationUser?.username || selectedUserSummary?.username || '',
                    display_name:
                      selectedConversationUser?.display_name ||
                      selectedUserSummary?.display_name ||
                      displaySelectedUser ||
                      null,
                    avatar: selectedConversationUser?.avatar || selectedUserSummary?.avatar || null,
                    is_online:
                      onlineUsers?.includes(selectedUser) ||
                      selectedConversationUser?.is_online ||
                      selectedUserSummary?.is_online ||
                      false,
                  },
                })
              }
            />

            {isPingAccepted && showNotificationSoundPrompt ? (
              <NotificationSoundPrompt
                isEnabling={isEnablingSound}
                onEnable={() => {
                  void enableSoundFromUserGesture();
                }}
                onDismiss={dismissSoundPrompt}
              />
            ) : null}

            {isPingAccepted ? (
              <MainChatPane
                selectedUser={selectedUser}
                isTyping={isTyping}
                renderItems={mainChatRenderItems}
                mainChatMessages={mainChatMessages}
                highlightedMessageIds={highlightedMessageIds}
                currentUserId={userId}
                fetchNextPage={fetchNextPage}
                hasNextPage={!!hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onVisibleMessageIdsChange={handleVisibleMainMessageIds}
                onOpenMenu={(message, anchor) => openMessageMenu(message, anchor, 'main')}
                onToggleReaction={handleToggleReaction}
                isTogglingReaction={isTogglingReaction}
                onMediaClick={handleMainMediaClick}
                audioQueueKey={mainAudioQueueKey}
                audioQueue={mainAudioQueue}
                isMessageMenuOpen={!!activeMessage}
                onOpenThread={openThreadForMessage}
                splitLayoutRef={splitLayoutRef}
                composer={
                  <ChatComposer
                    receiverId={selectedUser}
                    onSendText={handleSendText}
                    onSendMedia={handleSendMedia}
                    replyTarget={replyTarget}
                    onClearReplyTarget={() => setReplyTarget(null)}
                    isUploading={isSending}
                    contextLabel="main chat"
                  />
                }
                resizeHandle={
                  selectedThreadRootMessage && !isMobileViewport ? (
                    <button
                      type="button"
                      aria-label="Resize thread panel"
                      className={cn(
                        'group relative hidden w-4 shrink-0 cursor-col-resize touch-none md:flex',
                        isResizingThread
                          ? 'bg-muted/40'
                          : 'bg-gradient-to-b from-transparent via-muted/20 to-transparent'
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleResizeHandleMouseDown(event.clientX);
                      }}
                    >
                      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/70" />
                      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-20 w-2.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm transition-colors group-hover:bg-muted">
                        <span className="h-8 w-[3px] rounded-full bg-border/80" />
                      </span>
                    </button>
                  ) : null
                }
                threadPanel={
                  <ThreadPanel
                    open={!!selectedThreadRootMessage}
                    rootMessage={selectedThreadRootMessage}
                    replyMessages={threadReplyMessages}
                    renderItems={threadRenderItems}
                    isLoading={isLoadingThread}
                    isFetchingNextPage={isFetchingNextThreadPage}
                    hasNextPage={!!hasNextThreadPage}
                    fetchNextPage={fetchNextThreadPage}
                    currentUserId={userId}
                    onClose={closeThreadRoute}
                    onOpenMenu={(message, anchor) => openMessageMenu(message, anchor, 'thread')}
                    onToggleReaction={handleToggleReaction}
                    isTogglingReaction={isTogglingReaction}
                    onVisibleUnreadMessages={handleVisibleThreadMessageIds}
                    onMediaClick={handleThreadMediaClick}
                    audioQueueKey={threadAudioQueueKey}
                    audioQueue={threadAudioQueue}
                    isMobile={isMobileViewport}
                    isMessageMenuOpen={!!activeMessage}
                    style={{ width: threadPanelWidth }}
                    composer={
                      selectedThreadRootMessage ? (
                        <div className="bg-background px-3">
                          <ChatComposer
                            receiverId={selectedUser}
                            onSendText={handleSendThreadText}
                            onSendMedia={handleSendThreadMedia}
                            replyTarget={threadReplyTarget}
                            onClearReplyTarget={() => setThreadReplyTarget(null)}
                            isUploading={isSending}
                            contextLabel="thread"
                          />
                        </div>
                      ) : null
                    }
                  />
                }
              />
            ) : (
              <ConversationAccessState
                pingStatus={pingStatus}
                displaySelectedUser={displaySelectedUser}
                isGhost={isSelectedConversationGhost}
                incomingPingId={incomingPing?.id || null}
                isAcceptingPing={isAcceptingPing}
                isDecliningPing={isDecliningPing}
                isSendingPing={isSendingPing}
                canSendPing={!isSendingPing && !(selectedUserSummary && !selectedUserSummary.can_ping)}
                onAcceptPing={(pingId) => acceptPing(pingId)}
                onDeclinePing={(pingId) => declinePing(pingId)}
                onSendPing={() => sendPing(selectedUser)}
              />
            )}
          </>
        ) : (
          <ChatWelcomeState />
        )}
      </div>
    </div>
  );
}
