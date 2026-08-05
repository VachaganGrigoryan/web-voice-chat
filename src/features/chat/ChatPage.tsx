import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConversations, useThreadMessages } from '@/hooks/useConversationList';
import { useContainer, useContainerMessages, useMarkContainerRead } from '@/container';
import type { MessageContainerRef } from '@/api/types';
import { useConnections } from '@/hooks/useConnections';
import { useContacts } from '@/hooks/useContacts';
import { useGroupMembers } from '@/hooks/useGroupManagement';
import { APP_ROUTES } from '@/app/routes';
import { conversationsApi, messagesApi, notificationsApi, savedMessagesApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { useActiveSpace } from '@/app/shell/useActiveSpace';
import { useChannelLens } from '@/features/channels/useChannelLens';
import { ContainerSettingsSheet } from '@/features/settings-container/ContainerSettingsSheet';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { triggerHaptic } from '@/utils/haptics';
import {
  usePresence,
  useRealtimeMessages,
  useSocket,
  useSocketStore,
  useTypingIndicator,
} from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { startCall, useCallStore } from '@/features/calls/callController';
import { useNotificationSoundStore } from '@/utils/notificationSound';
import { NotificationLevel, ROLE_ADMIN, ROLE_MODERATOR } from '@/api/types';
import { cn } from '@/lib/utils';
import { useChatDialogs, CLOSED_MEDIA_VIEWER } from './ChatDialogsProvider';
import { useChatRouteParams } from './hooks/useChatRouteParams';
import { useChatInteractionState } from './hooks/useChatInteractionState';
import { useSelectedConversation } from './hooks/useSelectedConversation';
import { useTimelineViewModel } from './hooks/useTimelineViewModel';
import { useMessageReadReceipts } from './hooks/useMessageReadReceipts';
import { useThreadPanelLayout } from './hooks/useThreadPanelLayout';
import { useConversationActions } from './hooks/useConversationActions';
import { useConversationFolders } from './hooks/useConversationFolders';
import { sortConversationsByRecency } from './utils/chatLayoutUtils';
import { parseMessage } from './utils/messageParser';
import { ContainerPane } from './ContainerPane';
import { ChatWelcomeState } from './components/ChatWelcomeState';
import { MediaViewer } from './media/MediaViewer';
import { MessageActionsDialog } from './components/MessageActionsDialog';
import { MessageSearchDialog } from './components/MessageSearchDialog';
import { SavedMessagesDialog } from './components/SavedMessagesDialog';
import { ScheduledMessagesDialog } from './components/ScheduledMessagesDialog';
import { ForwardMessageDialog } from './components/ForwardMessageDialog';
import { ContainerInfoModal } from './components/info/ContainerInfoModal';
import { MoveToFolderDialog } from './components/MoveToFolderDialog';
import { ThreadPanel } from './components/ThreadPanel';
import ChatComposer from './composer';
import { useChatAudioPlayerStore } from './media/players/audioPlayerStore';

/** `/chat`, `/chat/:conversationId[/thread/:rootId]`, `/chat/channels/:channelId[/thread/:rootId]`. */
export default function ChatPage() {
  const { conversationId, channelId, rootMessageId, spaceId: routeSpaceId } = useChatRouteParams();
  const container = useMemo<MessageContainerRef | null>(
    () =>
      channelId
        ? { container_type: 'channel', container_id: channelId }
        : conversationId
          ? { container_type: 'conversation', container_id: conversationId }
          : null,
    [channelId, conversationId]
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const selectedUser = container?.container_id ?? null;
  const isChannelContainer = container?.container_type === 'channel';
  const selectedThreadRootId = rootMessageId;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dialogs = useChatDialogs();
  const { userId } = useAuthStore();
  const { socket } = useSocketStore();
  const activeSpaceId = useActiveSpace((state) => state.activeSpaceId);
  const setActiveSpaceId = useActiveSpace((state) => state.setActiveSpaceId);
  const selectedSpaceId = routeSpaceId ?? activeSpaceId;

  useSocket();
  useRealtimeMessages(container, selectedThreadRootId);

  // Channels broadcast over a per-channel Socket.IO room rather than the
  // per-user rooms conversations use, so viewing one requires subscribing.
  useEffect(() => {
    if (!socket || !isChannelContainer || !selectedUser) return;
    socket.emit(EVENTS.JOIN_CHANNEL, { channel_id: selectedUser });
    return () => {
      socket.emit(EVENTS.LEAVE_CHANNEL, { channel_id: selectedUser });
    };
  }, [socket, isChannelContainer, selectedUser]);

  const { onlineUsers, presenceByUserId } = usePresence();
  const { isTyping, typingUsers } = useTypingIndicator(selectedUser || undefined);

  // The route is the only source of the lens, so the descriptor's presentation
  // and the URL can never disagree.
  const { lens: channelLens, setLens: setChannelLens } = useChannelLens(
    isChannelContainer ? selectedUser : null,
    selectedSpaceId
  );

  const { descriptor, isMissing: isSelectedConversationMissing } = useContainer(container, userId, {
    lens: isChannelContainer && channelLens === 'feed' ? 'feed' : 'timeline',
  });
  useMarkContainerRead(descriptor);
  const {
    data: messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useContainerMessages(descriptor);

  const activeChannel = descriptor?.source.kind === 'channel' ? descriptor.source.channel : null;

  const { data: conversationsData } = useConversations(selectedSpaceId);
  const inboxConversations = useMemo(
    () => conversationsData?.pages.flatMap((page) => page.data || []).filter(Boolean) || [],
    [conversationsData]
  );

  // The inbox query only returns non-archived conversations on the active page,
  // so an archived (or off-page) chat opened by id is absent. Fetch it on its own
  // and merge it in, so its history and composer resolve instead of the ping/
  // access screen.
  const isSelectedInInbox = useMemo(
    () =>
      !!selectedUser &&
      inboxConversations.some(
        (conversation) => conversation.conversation_id === selectedUser || conversation.id === selectedUser
      ),
    [inboxConversations, selectedUser]
  );

  const selectedConversationQuery = useQuery({
    queryKey: ['conversation', selectedUser],
    queryFn: () => conversationsApi.getConversation(selectedUser as string),
    enabled: !!selectedUser && !isSelectedInInbox,
  });

  const conversations = useMemo(() => {
    const fallback = selectedConversationQuery.data;
    if (
      !fallback ||
      inboxConversations.some(
        (conversation) => conversation.conversation_id === fallback.conversation_id || conversation.id === fallback.id
      )
    ) {
      return sortConversationsByRecency(inboxConversations);
    }
    return sortConversationsByRecency([...inboxConversations, fallback]);
  }, [inboxConversations, selectedConversationQuery.data]);

  const callPhase = useCallStore((state) => state.phase);
  const soundEnabled = useNotificationSoundStore((state) => state.soundEnabled);
  const soundCapability = useNotificationSoundStore((state) => state.soundCapability);
  const soundPromptDismissed = useNotificationSoundStore((state) => state.soundPromptDismissed);
  const isEnablingSound = useNotificationSoundStore((state) => state.isEnablingSound);
  const enableSoundFromUserGesture = useNotificationSoundStore((state) => state.enableSoundFromUserGesture);
  const dismissSoundPrompt = useNotificationSoundStore((state) => state.dismissSoundPrompt);

  useEffect(() => {
    if (selectedUser && isSelectedConversationMissing) {
      navigate(APP_ROUTES.chat, { replace: true });
    }
  }, [selectedUser, isSelectedConversationMissing, navigate]);

  const {
    incoming,
    outgoing,
    sendPing,
    acceptPing,
    declinePing,
    isSending: isSendingPing,
    isAccepting: isAcceptingPing,
    isDeclining: isDecliningPing,
  } = useConnections();
  const { contacts: pingContacts } = useContacts();
  const syncAudioQueue = useChatAudioPlayerStore((state) => state.syncQueue);
  const closeAudioPlayer = useChatAudioPlayerStore((state) => state.close);

  useEffect(() => {
    if (routeSpaceId) setActiveSpaceId(routeSpaceId);
  }, [routeSpaceId, setActiveSpaceId]);

  const {
    selectedUserSummary,
    incomingPing,
    pingStatus,
    isPingAccepted,
    selectedPeerUserId,
    selectedConversation,
    selectedConversationUser,
    displaySelectedUser,
    isSelectedConversationGhost,
  } = useSelectedConversation({ conversations, incoming, outgoing, selectedUser });

  const selectedPresence = selectedPeerUserId ? presenceByUserId[selectedPeerUserId] : undefined;
  const selectedPresenceState =
    selectedPresence?.state ||
    selectedConversationUser?.presence_state ||
    selectedUserSummary?.presence_state ||
    (selectedPeerUserId && onlineUsers?.includes(selectedPeerUserId) ? 'online' : 'offline');
  const selectedIsOnline = selectedPresenceState !== 'offline';
  const isCallBusy = callPhase !== 'idle';
  const isContainerOpen = isChannelContainer || isPingAccepted;

  const {
    data: threadMessagesPages,
    fetchNextPage: fetchNextThreadPage,
    hasNextPage: hasNextThreadPage,
    isFetchingNextPage: isFetchingNextThreadPage,
    isLoading: isLoadingThread,
  } = useThreadMessages(container, selectedThreadRootId);

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
  } = useTimelineViewModel({ messages, threadMessagesPages, userId, selectedUser, selectedThreadRootId });

  const threadRootMessageQuery = useQuery({
    queryKey: ['message', selectedThreadRootId],
    queryFn: () => messagesApi.getMessage(selectedThreadRootId as string),
    enabled: !!selectedThreadRootId && !selectedThreadRootMessage,
  });
  const fetchedThreadRootMessage = useMemo(
    () => (threadRootMessageQuery.data ? parseMessage(threadRootMessageQuery.data, userId) : null),
    [threadRootMessageQuery.data, userId]
  );
  const threadSummaryQuery = useQuery({
    queryKey:
      container && selectedThreadRootId
        ? ['threadSummary', container.container_type, container.container_id, selectedThreadRootId]
        : ['threadSummary', 'idle'],
    queryFn: () => messagesApi.getThreadSummary(selectedThreadRootId as string),
    enabled: !!container && !!selectedThreadRootId,
  });
  const displayedThreadRootMessage = useMemo(() => {
    const rootMessage = selectedThreadRootMessage ?? fetchedThreadRootMessage;
    const summary = threadSummaryQuery.data;
    if (!rootMessage || !summary) return rootMessage;

    return {
      ...rootMessage,
      isThreadRoot: summary.is_thread_root,
      threadReplyCount: summary.thread_reply_count,
      lastThreadReplyAt: summary.last_thread_reply_at || undefined,
    };
  }, [fetchedThreadRootMessage, selectedThreadRootMessage, threadSummaryQuery.data]);

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
    isLayoutActive: !!selectedUser && (isChannelContainer || isPingAccepted),
  });

  const {
    replyTarget,
    threadReplyTarget,
    setReplyTarget,
    setThreadReplyTarget,
    closeMessageMenu,
    openMessageMenu,
    handleSelectReplyMode,
    handleSwipeReply,
    openThreadForMessage,
    handleSendText,
    handleSendRichContent,
    handleSendThreadText,
    handleSendThreadRichContent,
    handleSendMedia,
    handleSendThreadMedia,
    handleEditMessage,
    handleDeleteMessage,
    handleToggleReaction,
    handleMainMediaClick,
    handleThreadMediaClick,
    isSending,
    isTogglingReaction,
    createPoll,
  } = useChatInteractionState({
    descriptor,
    currentUserId: userId,
    selectedUser,
    selectedThreadRootId,
    displaySelectedUser,
    isMobileViewport,
    mainImageGallery,
    threadImageGallery,
    navigateToConversation: (_id, threadRootId) => navigate(getContainerRoute(threadRootId)),
    openThreadPanelInFullMode: () => setThreadPanelMode('full'),
  });

  const { setInboxState } = useConversationActions();
  const folders = useConversationFolders(false);

  const { highlightedMessageIds, handleVisibleMainMessageIds, handleVisibleThreadMessageIds } =
    useMessageReadReceipts({
      userId,
      selectedConversationId: container?.container_type === 'conversation' ? selectedUser : null,
      selectedContainer: container,
      selectedThreadRootId,
      mainChatMessages,
      threadReplyMessages,
    });

  const { activeMessage, activeMessageAnchor, mediaViewer } = dialogs.state;

  // DMs allow either participant to manage message pins; larger conversations
  // follow the owner/admin pin right.
  const isPinCapableConversation = selectedConversation?.type === 'group';
  const { data: pinMembers } = useGroupMembers(isPinCapableConversation ? selectedConversation?.id ?? null : null);
  const canManagePins = useMemo(() => {
    if (selectedConversation?.type === 'dm') {
      return true;
    }
    if (selectedConversation?.owner_type === 'user' && selectedConversation.owner_id === userId) {
      return true;
    }
    const role = pinMembers?.find((member) => member.user_id === userId)?.role;
    return role === ROLE_ADMIN || role === ROLE_MODERATOR;
  }, [pinMembers, selectedConversation?.type, selectedConversation?.owner_type, selectedConversation?.owner_id, userId]);

  const isActiveMessagePinned = !!(
    activeMessage && selectedConversation?.pinned_message_ids.includes(activeMessage.id)
  );
  const canPinActiveMessage = !!(
    canManagePins && activeMessage && activeMessage.chatId === selectedConversation?.id
  );

  const handleTogglePinMessage = async () => {
    if (!activeMessage) return;
    const pinnedConversationId = activeMessage.chatId;
    const updatePinnedIds = (pinnedMessageIds: string[]) => {
      queryClient.setQueryData(['conversations'], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((conversation: any) =>
              conversation.conversation_id === pinnedConversationId || conversation.id === pinnedConversationId
                ? { ...conversation, pinned_message_ids: pinnedMessageIds }
                : conversation
            ),
          })),
        };
      });

      queryClient.setQueryData(['conversation', pinnedConversationId], (old: any) => {
        if (!old) return old;
        return { ...old, pinned_message_ids: pinnedMessageIds };
      });
    };

    try {
      const updatedConversation = isActiveMessagePinned
        ? await messagesApi.unpinMessage(activeMessage.id)
        : await messagesApi.pinMessage(activeMessage.id);
      updatePinnedIds(updatedConversation.pinned_message_ids);
      toast.success(isActiveMessagePinned ? 'Message unpinned' : 'Message pinned');
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', pinnedConversationId] });
    } catch (error) {
      toast.error(extractApiError(error, 'Could not update pin'));
    } finally {
      closeMessageMenu();
    }
  };

  const handleSaveMessage = async () => {
    if (!activeMessage) return;
    try {
      await savedMessagesApi.save(activeMessage.chatId, activeMessage.id);
      queryClient.invalidateQueries({ queryKey: ['saved-messages'] });
      toast.success('Message saved');
    } catch (error) {
      toast.error(extractApiError(error, 'Could not save message'));
    }
  };

  const handleForwardMessage = () => {
    if (!activeMessage) return;
    dialogs.setForwardSource({ conversationId: activeMessage.chatId, messageId: activeMessage.id });
    closeMessageMenu();
  };

  const handleCycleNotificationSettings = async () => {
    if (!selectedConversation) return;

    const activeMute = selectedConversation.muted_until
      ? new Date(selectedConversation.muted_until).getTime() > Date.now()
      : false;
    const next: { notification_level?: NotificationLevel; muted_until?: string | null } =
      activeMute || selectedConversation.notification_level === 'none'
        ? { notification_level: 'all', muted_until: null }
        : selectedConversation.notification_level === 'all'
          ? { notification_level: 'mentions', muted_until: null }
          : { notification_level: 'all', muted_until: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() };

    dialogs.setUpdatingNotificationConversation(selectedConversation.id);
    try {
      const participant = await notificationsApi.updateConversationSettings(selectedConversation.id, next);
      queryClient.setQueryData(['conversations'], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((conversation: any) =>
              conversation.id === selectedConversation.id
                ? { ...conversation, notification_level: participant.notification_level, muted_until: participant.muted_until }
                : conversation
            ),
          })),
        };
      });
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to update notification settings'));
    } finally {
      dialogs.setUpdatingNotificationConversation(null);
    }
  };

  useEffect(() => {
    if (selectedUser && (isChannelContainer || isPingAccepted) && mainAudioQueueKey) {
      syncAudioQueue(mainAudioQueueKey, mainAudioQueue);
    }
  }, [isChannelContainer, isPingAccepted, mainAudioQueue, mainAudioQueueKey, selectedUser, syncAudioQueue]);

  useEffect(() => {
    if (threadAudioQueueKey) {
      syncAudioQueue(threadAudioQueueKey, threadAudioQueue);
    }
  }, [syncAudioQueue, threadAudioQueue, threadAudioQueueKey]);

  useEffect(() => {
    return () => closeAudioPlayer();
  }, [closeAudioPlayer]);

  const closeActiveConversation = () => navigate(APP_ROUTES.chat);
  const showNotificationSoundPrompt = soundEnabled && soundCapability === 'blocked' && !soundPromptDismissed;

  function getContainerRoute(threadRootId?: string | null) {
    if (!selectedUser) return APP_ROUTES.chat;

    if (container?.container_type === 'channel') {
      const spaceId = routeSpaceId ?? activeChannel?.space_id ?? null;
      if (threadRootId) {
        return spaceId
          ? APP_ROUTES.spaceChannelThread(spaceId, selectedUser, threadRootId)
          : APP_ROUTES.chatChannelThread(selectedUser, threadRootId);
      }
      return spaceId ? APP_ROUTES.spaceChannel(spaceId, selectedUser, 'chat') : APP_ROUTES.chatChannel(selectedUser);
    }

    if (selectedConversation?.type === 'dm') {
      return threadRootId ? APP_ROUTES.dmThread(selectedUser, threadRootId) : APP_ROUTES.dm(selectedUser);
    }

    const spaceId = routeSpaceId ?? selectedConversation?.space_id ?? null;
    if (threadRootId) {
      return spaceId
        ? APP_ROUTES.spaceGroupThread(spaceId, selectedUser, threadRootId)
        : APP_ROUTES.groupThread(selectedUser, threadRootId);
    }
    return spaceId ? APP_ROUTES.spaceGroupChat(spaceId, selectedUser) : APP_ROUTES.group(selectedUser);
  }

  const closeThreadRoute = () => {
    navigate(getContainerRoute());
  };

  if (!selectedUser) {
    return <ChatWelcomeState />;
  }

  // Brief window between selecting a container and its source resolving;
  // the messages/compose hooks above already tolerate a null descriptor, the
  // pane itself does not, so it waits rather than asserting.
  if (!descriptor) {
    return null;
  }

  return (
    <>
      <MediaViewer
        open={mediaViewer.open}
        type={mediaViewer.type}
        url={mediaViewer.url}
        items={mediaViewer.items}
        initialItemId={mediaViewer.initialItemId}
        downloadName={mediaViewer.downloadName}
        onClose={() => dialogs.setMediaViewer(CLOSED_MEDIA_VIEWER)}
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
        isEditing={false}
        isDeleting={false}
        canPin={canPinActiveMessage}
        isPinned={isActiveMessagePinned}
        onTogglePin={handleTogglePinMessage}
        onForward={handleForwardMessage}
        onSave={handleSaveMessage}
      />

      <MessageSearchDialog
        open={dialogs.state.searchOpen}
        onOpenChange={dialogs.setSearchOpen}
        onSelectResult={(message) => {
          dialogs.setSearchOpen(false);
          navigate(APP_ROUTES.chatConversation(message.conversation_id));
        }}
      />

      <SavedMessagesDialog
        open={dialogs.state.savedOpen}
        onOpenChange={dialogs.setSavedOpen}
        onSelectSaved={(saved) => {
          dialogs.setSavedOpen(false);
          navigate(APP_ROUTES.chatConversation(saved.conversation_id));
        }}
      />

      {selectedConversation ? (
        <ScheduledMessagesDialog
          open={dialogs.state.scheduledOpen}
          onOpenChange={dialogs.setScheduledOpen}
          conversationId={selectedConversation.id}
        />
      ) : null}

      <ForwardMessageDialog
        open={!!dialogs.state.forwardSource}
        onOpenChange={(open) => !open && dialogs.setForwardSource(null)}
        conversations={conversations}
        sourceConversationId={dialogs.state.forwardSource?.conversationId ?? null}
        messageId={dialogs.state.forwardSource?.messageId ?? null}
        onForwarded={(targetConversationId) => {
          dialogs.setForwardSource(null);
          navigate(APP_ROUTES.chatConversation(targetConversationId));
        }}
      />

      <MoveToFolderDialog
        open={!!dialogs.state.folderDialogConversationId}
        onOpenChange={(open) => {
          if (!open) dialogs.setFolderDialogConversation(null);
        }}
        folders={folders.folderNames}
        initialFolder={selectedConversation?.folder ?? null}
        onSave={(folder) => {
          if (dialogs.state.folderDialogConversationId) {
            setInboxState.mutate({ conversationId: dialogs.state.folderDialogConversationId, updates: { folder } });
          }
          dialogs.setFolderDialogConversation(null);
        }}
      />

      <ContainerPane
        descriptor={descriptor}
        onClose={closeActiveConversation}
        onOpenInfo={() => setIsInfoOpen(true)}
        onOpenSearch={() => dialogs.setSearchOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNavigate={navigate}
        channelLens={isChannelContainer ? channelLens : undefined}
        onChannelLensChange={isChannelContainer ? setChannelLens : undefined}
        isTypingInHeader={isTyping}
        isOnline={!!selectedPeerUserId && selectedIsOnline}
        presenceState={selectedPresenceState}
        isGhost={isSelectedConversationGhost}
        notificationLevel={selectedConversation?.notification_level}
        mutedUntil={selectedConversation?.muted_until}
        isUpdatingNotifications={dialogs.state.updatingNotificationConversationId === selectedConversation?.id}
        onCycleNotificationLevel={selectedConversation ? handleCycleNotificationSettings : undefined}
        inboxPinned={selectedConversation?.pinned}
        inboxArchived={selectedConversation?.archived}
        isUpdatingInboxState={setInboxState.isPending}
        onToggleInboxPin={
          selectedConversation
            ? () =>
                setInboxState.mutate({
                  conversationId: selectedConversation.id,
                  updates: { pinned: !selectedConversation.pinned },
                })
            : undefined
        }
        onToggleInboxArchive={
          selectedConversation
            ? () =>
                setInboxState.mutate({
                  conversationId: selectedConversation.id,
                  updates: { archived: !selectedConversation.archived },
                })
            : undefined
        }
        onMoveToFolder={
          selectedConversation ? () => dialogs.setFolderDialogConversation(selectedConversation.id) : undefined
        }
        isPingAccepted={isPingAccepted}
        pingStatus={pingStatus}
        isSendingPing={isSendingPing}
        canPing={!!selectedPeerUserId && (!selectedUserSummary || selectedUserSummary.can_ping !== false)}
        canCall={!!selectedPeerUserId && isPingAccepted && selectedPeerUserId !== userId}
        isCallBusy={isCallBusy}
        onOpenScheduled={isPingAccepted && selectedConversation ? () => dialogs.setScheduledOpen(true) : undefined}
        onOpenSaved={() => dialogs.setSavedOpen(true)}
        onSendPing={() => {
          if (selectedPeerUserId) sendPing(selectedPeerUserId);
        }}
        onStartAudioCall={() =>
          selectedPeerUserId
            ? void startCall({
                peerUserId: selectedPeerUserId,
                type: 'audio',
                peerUser: {
                  id: selectedPeerUserId,
                  username: selectedConversationUser?.username || selectedUserSummary?.username || '',
                  display_name:
                    selectedConversationUser?.display_name || selectedUserSummary?.display_name || displaySelectedUser || null,
                  avatar: selectedConversationUser?.avatar || selectedUserSummary?.avatar || null,
                  is_online: selectedIsOnline,
                },
              })
            : undefined
        }
        onStartVideoCall={() =>
          selectedPeerUserId
            ? void startCall({
                peerUserId: selectedPeerUserId,
                type: 'video',
                peerUser: {
                  id: selectedPeerUserId,
                  username: selectedConversationUser?.username || selectedUserSummary?.username || '',
                  display_name:
                    selectedConversationUser?.display_name || selectedUserSummary?.display_name || displaySelectedUser || null,
                  avatar: selectedConversationUser?.avatar || selectedUserSummary?.avatar || null,
                  is_online: selectedIsOnline,
                },
              })
            : undefined
        }
        accessGate={
          !isContainerOpen
            ? {
                pingStatus,
                displaySelectedUser,
                isGhost: isSelectedConversationGhost,
                incomingPingId: incomingPing?.id || null,
                isAcceptingPing,
                isDecliningPing,
                isSendingPing,
                canSendPing:
                  !!selectedPeerUserId && !isSendingPing && !(selectedUserSummary && selectedUserSummary.can_ping === false),
                onAcceptPing: (pingId) => acceptPing(pingId),
                onDeclinePing: (pingId) => declinePing(pingId),
                onSendPing: () => {
                  if (selectedPeerUserId) sendPing(selectedPeerUserId);
                },
              }
            : undefined
        }
        pinnedBar={
          selectedConversation && selectedConversation.pinned_message_ids.length > 0
            ? {
                conversationId: selectedConversation.id,
                pinnedMessageIds: selectedConversation.pinned_message_ids,
                canManagePins,
              }
            : undefined
        }
        showNotificationSoundPrompt={showNotificationSoundPrompt}
        isEnablingSound={isEnablingSound}
        onEnableSound={() => void enableSoundFromUserGesture()}
        onDismissSoundPrompt={dismissSoundPrompt}
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
        onSwipeReply={(message) => handleSwipeReply(message, 'main')}
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
            container={container!}
            onSendText={handleSendText}
            onSendMedia={handleSendMedia}
            onSendRichContent={handleSendRichContent}
            onCreatePoll={createPoll}
            contacts={pingContacts}
            replyTarget={replyTarget}
            onClearReplyTarget={() => setReplyTarget(null)}
            isUploading={isSending}
            contextLabel="main chat"
            enableDraft
          />
        }
        resizeHandle={
          displayedThreadRootMessage && !isMobileViewport ? (
            <button
              type="button"
              aria-label="Resize thread panel"
              className={cn(
                'group relative hidden w-4 shrink-0 cursor-col-resize touch-none md:flex',
                isResizingThread ? 'bg-muted/40' : 'bg-gradient-to-b from-transparent via-muted/20 to-transparent'
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
            open={!!displayedThreadRootMessage}
            rootMessage={displayedThreadRootMessage}
            replyMessages={threadReplyMessages}
            renderItems={threadRenderItems}
            isLoading={isLoadingThread}
            isFetchingNextPage={isFetchingNextThreadPage}
            hasNextPage={!!hasNextThreadPage}
            fetchNextPage={fetchNextThreadPage}
            currentUserId={userId}
            onClose={closeThreadRoute}
            onOpenMenu={(message, anchor) => openMessageMenu(message, anchor, 'thread')}
            onSwipeReply={(message) => handleSwipeReply(message, 'thread')}
            onToggleReaction={async (messageId, emoji) => {
              await handleToggleReaction(messageId, emoji);
            }}
            isTogglingReaction={isTogglingReaction}
            onVisibleUnreadMessages={handleVisibleThreadMessageIds}
            onMediaClick={handleThreadMediaClick}
            audioQueueKey={threadAudioQueueKey}
            audioQueue={threadAudioQueue}
            isMobile={isMobileViewport}
            isMessageMenuOpen={!!activeMessage}
            style={{ width: threadPanelWidth }}
            composer={
              displayedThreadRootMessage ? (
                <div className="bg-background px-3">
                  <ChatComposer
                    container={container!}
                    onSendText={handleSendThreadText}
                    onSendMedia={handleSendThreadMedia}
                    onSendRichContent={handleSendThreadRichContent}
                    onCreatePoll={createPoll}
                    contacts={pingContacts}
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

      <ContainerInfoModal
        descriptor={descriptor}
        open={isInfoOpen}
        onOpenChange={setIsInfoOpen}
        currentUserId={userId}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <ContainerSettingsSheet
        descriptor={descriptor}
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </>
  );
}
