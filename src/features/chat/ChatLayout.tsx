import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChat, useConversations, useThreadMessages } from '@/hooks/useChat';
import { useCallHistory } from '@/hooks/useCallHistory';
import { useConnections } from '@/hooks/useConnections';
import { useContacts } from '@/hooks/useContacts';
import { APP_ROUTES } from '@/app/routes';
import { extractApiError } from '@/api/errors';
import { useAuthStore } from '@/store/authStore';
import {
  authApi,
  conversationsApi,
  messagesApi,
  notificationsApi,
  savedMessagesApi,
} from '@/api/endpoints';
import { toast } from 'sonner';
import { triggerHaptic } from '@/utils/haptics';
import ChatComposer from './composer';
import { useChatAudioPlayerStore } from './media/players/audioPlayerStore';
import { MediaViewer } from './media/MediaViewer';
import { CallHistoryActionsMenu, CallHistoryMenuState } from './components/CallHistoryActionsMenu';
import { ConfirmDestructiveActionDialog } from './components/ConfirmDestructiveActionDialog';
import { GroupInfoPanel } from './components/GroupInfoPanel';
import { ForwardMessageDialog } from './components/ForwardMessageDialog';
import { MessageActionsDialog } from './components/MessageActionsDialog';
import { MessageSearchDialog } from './components/MessageSearchDialog';
import { PinnedMessagesBar } from './components/PinnedMessagesBar';
import { SavedMessagesDialog } from './components/SavedMessagesDialog';
import { ScheduledMessagesDialog } from './components/ScheduledMessagesDialog';
import { ThreadPanel } from './components/ThreadPanel';
import { ConvertThreadToGroupDialog } from './components/ConvertThreadToGroupDialog';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatActionRail } from './components/ChatActionRail';
import { CreateGroupDialog } from './components/CreateGroupDialog';
import { CreateChannelDialog } from './components/CreateChannelDialog';
import { InviteToConversationDialog } from './components/InviteToConversationDialog';
import { ChatWelcomeState } from './components/ChatWelcomeState';
import { ConversationAccessState } from './components/ConversationAccessState';
import {
  ConversationActionsMenu,
} from './components/ConversationActionsMenu';
import { MoveToFolderDialog } from './components/MoveToFolderDialog';
import { useConversationActions } from './hooks/useConversationActions';
import { useConversationFolders } from './hooks/useConversationFolders';
import { ChatHeader } from './components/ChatHeader';
import { MainChatPane } from './components/MainChatPane';
import { cn } from '@/lib/utils';
import { useTypingIndicator, useSocketStore } from '@/socket/socket';
import { useProfile } from '@/hooks/useProfile';
import { useGroupMembers } from '@/hooks/useGroupManagement';
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
import { NotificationLevel, PresenceState, ROLE_ADMIN, ROLE_MODERATOR, ThreadConversationView } from '@/api/types';
import { parseMessage } from './utils/messageParser';

