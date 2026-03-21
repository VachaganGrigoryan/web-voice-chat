import { useState, useRef, useEffect, useMemo } from 'react';
import { useChat, useConversations, useThreadMessages } from '@/hooks/useChat';
import { usePings } from '@/hooks/usePings';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { Conversation } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Separator } from '@/components/ui/Separator';
import { LogOut, User, MessageSquare, Plus, Loader2, Mic, ArrowLeft, Check, CheckCheck, Bell, Clock, UserPlus, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import VoiceRecorder from './VoiceRecorder';
import MediaComposer from './MediaComposer';
import { MessageRenderer } from './MessageRenderer';
import { MediaViewer } from './MediaViewer';
import UserSettings from './UserSettings';
import { PingsModal } from './PingsModal';
import { GlobalAudioPlayerBar } from './GlobalAudioPlayerBar';
import { UserProfileModal } from './UserProfileModal';
import { MessageActionsDialog } from './components/MessageActionsDialog';
import { ThreadPanel } from './components/ThreadPanel';
import { ThreadReplyBadge } from './components/ThreadReplyBadge';
import { useChatAudioPlayerStore } from './audioPlayerStore';
import { MessageItem, MessageMenuAnchor, MessageMeta } from './components/MessageShell';
import { ProfileTriggerButton } from './components/ProfileTriggerButton';
import { cn } from '@/lib/utils';
import { useTypingIndicator, useSocketStore } from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { useProfile } from '@/hooks/useProfile';
import { AudioMessage, ChatMessage, ComposerReplyTarget } from './types/message';
import {
  formatMessageDay,
  isSameLocalDay,
} from '@/utils/dateUtils';
import { parseMessages } from './utils/messageParser';

import { UserSearch } from './UserSearch';

type ThreadPanelMode = 'minimal' | 'center' | 'full';
type ActiveMessageSurface = 'main' | 'thread';

const MOBILE_BREAKPOINT = 768;
const THREAD_PANEL_MODES: ThreadPanelMode[] = ['minimal', 'center', 'full'];

const getThreadPanelWidths = (containerWidth: number): Record<ThreadPanelMode, number> => {
  const safeWidth = Math.max(containerWidth, 720);
  const minMainWidth = 360;
  const maxThreadWidth = Math.max(320, safeWidth - minMainWidth);
  const preferredWidths: Record<ThreadPanelMode, number> = {
    minimal: Math.round(safeWidth * 0.32),
    center: Math.round(safeWidth * 0.4),
    full: Math.round(safeWidth * 0.48),
  };

  return THREAD_PANEL_MODES.reduce(
    (widths, mode) => ({
      ...widths,
      [mode]: Math.min(maxThreadWidth, Math.max(320, preferredWidths[mode])),
    }),
    {} as Record<ThreadPanelMode, number>
  );
};

const createAcceptedPingConversation = (
  conversationId: string,
  peerUser: Conversation['peer_user'],
  lastMessageAt: string | null
): Conversation => ({
  conversation_id: conversationId,
  peer_user: peerUser,
  last_message: null,
  unread_count: 0,
  last_message_at: lastMessageAt,
});

export default function ChatLayout() {
  const [selectedThreadRootId, setSelectedThreadRootId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    selectedUser,
    setSelectedUser,
    onlineUsers,
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sendVoice,
    sendText,
    editMessage,
    deleteMessage,
    isSending,
    isEditingMessage,
    isDeletingMessage,
  } = useChat(selectedThreadRootId);

  useEffect(() => {
    const userFromUrl = searchParams.get('user');
    if (userFromUrl && userFromUrl !== selectedUser) {
      setSelectedUser(userFromUrl);
      // Clean up URL
      setSearchParams({});
    }
  }, [searchParams, selectedUser, setSelectedUser, setSearchParams]);

  const { data: conversationsData } = useConversations();
  const conversations = useMemo(() => 
    conversationsData?.pages.flatMap(page => page.data || []).filter(Boolean) || [],
    [conversationsData]
  );
  const queryClient = useQueryClient();

  const { userEmail, userId, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const [newUserId, setNewUserId] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPingsOpen, setIsPingsOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{ open: boolean; type: 'image' | 'video'; url: string }>({ open: false, type: 'image', url: '' });
  const { profile } = useProfile();
  const { socket } = useSocketStore();
  const { incoming, outgoing, sendPing, acceptPing, declinePing, isSending: isSendingPing, isAccepting: isAcceptingPing, isDeclining: isDecliningPing } = usePings();
  const setAudioQueue = useChatAudioPlayerStore((state) => state.setQueue);
  const closeAudioPlayer = useChatAudioPlayerStore((state) => state.close);
  const pendingIncomingCount = incoming.filter(item => item.ping.status === 'pending').length;
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
  
  const { isTyping, typingUsers } = useTypingIndicator(selectedUser || undefined);

  const contacts = useMemo(() => {
    const list: Conversation[] = [...conversations];
    const conversationUserIds = new Set(conversations.map(c => c?.peer_user?.id).filter(Boolean));
    
    // Add accepted incoming pings
    incoming.filter(Boolean).forEach(item => {
      if (item.ping?.status === 'accepted' && item.peer?.id && !conversationUserIds.has(item.peer.id)) {
        list.push(
          createAcceptedPingConversation(`ping-${item.ping.id}`, item.peer, item.ping.updated_at)
        );
        conversationUserIds.add(item.peer.id);
      }
    });

    // Add accepted outgoing pings
    outgoing.filter(Boolean).forEach(item => {
      if (item.ping?.status === 'accepted' && item.peer?.id && !conversationUserIds.has(item.peer.id)) {
        list.push(
          createAcceptedPingConversation(`ping-${item.ping.id}`, item.peer, item.ping.updated_at)
        );
        conversationUserIds.add(item.peer.id);
      }
    });

    // Sort by last_message_at descending
    return list.filter(Boolean).sort((a, b) => {
      const timeA = new Date(a.last_message_at || 0).getTime();
      const timeB = new Date(b.last_message_at || 0).getTime();
      return timeB - timeA;
    });
  }, [conversations, incoming, outgoing]);

  const selectedUserSummary = useMemo(() => {
    if (!selectedUser) return null;
    return conversations.find(c => c?.peer_user?.id === selectedUser)?.peer_user || null;
  }, [selectedUser, conversations]);

  const incomingPing = useMemo(() => 
    selectedUser ? incoming.find(item => item?.peer?.id === selectedUser)?.ping : null,
    [selectedUser, incoming]
  );

  const pingStatus = useMemo(() => {
    if (!selectedUser) return 'none';
    if (selectedUserSummary) return selectedUserSummary.ping_status;
    if (incomingPing?.status === 'pending') return 'incoming_pending';
    if (outgoing.find(item => item?.peer?.id === selectedUser)?.ping.status === 'pending') return 'outgoing_pending';
    return 'none';
  }, [selectedUser, selectedUserSummary, incomingPing, outgoing]);

  const isPingAccepted = useMemo(() => {
    if (!selectedUser) return false;
    
    if (selectedUserSummary) {
      return selectedUserSummary.chat_allowed || selectedUserSummary.ping_status === 'accepted';
    }

    return incoming.some(item => item?.peer?.id === selectedUser && item?.ping?.status === 'accepted') ||
           outgoing.some(item => item?.peer?.id === selectedUser && item?.ping?.status === 'accepted');
  }, [selectedUser, selectedUserSummary, incoming, outgoing]);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } finally {
      logout();
      navigate('/auth');
    }
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
  const audioQueue = useMemo(
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

  const readEmittedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    readEmittedMessagesRef.current.clear();
    setHighlightedMessageIds(new Set());
    setActiveMessage(null);
    setActiveMessageAnchor(null);
    setActiveMessageSurface('main');
    setReplyTarget(null);
    setThreadReplyTarget(null);
    setSelectedThreadRootId(null);
    setIsResizingThread(false);
  }, [selectedUser]);

  useEffect(() => {
    setThreadReplyTarget(null);
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

  useEffect(() => {
    if (!socket || !selectedUser || !allMessages.length) return;

    const unreadMessages = allMessages.filter(
      (m) => m.receiver_id === userId && 
             m.status !== 'read' && 
             m.type !== 'voice' &&
             !readEmittedMessagesRef.current.has(m.id)
    );

    if (unreadMessages.length > 0) {
      const newIds = unreadMessages.map(m => m.id);
      
      // Mark as emitted immediately to avoid re-processing in next render
      newIds.forEach(id => readEmittedMessagesRef.current.add(id));

      // Emit conversation-level read event for the open chat
      socket.emit(EVENTS.CONVERSATION_READ, { user_id: selectedUser });

      // Update UI highlight
      setHighlightedMessageIds((prev) => {
        const next = new Set(prev);
        newIds.forEach(id => next.add(id));
        return next;
      });

      const timer = setTimeout(() => {
        setHighlightedMessageIds((prev) => {
          const next = new Set(prev);
          newIds.forEach(id => next.delete(id));
          return next;
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [allMessages, selectedUser, socket, userId]);

  useEffect(() => {
    if (!selectedUser || !isPingAccepted) {
      setAudioQueue(null, []);
      return;
    }

    setAudioQueue(selectedUser, audioQueue);
  }, [audioQueue, isPingAccepted, selectedUser, setAudioQueue]);

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

  const selectedConversationUser = contacts.find(c => c.peer_user.id === selectedUser)?.peer_user;
  const displaySelectedUser = selectedConversationUser?.display_name || selectedConversationUser?.username || selectedUser;
  const canAccessSelectedUserProfile = !!selectedConversationUser && (
    selectedConversationUser.chat_allowed || selectedConversationUser.ping_status === 'accepted'
  );

  const shouldGroupMessages = (current: ChatMessage, adjacent?: ChatMessage) => {
    if (!adjacent) return false;
    if (current.kind === 'system' || adjacent.kind === 'system') return false;
    if (current.senderId !== adjacent.senderId) return false;
    if (!isSameLocalDay(current.createdAt, adjacent.createdAt)) return false;

    const currentTime = new Date(current.createdAt).getTime();
    const adjacentTime = new Date(adjacent.createdAt).getTime();
    return Math.abs(currentTime - adjacentTime) <= 60 * 1000;
  };

  const getMessagePreviewText = (message: ChatMessage) => {
    if (message.isDeleted) return 'Message deleted';
    if (message.kind === 'text' || message.kind === 'emoji') return message.text;
    if (message.kind === 'image' || message.kind === 'video') return message.caption || `${message.kind} message`;
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
    const rootMessageId = message.isThreadRoot ? message.id : message.threadRootId || message.id;
    if (isMobileViewport) {
      setThreadPanelMode('full');
    }
    setSelectedThreadRootId(rootMessageId);
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
  }) => {
    await sendVoice({
      ...data,
      reply_mode: replyTarget?.mode,
      reply_to_message_id: replyTarget?.messageId,
    });
    setReplyTarget(null);
  };

  const handleSendThreadMedia = async (data: {
    type: 'voice' | 'image' | 'sticker' | 'video' | 'file';
    receiver_id: string;
    file: File;
    text?: string;
    duration_ms?: number;
  }) => {
    if (!selectedThreadRootId) return;
    await sendVoice({
      ...data,
      reply_mode: 'thread',
      reply_to_message_id: threadReplyTarget?.messageId || selectedThreadRootId,
    });
    setThreadReplyTarget(null);
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

  const handleMediaClick = (type: 'image' | 'video', url: string) => {
    setMediaViewer({ open: true, type, url });
  };

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
        onClose={() => setMediaViewer(prev => ({ ...prev, open: false }))}
      />
      <PingsModal 
        isOpen={isPingsOpen} 
        onClose={() => setIsPingsOpen(false)} 
        onSelectUser={(id) => {
          setSelectedUser(id);
          setIsPingsOpen(false);
        }}
      />
      <UserProfileModal
        isOpen={isUserProfileOpen}
        onClose={() => setIsUserProfileOpen(false)}
        userId={selectedUser}
        initialData={selectedConversationUser}
        canAccessProfile={canAccessSelectedUserProfile}
      />
      <UserSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
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
      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-80 border-r flex flex-col bg-muted/10 h-full",
        selectedUser ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b flex items-center justify-between shrink-0 h-16">
          <ProfileTriggerButton
            title={profile?.display_name || profile?.username || userEmail}
            subtitle={profile?.username ? `@${profile.username}` : undefined}
            avatarUrl={profile?.avatar?.url}
            fallback={(profile?.display_name || profile?.username || userEmail || '?')[0].toUpperCase()}
            onClick={() => setIsSettingsOpen(true)}
            className="max-w-[60%]"
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setIsPingsOpen(true)} className="relative">
              <Bell className="h-4 w-4" />
              {pendingIncomingCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col min-h-0">
          <UserSearch onSelectUser={(id) => setSelectedUser(id)} />
          
          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider shrink-0">
            Chats
          </div>
          
          <ScrollArea className="flex-1 -mx-4 px-4">
            <div className="space-y-1 pb-4">
              {contacts.map((conv) => (
                <Button
                  key={conv.conversation_id}
                  variant={selectedUser === conv.peer_user.id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-sm font-normal py-3 h-auto",
                    conv.peer_user.id === userId && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => {
                    setSelectedUser(conv.peer_user.id);
                    resetConversationUnreadCount(conv.peer_user.id);
                  }}
                >
                  <div className="relative mr-3">
                    <Avatar className="h-8 w-8">
                      {conv.peer_user.avatar ? (
                        <AvatarImage src={conv.peer_user.avatar.url} />
                      ) : null}
                      <AvatarFallback>{(conv.peer_user.display_name || conv.peer_user.username || conv.peer_user.id)[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {conv.peer_user.is_online && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                    )}
                  </div>
                  <div className="flex flex-col items-start overflow-hidden flex-1">
                     <div className="flex justify-between items-center w-full">
                       <span className={cn("truncate text-left", conv.unread_count > 0 ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
                         {conv.peer_user.display_name || conv.peer_user.username || conv.peer_user.id}
                       </span>
                       {conv.unread_count > 0 && (
                         <div className="flex items-center gap-1.5 ml-2 shrink-0">
                           <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                           <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                             {conv.unread_count > 99 ? '99+' : conv.unread_count}
                           </span>
                         </div>
                       )}
                     </div>
                     <span className={cn("text-xs truncate w-full text-left", conv.unread_count > 0 ? "text-foreground font-semibold" : "text-muted-foreground")}>
                       {typingUsers[conv.peer_user.id] ? (
                         <span className="text-primary font-medium animate-pulse">Typing...</span>
                       ) : (
                         conv.last_message?.type === 'voice' ? '🎤 Voice message' : conv.last_message?.text || 'Click to chat'
                       )}
                     </span>
                  </div>
                </Button>
              ))}
              
              {contacts.length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center bg-muted/30 rounded-lg border border-dashed m-1">
                  No recent conversations
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

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
                  onClick={() => setSelectedUser(null)}
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
                  onClick={() => setIsUserProfileOpen(true)}
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
                    setIsUploading={() => {}}
                    replyTarget={replyTarget}
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
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex-1 overflow-y-auto flex flex-col-reverse p-4 scroll-smooth overscroll-contain">
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

                 {mainChatMessages.map((message, index) => {
                     const newerMessage = mainChatMessages[index - 1];
                     const nextMessage = mainChatMessages[index + 1];
                     const showDateHeader = !nextMessage ||
                       !isSameLocalDay(message.createdAt, nextMessage.createdAt);
                     const groupedWithAbove = shouldGroupMessages(message, nextMessage);
                     const groupedWithBelow = shouldGroupMessages(message, newerMessage);

                     return (
                       <div
                         key={message.id}
                         className={cn(
                           "flex flex-col w-full min-w-0",
                           groupedWithAbove ? "mt-px" : index === mainChatMessages.length - 1 ? "" : "mt-6"
                         )}
                       >
                         {message.kind === 'system' ? (
                           <MessageRenderer
                             message={message}
                             highlighted={highlightedMessageIds.has(message.id)}
                             onMediaClick={handleMediaClick}
                           />
                         ) : (
                           <MessageItem
                             isOwn={message.isOwn}
                             onOpenMenu={(anchor) => openMessageMenu(message, anchor, 'main')}
                             openMenuOnClick={!!activeMessage}
                           >
                             <MessageRenderer
                               message={message}
                               highlighted={highlightedMessageIds.has(message.id)}
                               groupedWithAbove={groupedWithAbove}
                               groupedWithBelow={groupedWithBelow}
                               onMediaClick={handleMediaClick}
                             />
                             <MessageMeta message={message} showTimestamp={!groupedWithBelow} />
                             {message.isThreadRoot || message.threadReplyCount > 0 ? (
                               <ThreadReplyBadge message={message} onOpenThread={() => openThreadForMessage(message)} />
                             ) : null}
                           </MessageItem>
                         )}
                         
                         {showDateHeader && (
                           <div className="flex justify-center my-6">
                             <div className="bg-muted/50 text-muted-foreground text-[10px] font-medium px-3 py-1 rounded-full shadow-sm border border-border/50">
                               {formatMessageDay(message.createdAt)}
                             </div>
                           </div>
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
                    onClose={() => setSelectedThreadRootId(null)}
                    onOpenMenu={(message, anchor) => openMessageMenu(message, anchor, 'thread')}
                    onMediaClick={handleMediaClick}
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
                              setIsUploading={() => {}}
                              replyTarget={threadReplyTarget}
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
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 p-4 text-center">
                {(() => {
                  if (pingStatus === 'incoming_pending') {
                    const pingId = incomingPing?.id;
                    return (
                      <>
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                          <Bell className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">Incoming Request</h3>
                        <p className="max-w-xs text-sm text-muted-foreground mb-6">
                          {displaySelectedUser} wants to chat with you.
                        </p>
                        <div className="flex items-center gap-3">
                          <Button 
                            onClick={() => pingId && acceptPing(pingId)}
                            disabled={isAcceptingPing || !pingId}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isAcceptingPing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Accept
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => pingId && declinePing(pingId)}
                            disabled={isDecliningPing || !pingId}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            {isDecliningPing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                            Decline
                          </Button>
                        </div>
                      </>
                    );
                  }
                  
                  if (pingStatus === 'outgoing_pending') {
                    return (
                      <>
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Clock className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">Request Sent</h3>
                        <p className="max-w-xs text-sm text-muted-foreground">
                          Waiting for {displaySelectedUser} to accept your request.
                        </p>
                      </>
                    );
                  }

                  return (
                    <>
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <UserPlus className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Start Chatting</h3>
                      <p className="max-w-xs text-sm text-muted-foreground mb-6">
                        Send a ping to {displaySelectedUser} to start a conversation.
                      </p>
                      <Button 
                        onClick={() => sendPing(selectedUser)}
                        disabled={isSendingPing || (selectedUserSummary && !selectedUserSummary.can_ping)}
                      >
                        {isSendingPing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                        Send Ping
                      </Button>
                    </>
                  );
                })()}
              </div>
            )}

          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 p-4 text-center">
            <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6 shadow-sm">
              <div className="h-12 w-12 rounded-full border-[4px] border-red-500 flex items-center justify-center">
                <div className="h-4 w-4 rounded-full bg-red-500" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Welcome to Voca</h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              A new era secure and fast messenger. Select a user from the sidebar to start chatting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
