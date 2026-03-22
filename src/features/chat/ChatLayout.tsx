import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useChat, useConversations, useThreadMessages } from '@/hooks/useChat';
import { usePings } from '@/hooks/usePings';
import { APP_ROUTES } from '@/app/routes';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/endpoints';
import MediaComposer from './media/upload/MediaComposer';
import VoiceRecorder from './media/recorders/VoiceRecorder';
import { useChatAudioPlayerStore } from './media/players/audioPlayerStore';
import { MediaViewer } from './media/MediaViewer';
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
import {
  closedMediaViewerState,
  useChatInteractionState,
} from './hooks/useChatInteractionState';
import { useChatReadState } from './hooks/useChatReadState';
import { useThreadPanelLayout } from './hooks/useThreadPanelLayout';

export default function ChatLayout() {
  const { peerUserId, rootMessageId } = useParams<{
    peerUserId?: string;
    rootMessageId?: string;
  }>();
  const selectedUser = peerUserId || null;
  const selectedThreadRootId = rootMessageId || null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    toggleReaction,
    isSending,
    isEditingMessage,
    isDeletingMessage,
    isTogglingReaction,
  } = useChat(selectedUser, selectedThreadRootId);

  const { data: conversationsData } = useConversations();
  const conversations = useMemo(
    () => conversationsData?.pages.flatMap((page) => page.data || []).filter(Boolean) || [],
    [conversationsData]
  );

  const { userEmail, userId, logout, refreshToken } = useAuthStore();
  const { profile } = useProfile();
  const { socket } = useSocketStore();
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
  } = useChatLayoutDerivedData({
    conversations,
    incoming,
    outgoing,
    selectedUser,
  });

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
      navigate(APP_ROUTES.login);
    }
  };

  const closeActiveConversation = () => {
    navigate(APP_ROUTES.chat);
  };

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
        onOpenChange={(open) => {
          if (!open) {
            setConversationMenu(null);
          }
        }}
        onMarkAsRead={handleConversationMenuMarkAsRead}
      />

      <ChatSidebar
        profile={profile}
        userEmail={userEmail}
        currentUserId={userId}
        pendingIncomingCount={pendingIncomingCount}
        contacts={contacts}
        selectedUser={selectedUser}
        typingUsers={typingUsers}
        activeConversationMenuPeerUserId={conversationMenu?.peerUserId || null}
        onOpenSettings={() => navigate(APP_ROUTES.settingsTab('profile'))}
        onOpenPings={() => navigate(APP_ROUTES.pingsTab('incoming'))}
        onLogout={handleLogout}
        onSelectSearchUser={(id) => navigate(APP_ROUTES.chatPeer(id))}
        onSelectConversation={(peerUserId) => {
          navigate(APP_ROUTES.chatPeer(peerUserId));
          resetConversationUnreadCount(peerUserId);
        }}
        onOpenConversationMenu={openConversationMenu}
        onOpenConversationMenuAtPoint={openConversationMenuAtPoint}
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
              isPingAccepted={isPingAccepted}
              isUploading={isSending}
              replyTarget={replyTarget}
              pingStatus={pingStatus}
              isSendingPing={isSendingPing}
              canPing={!selectedUserSummary || selectedUserSummary.can_ping}
              onCloseConversation={closeActiveConversation}
              onOpenProfile={() => navigate(APP_ROUTES.profile(selectedUser))}
              onSendMedia={handleSendMedia}
              onClearReplyTarget={() => setReplyTarget(null)}
              onSendPing={() => sendPing(selectedUser)}
            />

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
                onSendVoice={handleSendMedia}
                onSendText={handleSendText}
                replyTarget={replyTarget}
                onClearReplyTarget={() => setReplyTarget(null)}
                splitLayoutRef={splitLayoutRef}
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
                        <div className="bg-background">
                          <div className="flex justify-end px-3 pt-3">
                            <MediaComposer
                              receiverId={selectedUser}
                              onSendMedia={handleSendThreadMedia}
                              isUploading={isSending}
                              replyTarget={threadReplyTarget}
                              onClearReplyTarget={() => setThreadReplyTarget(null)}
                            />
                          </div>
                          <VoiceRecorder
                            receiverId={selectedUser}
                            onSendVoice={handleSendThreadMedia}
                            onSendText={handleSendThreadText}
                            replyTarget={threadReplyTarget}
                            onClearReplyTarget={() => setThreadReplyTarget(null)}
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