type SidebarDestructiveAction =
  | { kind: 'clearConversation'; peerUserId: string; label: string }
  | { kind: 'deleteConversation'; peerUserId: string; label: string }
  | { kind: 'clearCallHistoryPeer'; peerUserId: string; label: string }
  | { kind: 'clearCallHistoryAll' };

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function ChatLayout() {
  const { conversationId, rootMessageId } = useParams<{
    conversationId?: string;
    rootMessageId?: string;
  }>();
  const selectedUser = conversationId || null;
  const selectedThreadRootId = rootMessageId || null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarView, setSidebarView] = useState<'chats' | 'calls' | 'threads'>('chats');
  const [callHistoryMenu, setCallHistoryMenu] = useState<CallHistoryMenuState | null>(null);
  const [pendingDestructiveAction, setPendingDestructiveAction] = useState<SidebarDestructiveAction | null>(null);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isConvertThreadDialogOpen, setIsConvertThreadDialogOpen] = useState(false);
  const [updatingNotificationConversationId, setUpdatingNotificationConversationId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const {
    onlineUsers,
    presenceByUserId,
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isSelectedConversationMissing,
    sendVoice,
    sendText,
    sendRichContent,
    createPoll,
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
        (conversation) =>
          conversation.conversation_id === selectedUser || conversation.id === selectedUser
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
        (conversation) =>
          conversation.conversation_id === fallback.conversation_id ||
          conversation.id === fallback.id
      )
    ) {
      return inboxConversations;
    }
    return [...inboxConversations, fallback];
  }, [inboxConversations, selectedConversationQuery.data]);
  const selectedThreadConversationQuery = useQuery({
    queryKey: ['threadConversationByRoot', selectedUser, selectedThreadRootId],
    queryFn: () =>
      conversationsApi.openThreadConversation(
        selectedUser as string,
        selectedThreadRootId as string
      ),
    enabled: !!selectedUser && !!selectedThreadRootId,
  });
  const selectedThreadConversation = selectedThreadConversationQuery.data ?? null;
  const selectedThreadConversationId =
    selectedThreadConversation?.conversation_id || selectedThreadConversation?.id || null;
  const selectedThreadDetailQuery = useQuery({
    queryKey: ['threadConversation', selectedThreadConversationId],
    queryFn: () => conversationsApi.getThreadConversation(selectedThreadConversationId as string),
    enabled: !!selectedThreadConversationId,
  });
  const selectedThreadDetail = selectedThreadDetailQuery.data ?? null;
  const isSelectedThreadLocked =
    selectedThreadDetail?.locked || !!selectedThreadConversation?.settings?.locked_at;
  const convertedThreadGroupId =
    selectedThreadDetail?.converted_to_conversation_id ??
    (typeof selectedThreadConversation?.settings?.converted_to_conversation_id === 'string'
      ? selectedThreadConversation.settings.converted_to_conversation_id
      : null);
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
  const { isTyping, typingUsers } = useTypingIndicator(selectedUser || undefined);

  const {
    pendingIncomingCount,
    contacts,
    selectedUserSummary,
    incomingPing,
    pingStatus,
    isPingAccepted,
    selectedPeerUserId,
    selectedConversation,
    selectedConversationUser,
    displaySelectedUser,
    isSelectedConversationGhost,
  } = useChatLayoutDerivedData({
    conversations,
    incoming,
    outgoing,
    selectedUser,
  });
  const selectedPresence = selectedPeerUserId ? presenceByUserId[selectedPeerUserId] : undefined;
  const selectedPresenceState: PresenceState =
    selectedPresence?.state ||
    selectedConversationUser?.presence_state ||
    selectedUserSummary?.presence_state ||
    (selectedPeerUserId && onlineUsers?.includes(selectedPeerUserId) ? 'online' : 'offline');
  const selectedIsOnline = selectedPresenceState !== 'offline';
  const isCallBusy = callPhase !== 'idle';

  const {
    data: threadMessagesPages,
    fetchNextPage: fetchNextThreadPage,
    hasNextPage: hasNextThreadPage,
    isFetchingNextPage: isFetchingNextThreadPage,
    isLoading: isLoadingThread,
  } = useThreadMessages(selectedThreadConversationId);

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
  const threadRootMessageQuery = useQuery({
    queryKey: ['message', selectedUser, selectedThreadRootId],
    queryFn: () =>
      messagesApi.getMessage(selectedUser as string, selectedThreadRootId as string),
    enabled: !!selectedUser && !!selectedThreadRootId && !selectedThreadRootMessage,
  });
  const fetchedThreadRootMessage = useMemo(
    () =>
      threadRootMessageQuery.data
        ? parseMessage(threadRootMessageQuery.data, userId)
        : null,
    [threadRootMessageQuery.data, userId]
  );
  const displayedThreadRootMessage =
    selectedThreadRootMessage ?? fetchedThreadRootMessage;

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
    openConversationMenuAtPoint,
    openConversationMenuAtCoordinates,
  } = useChatInteractionState({
    selectedUser,
    selectedThreadRootId,
    selectedThreadConversationId,
    isSelectedThreadLocked,
    displaySelectedUser,
    isMobileViewport,
    mainImageGallery,
    threadImageGallery,
    navigateToConversation: (conversationId, threadRootId) =>
      navigate(
        threadRootId
          ? APP_ROUTES.chatConversationThread(conversationId, threadRootId)
          : APP_ROUTES.chatConversation(conversationId)
      ),
    openThreadPanelInFullMode: () => setThreadPanelMode('full'),
    sendText,
    sendRichContent,
    sendVoice,
    editMessage,
    deleteMessage,
    toggleReaction,
  });

  const { setInboxState } = useConversationActions();
  const [folderDialogConversationId, setFolderDialogConversationId] = useState<string | null>(null);

  const { folderNames: inboxFolders } = useConversationFolders();

  const conversationMenuBaseConversation = conversationMenu
    ? conversations.find(
        (item) =>
          item.conversation_id === conversationMenu.peerUserId ||
          item.id === conversationMenu.peerUserId
      ) ?? null
    : null;

  const conversationMenuQuery = useQuery({
    queryKey: ['conversation', conversationMenu?.peerUserId],
    queryFn: () => conversationsApi.getConversation(conversationMenu?.peerUserId as string),
    enabled: !!conversationMenu?.peerUserId && !conversationMenuBaseConversation,
  });

  const findConversationByMenuId = (menuId: string) =>
    conversations.find((item) => item.conversation_id === menuId || item.id === menuId) ??
    (
      conversationMenuQuery.data?.conversation_id === menuId ||
      conversationMenuQuery.data?.id === menuId
        ? conversationMenuQuery.data
        : null
    );

  const conversationMenuConversation = conversationMenu
    ? conversationMenuBaseConversation ?? conversationMenuQuery.data ?? null
    : null;

  const folderDialogConversation = folderDialogConversationId
    ? findConversationByMenuId(folderDialogConversationId)
    : null;

  const sidebarContacts = useMemo(
    () => contacts.filter((conversation) => !conversation.archived),
    [contacts]
  );

  const handleSelectThread = (thread: ThreadConversationView) => {
    const parentId = thread.parent?.conversation_id || thread.thread.parent_conversation_id;
    const rootId = thread.root_message?.id || thread.thread.root_message_id;
    if (!parentId || !rootId) {
      return;
    }
    navigate(APP_ROUTES.chatConversationThread(parentId, rootId));
    resetConversationUnreadCount(thread.thread.conversation_id);
  };

  const handleConversationMenuTogglePin = (menuId: string) => {
    const conversation = findConversationByMenuId(menuId);
    setConversationMenu(null);
    if (conversation) {
      setInboxState.mutate({
        conversationId: conversation.id,
        updates: { pinned: !conversation.pinned },
      });
    }
  };

  const handleConversationMenuToggleArchive = (menuId: string) => {
    const conversation = findConversationByMenuId(menuId);
    setConversationMenu(null);
    if (conversation) {
      setInboxState.mutate({
        conversationId: conversation.id,
        updates: { archived: !conversation.archived },
      });
    }
  };

  const handleConversationMenuMoveToFolder = (menuId: string) => {
    const conversation = findConversationByMenuId(menuId);
    setConversationMenu(null);
    if (conversation) {
      setFolderDialogConversationId(conversation.id);
    }
  };

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
    selectedThreadConversationId,
    contacts,
    mainChatMessages,
    threadReplyMessages,
  });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScheduledOpen, setIsScheduledOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  // Captured before the message menu closes (which clears `activeMessage`).
  const [forwardSource, setForwardSource] = useState<
    { conversationId: string; messageId: string } | null
  >(null);

  const handleForwardMessage = () => {
    if (!activeMessage) return;
    setForwardSource({ conversationId: activeMessage.chatId, messageId: activeMessage.id });
    closeMessageMenu();
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

  // DMs allow either participant to manage message pins; larger conversations
  // follow the owner/admin pin right.
  const isPinCapableConversation =
    selectedConversation?.type === 'group';
  const { data: pinMembers } = useGroupMembers(
    isPinCapableConversation ? selectedConversation?.id ?? null : null
  );
  const canManagePins = useMemo(() => {
    if (selectedConversation?.type === 'dm') {
      return true;
    }

    if (
      selectedConversation?.owner_type === 'user' &&
      selectedConversation.owner_id === userId
    ) {
      return true;
    }
    const role = pinMembers?.find((member) => member.user_id === userId)?.role;
    return role === ROLE_ADMIN || role === ROLE_MODERATOR;
  }, [pinMembers, selectedConversation?.type, userId]);

  const isActiveMessagePinned = !!(
    activeMessage && selectedConversation?.pinned_message_ids.includes(activeMessage.id)
  );
  const canPinActiveMessage = !!(
    canManagePins &&
    activeMessage &&
    activeMessage.chatId === selectedConversation?.id
  );

  const handleTogglePinMessage = async () => {
    if (!activeMessage) return;
    const conversationId = activeMessage.chatId;
    const updatePinnedIds = (pinnedMessageIds: string[]) => {
      queryClient.setQueryData(['conversations'], (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((conversation: any) =>
              conversation.conversation_id === conversationId ||
              conversation.id === conversationId
                ? {
                    ...conversation,
                    pinned_message_ids: pinnedMessageIds,
                  }
                : conversation
            ),
          })),
        };
      });

      queryClient.setQueryData(['conversation', conversationId], (old: any) => {
        if (!old) return old;

        return {
          ...old,
          pinned_message_ids: pinnedMessageIds,
        };
      });
    };

    try {
      const updatedConversation = isActiveMessagePinned
        ? await messagesApi.unpinMessage(conversationId, activeMessage.id)
        : await messagesApi.pinMessage(conversationId, activeMessage.id);
      updatePinnedIds(updatedConversation.pinned_message_ids);
      if (isActiveMessagePinned) {
        toast.success('Message unpinned');
      } else {
        toast.success('Message pinned');
      }
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', conversationId] });
    } catch (error) {
      toast.error(extractApiError(error, 'Could not update pin'));
    } finally {
      closeMessageMenu();
    }
  };

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

    navigate(APP_ROUTES.chatConversation(selectedUser));
  };

  const openDmConversationForUser = async (userId: string) => {
    try {
      const conversation = await conversationsApi.createOrGetDm(userId);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigate(APP_ROUTES.chatConversation(conversation.id));
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to open chat'));
    }
  };

  const handleCreateGroup = async (data: { title: string; participantIds: string[] }) => {
    try {
      const conversation = await conversationsApi.createGroup({
        title: data.title,
        participant_ids: data.participantIds,
        space_id: selectedSpaceId || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigate(APP_ROUTES.chatConversation(conversation.id));
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to create group'));
      throw error;
    }
  };

  const handleConvertThreadToGroup = async (data: {
    title: string;
    participantIds: string[];
  }) => {
    if (!selectedThreadConversationId) return;
    try {
      const result = await conversationsApi.convertThreadToGroup(
        selectedThreadConversationId,
        {
          title: data.title,
          participant_ids: data.participantIds,
        }
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['threads'] }),
        queryClient.invalidateQueries({ queryKey: ['threadConversation'] }),
        queryClient.invalidateQueries({ queryKey: ['threadConversationByRoot'] }),
      ]);
      toast.success('Thread converted to group');
      navigate(APP_ROUTES.chatConversation(result.group.id));
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to convert thread'));
      throw error;
    }
  };

  const handleCycleNotificationSettings = async () => {
    if (!selectedConversation) {
      return;
    }

    const activeMute = selectedConversation.muted_until
      ? new Date(selectedConversation.muted_until).getTime() > Date.now()
      : false;
    const next: { notification_level?: NotificationLevel; muted_until?: string | null } =
      activeMute || selectedConversation.notification_level === 'none'
        ? { notification_level: 'all', muted_until: null }
        : selectedConversation.notification_level === 'all'
          ? { notification_level: 'mentions', muted_until: null }
          : {
              notification_level: 'all',
              muted_until: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
            };

    setUpdatingNotificationConversationId(selectedConversation.id);
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
                ? {
                    ...conversation,
                    notification_level: participant.notification_level,
                    muted_until: participant.muted_until,
                  }
                : conversation
            ),
          })),
        };
      });
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to update notification settings'));
    } finally {
      setUpdatingNotificationConversationId(null);
    }
  };

  const handleConversationMenuMarkAsRead = async (peerUserId: string) => {
    setConversationMenu(null);
    await handleMarkConversationAsRead(peerUserId);
  };

  const getConversationLabel = (peerUserId: string) => {
    const conversation = contacts.find(
      (item) => item.conversation_id === peerUserId || item.id === peerUserId
    );
    if (conversation?.type === 'group') {
      return conversation.title || 'Group chat';
    }
    if (conversation?.peer_user?.is_ghost) {
      return 'Ghost chat';
    }

    return conversation?.peer_user?.display_name || conversation?.peer_user?.username || peerUserId;
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
            navigate(APP_ROUTES.chatConversation(pendingDestructiveAction.peerUserId));
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
              ? `Deleted chat with ${pendingDestructiveAction.label}. ${formatCount(result.cleared_count, 'message')} cleared.`
              : `Deleted chat with ${pendingDestructiveAction.label}.`
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

      triggerHaptic('destructive');
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
        canPin={canPinActiveMessage}
        isPinned={isActiveMessagePinned}
        onTogglePin={handleTogglePinMessage}
        onForward={handleForwardMessage}
        onSave={handleSaveMessage}
      />

      <MessageSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelectResult={(message) => {
          setIsSearchOpen(false);
          navigate(APP_ROUTES.chatConversation(message.conversation_id));
        }}
      />

      <SavedMessagesDialog
        open={isSavedOpen}
        onOpenChange={setIsSavedOpen}
        onSelectSaved={(saved) => {
          setIsSavedOpen(false);
          navigate(APP_ROUTES.chatConversation(saved.conversation_id));
        }}
      />

      {selectedConversation ? (
        <ScheduledMessagesDialog
          open={isScheduledOpen}
          onOpenChange={setIsScheduledOpen}
          conversationId={selectedConversation.id}
        />
      ) : null}

      <ForwardMessageDialog
        open={!!forwardSource}
        onOpenChange={(open) => !open && setForwardSource(null)}
        conversations={conversations}
        sourceConversationId={forwardSource?.conversationId ?? null}
        messageId={forwardSource?.messageId ?? null}
        onForwarded={(targetConversationId) => {
          setForwardSource(null);
          navigate(APP_ROUTES.chatConversation(targetConversationId));
        }}
      />

      <ConversationActionsMenu
        menu={conversationMenu}
        isMobile={isMobileViewport}
        isMarkingRead={false}
        isClearingConversation={isClearingConversation}
        isDeletingConversation={isDeletingConversation}
        pinned={!!conversationMenuConversation?.pinned}
        archived={!!conversationMenuConversation?.archived}
        isUpdatingInbox={setInboxState.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setConversationMenu(null);
          }
        }}
        onTogglePin={handleConversationMenuTogglePin}
        onToggleArchive={handleConversationMenuToggleArchive}
        onMoveToFolder={handleConversationMenuMoveToFolder}
        onMarkAsRead={handleConversationMenuMarkAsRead}
        onClearConversation={handleRequestClearConversation}
        onDeleteConversation={handleRequestDeleteConversation}
      />

      <MoveToFolderDialog
        open={!!folderDialogConversation}
        onOpenChange={(open) => {
          if (!open) {
            setFolderDialogConversationId(null);
          }
        }}
        folders={inboxFolders}
        initialFolder={folderDialogConversation?.folder ?? null}
        onSave={(folder) => {
          if (folderDialogConversation) {
            setInboxState.mutate({
              conversationId: folderDialogConversation.id,
              updates: { folder },
            });
          }
          setFolderDialogConversationId(null);
        }}
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

      {selectedConversation?.type === 'group' ? (
        <GroupInfoPanel
          open={isGroupInfoOpen}
          onOpenChange={setIsGroupInfoOpen}
          conversation={selectedConversation}
          currentUserId={userId}
          contacts={contacts}
          onExitConversation={closeActiveConversation}
        />
      ) : null}

      <CreateGroupDialog
        open={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
        contacts={contacts}
        currentUserId={userId}
        onCreateGroup={handleCreateGroup}
      />
      <ConvertThreadToGroupDialog
        open={isConvertThreadDialogOpen}
        onOpenChange={setIsConvertThreadDialogOpen}
        thread={selectedThreadDetail}
        contacts={contacts}
        currentUserId={userId}
        onConvert={handleConvertThreadToGroup}
      />
      <CreateChannelDialog
        open={isChannelDialogOpen}
        onOpenChange={setIsChannelDialogOpen}
        onCreated={(channelId) => {
          navigate(APP_ROUTES.channel(channelId));
        }}
      />
      {selectedConversation?.type === 'group' ? (
        <InviteToConversationDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
          conversationId={selectedConversation.id}
        />
      ) : null}

      <ChatActionRail
        pendingIncomingCount={pendingIncomingCount}
        sidebarView={sidebarView}
        profile={profile}
        userEmail={userEmail}
        selectedSpaceId={selectedSpaceId}
        onSpaceChange={setSelectedSpaceId}
        onSelectView={setSidebarView}
        onOpenPings={() => navigate(APP_ROUTES.pingsTab('incoming'))}
        onOpenContacts={() => navigate(APP_ROUTES.contacts)}
        onOpenSpaces={() => navigate(APP_ROUTES.spaces)}
        onOpenFeeds={() => navigate(APP_ROUTES.feeds)}
        onNewGroup={() => setIsGroupDialogOpen(true)}
        onNewChannel={() => setIsChannelDialogOpen(true)}
        onOpenProfile={() => navigate(APP_ROUTES.me)}
        onOpenSettings={() => navigate(APP_ROUTES.settingsTab('profile'))}
        onLogout={handleLogout}
      />

      <ChatSidebar
        selectedSpaceId={selectedSpaceId}
        onSpaceChange={setSelectedSpaceId}
        profile={profile}
        userEmail={userEmail}
        currentUserId={userId}
        pendingIncomingCount={pendingIncomingCount}
        contacts={sidebarContacts}
        callHistory={callHistory}
        sidebarView={sidebarView}
        selectedUser={selectedUser}
        typingUsers={typingUsers}
        presenceByUserId={presenceByUserId}
        activeCallHistoryMenuPeerUserId={callHistoryMenu?.peerUserId || null}
        isLoadingCallHistory={isLoadingCallHistory}
        hasMoreCallHistory={hasNextCallHistoryPage}
        isFetchingMoreCallHistory={isFetchingNextCallHistoryPage}
        isClearingCallHistory={isDeletingHistory}
        onOpenSettings={() => navigate(APP_ROUTES.settingsTab('profile'))}
        onOpenOwnProfile={() => navigate(APP_ROUTES.me)}
        onOpenPings={() => navigate(APP_ROUTES.pingsTab('incoming'))}
        onOpenContacts={() => navigate(APP_ROUTES.contacts)}
        onOpenSpaces={() => navigate(APP_ROUTES.spaces)}
        onOpenFeeds={() => navigate(APP_ROUTES.feeds)}
        onLogout={handleLogout}
        onNewGroup={() => setIsGroupDialogOpen(true)}
        onNewChannel={() => setIsChannelDialogOpen(true)}
        onSidebarViewChange={setSidebarView}
        onLoadMoreCallHistory={() => void fetchNextCallHistoryPage()}
        onClearAllCallHistory={handleRequestClearAllCallHistory}
        onSelectSearchUser={(id) => void openDmConversationForUser(id)}
        onSelectConversation={(conversationId) => {
          navigate(APP_ROUTES.chatConversation(conversationId));
          resetConversationUnreadCount(conversationId);
        }}
        onSelectThread={handleSelectThread}
        onSelectCallHistoryPeer={(peerUserId) => {
          void openDmConversationForUser(peerUserId);
        }}
        onOpenConversationMenuAtPoint={openConversationMenuAtPoint}
        onOpenConversationMenuAtCoordinates={openConversationMenuAtCoordinates}
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
              selectedUser={selectedPeerUserId || ''}
              displaySelectedUser={displaySelectedUser}
              selectedConversationUserAvatarUrl={selectedConversationUser?.avatar?.url}
              isTyping={isTyping}
              isOnline={!!selectedPeerUserId && selectedIsOnline}
              presenceState={selectedPresenceState}
              isGhost={isSelectedConversationGhost}
              conversationType={selectedConversation?.type}
              showInvite={selectedConversation?.type === 'group'}
              onOpenInvite={() => setIsInviteDialogOpen(true)}
              notificationLevel={selectedConversation?.notification_level}
              mutedUntil={selectedConversation?.muted_until}
              isUpdatingNotifications={
                updatingNotificationConversationId === selectedConversation?.id
              }
              onCycleNotificationLevel={
                selectedConversation ? handleCycleNotificationSettings : undefined
              }
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
                selectedConversation
                  ? () => setFolderDialogConversationId(selectedConversation.id)
                  : undefined
              }
              isPingAccepted={isPingAccepted}
              pingStatus={pingStatus}
              isSendingPing={isSendingPing}
              canPing={!!selectedPeerUserId && (!selectedUserSummary || selectedUserSummary.can_ping !== false)}
              canCall={!!selectedPeerUserId && isPingAccepted && selectedPeerUserId !== userId}
              isCallBusy={isCallBusy}
              onCloseConversation={closeActiveConversation}
              onOpenProfile={() => {
                if (selectedPeerUserId) {
                  navigate(APP_ROUTES.profile(selectedPeerUserId));
                }
              }}
              onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
              onOpenSearch={() => setIsSearchOpen(true)}
              onOpenScheduled={
                isPingAccepted && selectedConversation
                  ? () => setIsScheduledOpen(true)
                  : undefined
              }
              onOpenSaved={() => setIsSavedOpen(true)}
              onSendPing={() => {
                if (selectedPeerUserId) {
                  sendPing(selectedPeerUserId);
                }
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
                          selectedConversationUser?.display_name ||
                          selectedUserSummary?.display_name ||
                          displaySelectedUser ||
                          null,
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
                          selectedConversationUser?.display_name ||
                          selectedUserSummary?.display_name ||
                          displaySelectedUser ||
                          null,
                        avatar: selectedConversationUser?.avatar || selectedUserSummary?.avatar || null,
                        is_online: selectedIsOnline,
                      },
                    })
                  : undefined
              }
            />

            {selectedConversation && selectedConversation.pinned_message_ids.length > 0 ? (
              <PinnedMessagesBar
                conversationId={selectedConversation.id}
                pinnedMessageIds={selectedConversation.pinned_message_ids}
                canManagePins={canManagePins}
              />
            ) : null}

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
                    receiverId={selectedUser}
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
                      const targetMessage =
                        displayedThreadRootMessage?.id === messageId
                          ? displayedThreadRootMessage
                          : threadReplyMessages.find((message) => message.id === messageId);
                      if (!targetMessage) return;
                      await toggleReaction({
                        container_type: targetMessage.raw.container_type,
                        container_id: targetMessage.raw.container_id,
                        messageId,
                        emoji,
                      });
                      triggerHaptic('reaction');
                    }}
                    isTogglingReaction={isTogglingReaction}
                    onVisibleUnreadMessages={handleVisibleThreadMessageIds}
                    onMediaClick={handleThreadMediaClick}
                    audioQueueKey={threadAudioQueueKey}
                    audioQueue={threadAudioQueue}
                    isMobile={isMobileViewport}
                    isMessageMenuOpen={!!activeMessage}
                    isLocked={isSelectedThreadLocked}
                    convertedToConversationId={convertedThreadGroupId}
                    canConvertToGroup={
                      !!selectedThreadConversation &&
                      selectedThreadConversation.created_by === userId &&
                      !isSelectedThreadLocked
                    }
                    onOpenConvertedConversation={
                      convertedThreadGroupId
                        ? () => navigate(APP_ROUTES.chatConversation(convertedThreadGroupId))
                        : undefined
                    }
                    onConvertToGroup={() => setIsConvertThreadDialogOpen(true)}
                    style={{ width: threadPanelWidth }}
                    composer={
                      displayedThreadRootMessage && !isSelectedThreadLocked ? (
                        <div className="bg-background px-3">
                          <ChatComposer
                            receiverId={selectedThreadConversationId || selectedUser}
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
            ) : (
              <ConversationAccessState
                pingStatus={pingStatus}
                displaySelectedUser={displaySelectedUser}
                isGhost={isSelectedConversationGhost}
                incomingPingId={incomingPing?.id || null}
                isAcceptingPing={isAcceptingPing}
                isDecliningPing={isDecliningPing}
                isSendingPing={isSendingPing}
                canSendPing={
                  !!selectedPeerUserId &&
                  !isSendingPing &&
                  !(selectedUserSummary && selectedUserSummary.can_ping === false)
                }
                onAcceptPing={(pingId) => acceptPing(pingId)}
                onDeclinePing={(pingId) => declinePing(pingId)}
                onSendPing={() => {
                  if (selectedPeerUserId) {
                    sendPing(selectedPeerUserId);
                  }
                }}
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
