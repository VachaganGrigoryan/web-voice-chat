import { useState, useRef, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Loader2, ArrowDown, ArrowLeft, Bell, Clock, UserPlus, Check, X } from 'lucide-react';
import { useChat, useConversations, useThreadMessages } from '@/hooks/useChat';
import { usePings } from '@/hooks/usePings';
import { APP_ROUTES } from '@/app/routes';
import { useAuthStore } from '@/store/authStore';
import { Conversation, MessageDoc } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { authApi, messagesApi } from '@/api/endpoints';
import MediaComposer from './MediaComposer';
import VoiceRecorder from './media/recorders/VoiceRecorder';
import { GlobalAudioPlayerBar } from './media/players/GlobalAudioPlayerBar';
import { useChatAudioPlayerStore } from './media/players/audioPlayerStore';
import { MessageRenderer } from './MessageRenderer';
import { MediaViewer } from './MediaViewer';
import { MessageActionsDialog } from './components/MessageActionsDialog';
import { MessageReactions } from './components/MessageReactions';
import { ThreadPanel } from './components/ThreadPanel';
import { ThreadReplyBadge } from './components/ThreadReplyBadge';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatWelcomeState } from './components/ChatWelcomeState';
import { ConversationAccessState } from './components/ConversationAccessState';
import { ConversationActionsMenu, ConversationMenuState } from './components/ConversationActionsMenu';
import { DaySeparator, MessageBubbleFooter, MessageItem, MessageMenuAnchor, MessageMeta } from './components/MessageShell';
import { ProfileTriggerButton } from './components/ProfileTriggerButton';
import { cn } from '@/lib/utils';
import {
  applyMessageStatusUpdateToCaches,
  MessageStatusPayload,
  useTypingIndicator,
  useSocketStore,
} from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { useProfile } from '@/hooks/useProfile';
import { useChatLayoutDerivedData } from './hooks/useChatLayoutDerivedData';
import { AudioMessage, ChatMessage, ComposerReplyTarget, ImageMessage, MediaClickPayload } from './types/message';
import {
  formatMessageDay,
  isSameLocalDay,
} from '@/utils/dateUtils';
import { parseMessages } from './utils/messageParser';
import { MediaViewerImageItem } from './MediaViewer';
import { MediaCollageGroupRenderer } from './renderers/MediaCollageGroupRenderer';
import { buildChatRenderItems, shouldGroupMessages } from './utils/mediaGroupUtils';
import { getThreadPanelWidths, MOBILE_BREAKPOINT, THREAD_PANEL_MODES, type ThreadPanelMode } from './utils/chatLayoutUtils';

type ActiveMessageSurface = 'main' | 'thread';
type MediaViewerState =
  | { open: false; type: 'image' | 'video'; url: ''; items: MediaViewerImageItem[]; initialItemId: null; downloadName?: string }
  | { open: true; type: 'image'; url: ''; items: MediaViewerImageItem[]; initialItemId: string; downloadName?: string }
  | { open: true; type: 'video'; url: string; items: []; initialItemId: null; downloadName?: string };

export default function ChatLayout() {
  const MAIN_CHAT_BOTTOM_THRESHOLD = 80;
  const { peerUserId, rootMessageId } = useParams<{ peerUserId?: string; rootMessageId?: string }>();
  const selectedUser = peerUserId || null;
  const selectedThreadRootId = rootMessageId || null;
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
  const conversations = useMemo(() => 
    conversationsData?.pages.flatMap(page => page.data || []).filter(Boolean) || [],
    [conversationsData]
  );
  const queryClient = useQueryClient();

  const { userEmail, userId, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState>({
    open: false,
    type: 'image',
    url: '',
    items: [],
    initialItemId: null,
  });
  const { profile } = useProfile();
  const { socket } = useSocketStore();
  const { incoming, outgoing, sendPing, acceptPing, declinePing, isSending: isSendingPing, isAccepting: isAcceptingPing, isDeclining: isDecliningPing } = usePings();
  const syncAudioQueue = useChatAudioPlayerStore((state) => state.syncQueue);
  const closeAudioPlayer = useChatAudioPlayerStore((state) => state.close);
  const [highlightedMessageIds, setHighlightedMessageIds] = useState<Set<string>>(new Set());
  const [activeMessage, setActiveMessage] = useState<ChatMessage | null>(null);
  const [activeMessageAnchor, setActiveMessageAnchor] = useState<MessageMenuAnchor | null>(null);
  const [activeMessageSurface, setActiveMessageSurface] = useState<ActiveMessageSurface>('main');
  const [replyTarget, setReplyTarget] = useState<ComposerReplyTarget | null>(null);
  const [threadReplyTarget, setThreadReplyTarget] = useState<ComposerReplyTarget | null>(null);
  const [threadPanelMode, setThreadPanelMode] = useState<ThreadPanelMode>('center');
  const [isResizingThread, setIsResizingThread] = useState(false);
  const [splitLayoutWidth, setSplitLayoutWidth] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  const splitLayoutRef = useRef<HTMLDivElement | null>(null);
  const mainChatScrollRef = useRef<HTMLDivElement | null>(null);
  const latestMainMessageIdRef = useRef<string | null>(null);
  const isMainNearBottomRef = useRef(true);
  const [pendingMainNewMessageCount, setPendingMainNewMessageCount] = useState(0);
  const [conversationMenu, setConversationMenu] = useState<ConversationMenuState | null>(null);
  const mainMessageElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
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

  const navigateToConversation = (peerId: string, threadRootId?: string | null) => {
    navigate(
      threadRootId
        ? APP_ROUTES.chatThread(peerId, threadRootId)
        : APP_ROUTES.chatPeer(peerId)
    );
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

  const allMessages = useMemo(() => 
    messages?.pages.flatMap((page) => page.data || []).filter(Boolean) || [],
    [messages]
  );
  const chatMessages = useMemo(
    () => parseMessages(allMessages, userId),
    [allMessages, userId]
  );
  const mainChatMessages = useMemo(
    () => chatMessages.filter((message) => message.replyMode !== 'thread'),
    [chatMessages]
  );
  const mainChatRenderItems = useMemo(
    () => buildChatRenderItems(mainChatMessages),
    [mainChatMessages]
  );
  const selectedThreadRootMessage = useMemo(
    () => chatMessages.find((message) => message.id === selectedThreadRootId) || null,
    [chatMessages, selectedThreadRootId]
  );
  const {
    data: threadMessagesPages,
    fetchNextPage: fetchNextThreadPage,
    hasNextPage: hasNextThreadPage,
    isFetchingNextPage: isFetchingNextThreadPage,
    isLoading: isLoadingThread,
  } = useThreadMessages(selectedThreadRootId);
  const allThreadMessages = useMemo(
    () => threadMessagesPages?.pages.flatMap((page) => page.data || []).filter(Boolean) || [],
    [threadMessagesPages]
  );
  const threadMessages = useMemo(
    () => parseMessages(allThreadMessages, userId),
    [allThreadMessages, userId]
  );
  const threadPanelWidths = useMemo(
    () => getThreadPanelWidths(splitLayoutWidth),
    [splitLayoutWidth]
  );
  const mainAudioQueueKey = selectedUser ? `main:${selectedUser}` : null;
  const mainAudioQueue = useMemo(
    () =>
      mainChatMessages
        .filter((message): message is AudioMessage => message.kind === 'audio')
        .reverse()
        .map((message) => ({
          id: message.id,
          src: message.audioUrl,
          durationMs: message.durationSec ? message.durationSec * 1000 : 0,
          createdAt: message.createdAt,
          isRead: message.status === 'read',
          isMe: message.isOwn,
        })),
    [mainChatMessages]
  );
  const threadAudioQueueKey = selectedThreadRootId ? `thread:${selectedThreadRootId}` : null;
  const threadAudioQueue = useMemo(() => {
    if (!selectedThreadRootMessage) {
      return [];
    }

    return [selectedThreadRootMessage, ...threadMessages]
      .filter((message): message is AudioMessage => message.kind === 'audio')
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .map((message) => ({
        id: message.id,
        src: message.audioUrl,
        durationMs: message.durationSec ? message.durationSec * 1000 : 0,
        createdAt: message.createdAt,
        isRead: message.status === 'read',
        isMe: message.isOwn,
      }));
  }, [selectedThreadRootMessage, threadMessages]);
  const mainImageGallery = useMemo(
    () =>
      [...mainChatMessages]
        .reverse()
        .filter((message): message is ImageMessage => message.kind === 'image' && !!message.imageUrl)
        .map((message) => ({
          id: message.id,
          url: message.imageUrl,
          downloadName: message.fileName,
        })),
    [mainChatMessages]
  );
  const threadImageGallery = useMemo(
    () =>
      [selectedThreadRootMessage, ...threadMessages]
        .filter((message): message is ImageMessage => !!message && message.kind === 'image' && !!message.imageUrl)
        .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
        .map((message) => ({
          id: message.id,
          url: message.imageUrl,
          downloadName: message.fileName,
        })),
    [selectedThreadRootMessage, threadMessages]
  );

  const mainReadEmittedMessagesRef = useRef<Set<string>>(new Set());
  const threadReadEmittedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mainReadEmittedMessagesRef.current.clear();
    threadReadEmittedMessagesRef.current.clear();
    mainMessageElementRefs.current.clear();
    setHighlightedMessageIds(new Set());
    setActiveMessage(null);
    setActiveMessageAnchor(null);
    setActiveMessageSurface('main');
    setReplyTarget(null);
    setThreadReplyTarget(null);
    setIsResizingThread(false);
    latestMainMessageIdRef.current = null;
    isMainNearBottomRef.current = true;
    setPendingMainNewMessageCount(0);
    setConversationMenu(null);
  }, [selectedUser]);

  useEffect(() => {
    setThreadReplyTarget(null);
    threadReadEmittedMessagesRef.current.clear();
  }, [selectedThreadRootId]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!selectedThreadRootId) {
      setIsResizingThread(false);
      return;
    }

    if (isMobileViewport) {
      setThreadPanelMode('full');
    }
  }, [isMobileViewport, selectedThreadRootId]);

  useEffect(() => {
    const node = splitLayoutRef.current;
    if (!node) return;

    const updateWidth = () => {
      setSplitLayoutWidth(node.getBoundingClientRect().width);
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    return () => observer.disconnect();
  }, [selectedUser, isPingAccepted, selectedThreadRootId]);

  const emitMessageRead = (messageIds: string[], payload: MessageStatusPayload) => {
    if (!messageIds.length) return;

    if (socket) {
      messageIds.forEach((messageId) => {
        socket.emit(EVENTS.MESSAGE_READ, { message_id: messageId });
      });
    }

    applyMessageStatusUpdateToCaches(queryClient, payload);
  };

  const highlightReadMessages = (messageIds: string[]) => {
    if (!messageIds.length) return;

    setHighlightedMessageIds((prev) => {
      const next = new Set(prev);
      messageIds.forEach((id) => next.add(id));
      return next;
    });

    window.setTimeout(() => {
      setHighlightedMessageIds((prev) => {
        const next = new Set(prev);
        messageIds.forEach((id) => next.delete(id));
        return next;
      });
    }, 3000);
  };

  const emitVisibleMainReadMessages = () => {
    if (!socket || !selectedUser || !mainChatScrollRef.current) {
      return;
    }

    const containerRect = mainChatScrollRef.current.getBoundingClientRect();
    const unreadVisibleMessages = mainChatMessages.filter(
      (message) =>
        message.receiverId === userId &&
        message.status !== 'read' &&
        !mainReadEmittedMessagesRef.current.has(message.id)
    );

    const visibleIds = unreadVisibleMessages
      .filter((message) => {
        const element = mainMessageElementRefs.current.get(message.id);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.bottom > containerRect.top && rect.top < containerRect.bottom;
      })
      .map((message) => message.id);

    if (!visibleIds.length) {
      return;
    }

    visibleIds.forEach((id) => mainReadEmittedMessagesRef.current.add(id));

    emitMessageRead(visibleIds, {
      conversation_id: unreadVisibleMessages[0]?.chatId,
      peer_user_id: selectedUser,
      message_ids: visibleIds,
      status: 'read',
      scope: 'main',
      read_at: new Date().toISOString(),
    } as MessageStatusPayload & { peer_user_id: string });

    highlightReadMessages(visibleIds);
  };

  useEffect(() => {
    if (!selectedUser || !mainChatMessages.length) return;

    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      emitVisibleMainReadMessages();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mainChatMessages, selectedUser]);

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

  const resetConversationUnreadCount = (peerUserId: string) => {
    queryClient.setQueryData(['conversations'], (old: any) => {
      if (!old?.pages) return old;

      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          data: page.data.map((conversation: Conversation) =>
            conversation.peer_user.id === peerUserId
              ? { ...conversation, unread_count: 0 }
              : conversation
          ),
        })),
      };
    });
  };

  useEffect(() => {
    if (!selectedUser) return;
    resetConversationUnreadCount(selectedUser);
  }, [selectedUser]);

  const markConversationCachesAsRead = (conversationId: string) => {
    const collectedIds = new Set<string>();

    const collectUnreadIds = (datasets: Array<[unknown, any]>) => {
      datasets.forEach(([, data]) => {
        const pages = data?.pages || [];
        pages.forEach((page: any) => {
          (page.data || []).forEach((message: MessageDoc) => {
            if (message.conversation_id === conversationId && message.receiver_id === userId && message.status !== 'read') {
              collectedIds.add(message.id);
            }
          });
        });
      });
    };

    collectUnreadIds(queryClient.getQueriesData({ queryKey: ['messages'] }));
    collectUnreadIds(queryClient.getQueriesData({ queryKey: ['threadMessages'] }));

    if (collectedIds.size > 0) {
      applyMessageStatusUpdateToCaches(queryClient, {
        conversation_id: conversationId,
        message_ids: [...collectedIds],
        status: 'read',
        read_at: new Date().toISOString(),
        scope: 'main',
      });
    }

    queryClient.setQueriesData({ queryKey: ['messages'] }, (old: any) => {
      if (!old?.pages) return old;

      let changed = false;
      const pages = old.pages.map((page: any) => ({
        ...page,
        data: (page.data || []).map((message: MessageDoc) => {
          if (message.conversation_id !== conversationId) {
            return message;
          }

          if ((message.thread_unread_count ?? 0) === 0) {
            return message;
          }

          changed = true;
          return {
            ...message,
            thread_unread_count: 0,
          };
        }),
      }));

      return changed ? { ...old, pages } : old;
    });
  };

  const handleMarkConversationAsRead = async (peerUserId: string) => {
    const conversation = contacts.find((item) => item.peer_user.id === peerUserId);
    setConversationMenu(null);
    if (!conversation) return;

    await messagesApi.markConversationRead(peerUserId);
    socket?.emit(EVENTS.CONVERSATION_READ, {
      peer_user_id: peerUserId,
    });
    resetConversationUnreadCount(peerUserId);
    markConversationCachesAsRead(conversation.conversation_id);
  };

  const openConversationMenu = (
    event: ReactMouseEvent<HTMLElement>,
    peerUserId: string,
    unreadCount: number
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setConversationMenu({
      peerUserId,
      unreadCount,
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      },
    });
  };

  const openConversationMenuAtPoint = (
    event: ReactMouseEvent<HTMLElement>,
    peerUserId: string,
    unreadCount: number
  ) => {
    setConversationMenu({
      peerUserId,
      unreadCount,
      rect: {
        top: event.clientY,
        right: event.clientX,
        bottom: event.clientY,
        left: event.clientX,
      },
    });
  };

  const getMessagePreviewText = (message: ChatMessage) => {
    if (message.isDeleted) return 'Message deleted';
    if (message.kind === 'text' || message.kind === 'emoji') return message.text;
    if (message.kind === 'image' || message.kind === 'video') return message.caption || `${message.kind} message`;
    if (message.kind === 'file') return message.caption || message.fileName || 'File';
    if (message.kind === 'audio') return 'Voice message';
    if (message.kind === 'sticker') return 'Sticker';
    if (message.kind === 'system') return message.text;
    return 'Message';
  };

  const createReplyTarget = (message: ChatMessage, mode: ComposerReplyTarget['mode']): ComposerReplyTarget => ({
    messageId: message.id,
    mode,
    previewText: getMessagePreviewText(message),
    senderLabel: message.isOwn ? 'You' : displaySelectedUser || 'Contact',
  });

  const closeMessageMenu = () => {
    setActiveMessage(null);
    setActiveMessageAnchor(null);
    setActiveMessageSurface('main');
  };

  const openMessageMenu = (
    message: ChatMessage,
    anchor: MessageMenuAnchor,
    surface: ActiveMessageSurface
  ) => {
    setActiveMessage(message);
    setActiveMessageAnchor(anchor);
    setActiveMessageSurface(surface);
  };

  const handleSelectReplyMode = () => {
    if (!activeMessage) return;

    if (activeMessageSurface === 'thread') {
      setThreadReplyTarget(createReplyTarget(activeMessage, 'thread'));
      closeMessageMenu();
      return;
    }

    setReplyTarget(createReplyTarget(activeMessage, 'quote'));
    closeMessageMenu();
  };

  const openThreadForMessage = (message: ChatMessage) => {
    if (!selectedUser) {
      return;
    }

    const rootMessageId = message.isThreadRoot ? message.id : message.threadRootId || message.id;
    if (isMobileViewport) {
      setThreadPanelMode('full');
    }
    navigateToConversation(selectedUser, rootMessageId);
    closeMessageMenu();
  };

  const handleSendText = async (data: { receiver_id: string; text: string }) => {
    await sendText({
      ...data,
      reply_mode: replyTarget?.mode,
      reply_to_message_id: replyTarget?.messageId,
    });
    setReplyTarget(null);
  };

  const handleSendThreadText = async (data: { receiver_id: string; text: string }) => {
    if (!selectedThreadRootId) return;
    await sendText({
      ...data,
      reply_mode: 'thread',
      reply_to_message_id: threadReplyTarget?.messageId || selectedThreadRootId,
    });
    setThreadReplyTarget(null);
  };

  const handleSendMedia = async (data: {
    type: 'voice' | 'image' | 'sticker' | 'video' | 'file';
    receiver_id: string;
    file: File;
    text?: string;
    duration_ms?: number;
    reply_mode?: ComposerReplyTarget['mode'] | null;
    reply_to_message_id?: string;
    client_batch_id?: string;
    signal?: AbortSignal;
    onUploadProgress?: (progress: number) => void;
  }) => {
    await sendVoice({
      ...data,
      reply_mode: data.reply_mode ?? replyTarget?.mode,
      reply_to_message_id: data.reply_to_message_id ?? replyTarget?.messageId,
    });
  };

  const handleSendThreadMedia = async (data: {
    type: 'voice' | 'image' | 'sticker' | 'video' | 'file';
    receiver_id: string;
    file: File;
    text?: string;
    duration_ms?: number;
    reply_mode?: ComposerReplyTarget['mode'] | null;
    reply_to_message_id?: string;
    client_batch_id?: string;
    signal?: AbortSignal;
    onUploadProgress?: (progress: number) => void;
  }) => {
    if (!selectedThreadRootId) return;
    await sendVoice({
      ...data,
      reply_mode: data.reply_mode ?? 'thread',
      reply_to_message_id: data.reply_to_message_id ?? threadReplyTarget?.messageId ?? selectedThreadRootId,
    });
  };

  const handleEditMessage = async (text: string) => {
    if (!activeMessage) return;
    await editMessage({ messageId: activeMessage.id, text });
    closeMessageMenu();
  };

  const handleDeleteMessage = async () => {
    if (!activeMessage) return;
    await deleteMessage(activeMessage.id);
    closeMessageMenu();
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    await toggleReaction({ messageId, emoji });
  };

  const openImageViewer = (items: MediaViewerImageItem[], initialItemId: string) => {
    setMediaViewer({
      open: true,
      type: 'image',
      url: '',
      items,
      initialItemId,
    });
  };
  const handleMainMediaClick = (payload: MediaClickPayload) => {
    if (payload.type === 'image') {
      openImageViewer(mainImageGallery, payload.messageId);
      return;
    }

    setMediaViewer({
      open: true,
      type: 'video',
      url: payload.url,
      items: [],
      initialItemId: null,
      downloadName: payload.downloadName,
    });
  };
  const handleThreadMediaClick = (payload: MediaClickPayload) => {
    if (payload.type === 'image') {
      openImageViewer(threadImageGallery, payload.messageId);
      return;
    }

    setMediaViewer({
      open: true,
      type: 'video',
      url: payload.url,
      items: [],
      initialItemId: null,
      downloadName: payload.downloadName,
    });
  };

  const isMainChatNearBottom = (container: HTMLDivElement | null) => {
    if (!container) return true;
    return container.scrollTop <= MAIN_CHAT_BOTTOM_THRESHOLD;
  };

  const scrollMainChatToLatest = (behavior: ScrollBehavior = 'smooth') => {
    const container = mainChatScrollRef.current;
    if (!container) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        container.scrollTo({ top: 0, behavior });
        isMainNearBottomRef.current = true;
        setPendingMainNewMessageCount(0);
      });
    });
  };

  useEffect(() => {
    if (!selectedUser) return;

    const latestMessageId = mainChatMessages[0]?.id || null;
    if (!latestMessageId) {
      latestMainMessageIdRef.current = null;
      return;
    }

    if (!latestMainMessageIdRef.current) {
      latestMainMessageIdRef.current = latestMessageId;
      scrollMainChatToLatest('auto');
      return;
    }

    if (latestMainMessageIdRef.current === latestMessageId) {
      return;
    }

    latestMainMessageIdRef.current = latestMessageId;

    if (isMainNearBottomRef.current) {
      scrollMainChatToLatest();
      return;
    }

    setPendingMainNewMessageCount((current) => current + 1);
  }, [selectedUser, mainChatMessages]);

  const updateThreadPanelModeFromPointer = (clientX: number) => {
    if (isMobileViewport) return;

    const layoutRect = splitLayoutRef.current?.getBoundingClientRect();
    if (!layoutRect) return;

    const desiredWidth = layoutRect.right - clientX;
    const nearestMode = THREAD_PANEL_MODES.reduce((closestMode, mode) => {
      const currentDistance = Math.abs(threadPanelWidths[mode] - desiredWidth);
      const closestDistance = Math.abs(threadPanelWidths[closestMode] - desiredWidth);
      return currentDistance < closestDistance ? mode : closestMode;
    }, 'minimal' as ThreadPanelMode);

    setThreadPanelMode(nearestMode);
  };

  useEffect(() => {
    if (!isResizingThread || isMobileViewport || !selectedThreadRootMessage) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      updateThreadPanelModeFromPointer(event.clientX);
    };

    const handlePointerUp = () => {
      setIsResizingThread(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [isMobileViewport, isResizingThread, selectedThreadRootMessage, threadPanelWidths]);

  const threadPanelWidth = isMobileViewport ? '100%' : `${threadPanelWidths[threadPanelMode]}px`;

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <MediaViewer 
        open={mediaViewer.open}
        type={mediaViewer.type}
        url={mediaViewer.url}
        items={mediaViewer.items}
        initialItemId={mediaViewer.initialItemId}
        downloadName={mediaViewer.downloadName}
        onClose={() =>
          setMediaViewer({
            open: false,
            type: 'image',
            url: '',
            items: [],
            initialItemId: null,
          })
        }
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
        onMarkAsRead={handleMarkConversationAsRead}
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
        onSelectSearchUser={(id) => navigateToConversation(id)}
        onSelectConversation={(peerUserId) => {
          navigateToConversation(peerUserId);
          resetConversationUnreadCount(peerUserId);
        }}
        onOpenConversationMenu={openConversationMenu}
        onOpenConversationMenuAtPoint={openConversationMenuAtPoint}
      />

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 bg-background h-full relative",
        selectedUser ? "flex" : "hidden md:flex"
      )}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b flex items-center px-4 justify-between bg-background/95 backdrop-blur z-10 shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden -ml-2 h-10 w-10 rounded-full" 
                  onClick={closeActiveConversation}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <ProfileTriggerButton
                  title={displaySelectedUser}
                  subtitle={
                    isTyping ? (
                      <span className="text-primary font-medium animate-pulse">Typing...</span>
                    ) : onlineUsers?.includes(selectedUser) ? (
                      'Online'
                    ) : (
                      'Offline'
                    )
                  }
                  avatarUrl={selectedConversationUser?.avatar?.url}
                  fallback={(displaySelectedUser || '?')[0].toUpperCase()}
                  onClick={() => selectedUser && navigate(APP_ROUTES.profile(selectedUser))}
                  disabled={!selectedUser}
                  online={!!selectedUser && onlineUsers?.includes(selectedUser)}
                  avatarClassName="h-9 w-9 border"
                  className="max-w-full"
                />
              </div>
              
              <div className="flex items-center">
                {isPingAccepted ? (
                  <MediaComposer 
                    receiverId={selectedUser} 
                    onSendMedia={handleSendMedia}
                    isUploading={isSending}
                    replyTarget={replyTarget}
                    onClearReplyTarget={() => setReplyTarget(null)}
                  />
                ) : (
                  <Button 
                    onClick={() => sendPing(selectedUser)}
                    disabled={isSendingPing || (selectedUserSummary && !selectedUserSummary.can_ping) || pingStatus === 'outgoing_pending' || pingStatus === 'incoming_pending'}
                    size="sm"
                  >
                    {pingStatus === 'outgoing_pending' ? (
                      <><Clock className="h-4 w-4 mr-2" />Pending</>
                    ) : pingStatus === 'incoming_pending' ? (
                      <><Bell className="h-4 w-4 mr-2" />Request Received</>
                    ) : (
                      <>{isSendingPing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}Send Ping</>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Messages Area */}
            {isPingAccepted ? (
              <>
                <GlobalAudioPlayerBar />

                <div ref={splitLayoutRef} className="flex min-h-0 flex-1">
                  <div className="relative flex min-w-0 flex-1 flex-col">
                    <div
                      ref={mainChatScrollRef}
                      className="scrollbar-hidden flex-1 overflow-y-auto flex flex-col-reverse p-4 scroll-smooth overscroll-contain"
                      onScroll={(event) => {
                        const nextIsNearBottom = isMainChatNearBottom(event.currentTarget);
                        isMainNearBottomRef.current = nextIsNearBottom;
                        if (nextIsNearBottom) {
                          setPendingMainNewMessageCount(0);
                        }
                        emitVisibleMainReadMessages();
                      }}
                    >
                   {/* Typing Indicator Bubble */}
                   {isTyping && (
                     <div className="self-start mb-2 ml-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                       <div className="bg-secondary/50 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-muted-foreground flex items-center gap-2 shadow-sm">
                         <div className="flex gap-1">
                           <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                           <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                           <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></span>
                         </div>
                       </div>
                     </div>
                   )}

                 {mainChatRenderItems.map((item, index) => {
                     const newerItem = mainChatRenderItems[index - 1];
                     const olderItem = mainChatRenderItems[index + 1];
                     const showDaySeparator = !olderItem ||
                       !isSameLocalDay(item.lastMessage.createdAt, olderItem.firstMessage.createdAt);
                     const groupedWithAbove = shouldGroupMessages(item.lastMessage, olderItem?.firstMessage);
                     const groupedWithBelow = shouldGroupMessages(item.firstMessage, newerItem?.lastMessage);
                     const isHighlighted = item.messages.some((message) => highlightedMessageIds.has(message.id));

                     return (
                       <div
                         key={item.id}
                         ref={(node) => {
                           item.messages.forEach((message) => {
                             if (node) {
                               mainMessageElementRefs.current.set(message.id, node);
                             } else {
                               mainMessageElementRefs.current.delete(message.id);
                             }
                           });
                         }}
                       className={cn(
                           "flex flex-col w-full min-w-0",
                           groupedWithAbove ? "mt-px" : index === mainChatRenderItems.length - 1 ? "" : "mt-6"
                         )}
                       >
                         {showDaySeparator && (
                           <DaySeparator
                             label={formatMessageDay(item.lastMessage.createdAt)}
                             className="mb-3"
                           />
                         )}

                         {item.type === 'single' && item.message.kind === 'system' ? (
                           <MessageRenderer
                             message={item.message}
                             highlighted={isHighlighted}
                             onMediaClick={handleMainMediaClick}
                           />
                         ) : item.type === 'media-group' ? (
                           <MessageItem
                             isOwn={item.isOwn}
                             onOpenMenu={(anchor) => openMessageMenu(item.latestMessage, anchor, 'main')}
                             openMenuOnClick={!!activeMessage}
                           >
                             <MediaCollageGroupRenderer
                               messages={item.messages}
                               caption={item.caption}
                               highlighted={isHighlighted}
                               groupedWithAbove={groupedWithAbove}
                               groupedWithBelow={groupedWithBelow}
                               onMediaClick={handleMainMediaClick}
                             />
                             <MessageMeta message={item.latestMessage} showTimestamp={!groupedWithBelow} />
                           </MessageItem>
                         ) : (
                           <MessageItem
                             isOwn={item.message.isOwn}
                             onOpenMenu={(anchor) => openMessageMenu(item.message, anchor, 'main')}
                             openMenuOnClick={!!activeMessage}
                           >
                            <MessageRenderer
                              message={item.message}
                             highlighted={isHighlighted}
                              groupedWithAbove={groupedWithAbove}
                              groupedWithBelow={groupedWithBelow}
                              onMediaClick={handleMainMediaClick}
                              audioQueueKey={mainAudioQueueKey}
                              audioQueue={mainAudioQueue}
                              bubbleFooter={
                                item.message.isThreadRoot || item.message.threadReplyCount > 0 ? (
                                  <MessageBubbleFooter>
                                    <ThreadReplyBadge
                                      message={item.message}
                                      onOpenThread={() => openThreadForMessage(item.message)}
                                    />
                                  </MessageBubbleFooter>
                                ) : undefined
                              }
                            />
                            <MessageReactions
                              message={item.message}
                              currentUserId={userId}
                              isBusy={isTogglingReaction}
                              onToggleReaction={(emoji) => handleToggleReaction(item.message.id, emoji)}
                            />
                            <MessageMeta message={item.message} showTimestamp={!groupedWithBelow} />
                          </MessageItem>
                        )}
                       </div>
                     );
                   })}
                   
                   {isFetchingNextPage && (
                     <div className="flex justify-center py-4">
                       <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                     </div>
                   )}
                   
                   <div 
                     className="h-1 w-full" 
                     ref={(node) => {
                         if (node && hasNextPage && !isFetchingNextPage) {
                             const observer = new IntersectionObserver((entries) => {
                                 if (entries[0].isIntersecting) {
                                     fetchNextPage();
                                 }
                             });
                             observer.observe(node);
                             return () => observer.disconnect();
                         }
                     }}
                   />
                   
                   {mainChatMessages.length === 0 && !isFetchingNextPage && (
                      <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                          <div className="bg-muted/30 p-4 rounded-full mb-3">
                              <MessageSquare className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground font-medium">No messages yet</p>
                          <p className="text-xs text-muted-foreground">Start the conversation by sending a message</p>
                      </div>
                   )}
                    </div>

                    {pendingMainNewMessageCount > 0 ? (
                      <div className="absolute bottom-24 right-4 z-20">
                        <Button
                          size="sm"
                          className="gap-2 rounded-full shadow-lg"
                          onClick={() => scrollMainChatToLatest()}
                        >
                          <ArrowDown className="h-4 w-4" />
                          <span>
                            {pendingMainNewMessageCount === 1
                              ? '1 new message'
                              : `${pendingMainNewMessageCount} new messages`}
                          </span>
                        </Button>
                      </div>
                    ) : null}

                    <div className="shrink-0 z-20 bg-background flex items-center gap-2 p-4">
                      <VoiceRecorder 
                        receiverId={selectedUser} 
                        onSendVoice={handleSendMedia}
                        onSendText={handleSendText}
                        replyTarget={replyTarget}
                        onClearReplyTarget={() => setReplyTarget(null)}
                      />
                    </div>
                  </div>

                  {selectedThreadRootMessage && !isMobileViewport ? (
                    <button
                      type="button"
                      aria-label="Resize thread panel"
                      className={cn(
                        'group relative hidden w-4 shrink-0 cursor-col-resize touch-none md:flex',
                        isResizingThread ? 'bg-muted/40' : 'bg-gradient-to-b from-transparent via-muted/20 to-transparent'
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setIsResizingThread(true);
                        updateThreadPanelModeFromPointer(event.clientX);
                      }}
                    >
                      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/70" />
                      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-20 w-2.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm transition-colors group-hover:bg-muted">
                        <span className="h-8 w-[3px] rounded-full bg-border/80" />
                      </span>
                    </button>
                  ) : null}

                  <ThreadPanel
                    open={!!selectedThreadRootMessage}
                    rootMessage={selectedThreadRootMessage}
                    messages={threadMessages}
                    isLoading={isLoadingThread}
                    isFetchingNextPage={isFetchingNextThreadPage}
                    hasNextPage={!!hasNextThreadPage}
                    fetchNextPage={fetchNextThreadPage}
                    currentUserId={userId}
                    onClose={closeThreadRoute}
                    onOpenMenu={(message, anchor) => openMessageMenu(message, anchor, 'thread')}
                    onToggleReaction={handleToggleReaction}
                    isTogglingReaction={isTogglingReaction}
                    onVisibleUnreadMessages={(messageIds) => {
                      if (!socket || !selectedThreadRootId || !messageIds.length) return;

                      const unreadIds = messageIds.filter(
                        (id) => !threadReadEmittedMessagesRef.current.has(id)
                      );
                      if (!unreadIds.length) return;

                      unreadIds.forEach((id) => threadReadEmittedMessagesRef.current.add(id));

                      emitMessageRead(unreadIds, {
                        conversation_id: selectedThreadRootMessage?.chatId,
                        peer_user_id: selectedUser,
                        thread_root_id: selectedThreadRootId,
                        message_ids: unreadIds,
                        status: 'read',
                        scope: 'thread',
                        read_at: new Date().toISOString(),
                      } as MessageStatusPayload & { peer_user_id: string });

                      highlightReadMessages(unreadIds);
                    }}
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
                </div>
              </>
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
                onSendPing={() => selectedUser && sendPing(selectedUser)}
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
