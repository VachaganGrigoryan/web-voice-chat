import React, { useEffect, useRef } from 'react';
import { ArrowDown, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PresenceState } from '@/api/types';
import type { ContainerDescriptor } from '@/container';
import type { ChannelLens } from '@/features/channels/useChannelLens';
import { ProfileChannelTimeline } from '@/features/profile/components/ProfileChannelTimeline';
import { ContainerHeader } from './components/ContainerHeader';
import { ConversationAccessState } from './components/ConversationAccessState';
import { NotificationSoundPrompt } from './components/NotificationSoundPrompt';
import { PinnedMessagesBar } from './components/PinnedMessagesBar';
import { ThreadReplyBadge } from './components/ThreadReplyBadge';
import { ChatTimelineItems } from './components/ChatTimelineItems';
import { GlobalAudioPlayerBar } from './media/players/GlobalAudioPlayerBar';
import { useChatTimelineState } from './hooks/useChatTimelineState';
import { ChatMessage } from './types/message';
import { ChatRenderItem } from './utils/mediaGroupUtils';
import { MessageMenuAnchor } from './components/MessageShell';

interface AccessGateProps {
  pingStatus: string;
  displaySelectedUser?: string | null;
  isGhost?: boolean;
  incomingPingId: string | null;
  isAcceptingPing: boolean;
  isDecliningPing: boolean;
  isSendingPing: boolean;
  canSendPing: boolean;
  onAcceptPing: (pingId: string) => void;
  onDeclinePing: (pingId: string) => void;
  onSendPing: () => void;
}

interface PinnedBarProps {
  conversationId: string;
  pinnedMessageIds: string[];
  canManagePins: boolean;
}

interface ContainerPaneProps {
  descriptor: ContainerDescriptor;

  // Header
  onClose: () => void;
  onOpenInfo: () => void;
  onOpenSearch?: () => void;
  onNavigate: (path: string) => void;
  channelLens?: ChannelLens;
  onChannelLensChange?: (lens: ChannelLens) => void;
  isTypingInHeader?: boolean;
  isOnline?: boolean;
  presenceState?: PresenceState;
  isGhost?: boolean;
  notificationLevel?: import('@/api/types').NotificationLevel;
  mutedUntil?: string | null;
  isUpdatingNotifications?: boolean;
  onCycleNotificationLevel?: () => void;
  inboxPinned?: boolean;
  inboxArchived?: boolean;
  isUpdatingInboxState?: boolean;
  onToggleInboxPin?: () => void;
  onToggleInboxArchive?: () => void;
  onMoveToFolder?: () => void;
  isPingAccepted?: boolean;
  pingStatus?: string;
  isSendingPing?: boolean;
  canPing?: boolean;
  canCall?: boolean;
  isCallBusy?: boolean;
  onOpenGroupInfo?: () => void;
  onOpenScheduled?: () => void;
  onOpenSaved?: () => void;
  onSendPing?: () => void;
  onStartAudioCall?: () => void;
  onStartVideoCall?: () => void;

  // Access gate — present only for a conversation the viewer hasn't opened yet.
  accessGate?: AccessGateProps;

  pinnedBar?: PinnedBarProps;

  showNotificationSoundPrompt: boolean;
  isEnablingSound: boolean;
  onEnableSound: () => void;
  onDismissSoundPrompt: () => void;

  // Timeline
  isTyping: boolean;
  renderItems: ChatRenderItem[];
  mainChatMessages: ChatMessage[];
  highlightedMessageIds: Set<string>;
  currentUserId?: string | null;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onVisibleMessageIdsChange: (messageIds: string[]) => void;
  onOpenMenu: (message: ChatMessage, anchor: MessageMenuAnchor) => void;
  onSwipeReply?: (message: ChatMessage) => void;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  isTogglingReaction: boolean;
  onMediaClick: (payload: { type: 'image' | 'video'; messageId: string; url: string; downloadName?: string }) => void;
  audioQueueKey?: string | null;
  audioQueue?: Array<{
    id: string;
    src: string;
    durationMs: number;
    createdAt: string;
    isRead: boolean;
    isMe: boolean;
  }>;
  isMessageMenuOpen: boolean;
  onOpenThread: (message: ChatMessage) => void;
  splitLayoutRef: React.RefObject<HTMLDivElement | null>;
  composer?: React.ReactNode;
  resizeHandle?: React.ReactNode;
  threadPanel?: React.ReactNode;
}

/**
 * The chat pane: header, timeline and composer, driven entirely by the
 * descriptor. It replaces `MainChatPane` — the timeline logic that used to
 * live there is folded in here so this one component owns the whole pane
 * rather than needing a sibling header assembled by the caller.
 */
export function ContainerPane({
  descriptor,
  onClose,
  onOpenInfo,
  onOpenSearch,
  onNavigate,
  channelLens,
  onChannelLensChange,
  isTypingInHeader = false,
  isOnline = false,
  presenceState,
  isGhost = false,
  notificationLevel,
  mutedUntil,
  isUpdatingNotifications,
  onCycleNotificationLevel,
  inboxPinned,
  inboxArchived,
  isUpdatingInboxState,
  onToggleInboxPin,
  onToggleInboxArchive,
  onMoveToFolder,
  isPingAccepted = false,
  pingStatus,
  isSendingPing,
  canPing,
  canCall,
  isCallBusy,
  onOpenGroupInfo,
  onOpenScheduled,
  onOpenSaved,
  onSendPing,
  onStartAudioCall,
  onStartVideoCall,
  accessGate,
  pinnedBar,
  showNotificationSoundPrompt,
  isEnablingSound,
  onEnableSound,
  onDismissSoundPrompt,
  isTyping,
  renderItems,
  mainChatMessages,
  highlightedMessageIds,
  currentUserId,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  onVisibleMessageIdsChange,
  onOpenMenu,
  onSwipeReply,
  onToggleReaction,
  isTogglingReaction,
  onMediaClick,
  audioQueueKey,
  audioQueue,
  isMessageMenuOpen,
  onOpenThread,
  splitLayoutRef,
  composer,
  resizeHandle,
  threadPanel,
}: ContainerPaneProps) {
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreObserverRef = useRef<IntersectionObserver | null>(null);
  const isFetchingNextPageRef = useRef(isFetchingNextPage);

  const isChannelFeedLens = descriptor.source.kind === 'channel' && channelLens === 'feed';
  const isContainerOpen = descriptor.source.kind === 'channel' || isPingAccepted;

  const {
    scrollContainerRef,
    pendingNewMessageCount,
    registerMessageElement,
    handleScroll,
    scrollToLatest,
  } = useChatTimelineState({
    enabled: true,
    resetKey: descriptor.ref.container_id,
    latestMessageId: mainChatMessages[0]?.id || null,
    messageIds: mainChatMessages.map((message) => message.id),
    newestEdge: 'start',
    onVisibleMessageIdsChange,
  });

  useEffect(() => {
    isFetchingNextPageRef.current = isFetchingNextPage;
  }, [isFetchingNextPage]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    const sentinel = loadMoreSentinelRef.current;

    loadMoreObserverRef.current?.disconnect();
    loadMoreObserverRef.current = null;

    if (!root || !sentinel || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || isFetchingNextPageRef.current) {
          return;
        }

        isFetchingNextPageRef.current = true;
        void Promise.resolve(fetchNextPage()).finally(() => {
          isFetchingNextPageRef.current = false;
        });
      },
      { root, rootMargin: '120px 0px 0px 0px' }
    );

    observer.observe(sentinel);
    loadMoreObserverRef.current = observer;

    return () => {
      observer.disconnect();
      if (loadMoreObserverRef.current === observer) {
        loadMoreObserverRef.current = null;
      }
    };
  }, [fetchNextPage, hasNextPage, scrollContainerRef]);

  return (
    <>
      <ContainerHeader
        descriptor={descriptor}
        onClose={onClose}
        onOpenInfo={onOpenInfo}
        onOpenSearch={onOpenSearch}
        onNavigate={onNavigate}
        lens={channelLens}
        onLensChange={onChannelLensChange}
        isTyping={isTypingInHeader}
        isOnline={isOnline}
        presenceState={presenceState}
        isGhost={isGhost}
        notificationLevel={notificationLevel}
        mutedUntil={mutedUntil}
        isUpdatingNotifications={isUpdatingNotifications}
        onCycleNotificationLevel={onCycleNotificationLevel}
        inboxPinned={inboxPinned}
        inboxArchived={inboxArchived}
        isUpdatingInboxState={isUpdatingInboxState}
        onToggleInboxPin={onToggleInboxPin}
        onToggleInboxArchive={onToggleInboxArchive}
        onMoveToFolder={onMoveToFolder}
        isPingAccepted={isPingAccepted}
        pingStatus={pingStatus}
        isSendingPing={isSendingPing}
        canPing={canPing}
        canCall={canCall}
        isCallBusy={isCallBusy}
        onOpenGroupInfo={onOpenGroupInfo}
        onOpenScheduled={onOpenScheduled}
        onOpenSaved={onOpenSaved}
        onSendPing={onSendPing}
        onStartAudioCall={onStartAudioCall}
        onStartVideoCall={onStartVideoCall}
      />

      {pinnedBar && pinnedBar.pinnedMessageIds.length > 0 ? (
        <PinnedMessagesBar
          conversationId={pinnedBar.conversationId}
          pinnedMessageIds={pinnedBar.pinnedMessageIds}
          canManagePins={pinnedBar.canManagePins}
        />
      ) : null}

      {isContainerOpen && showNotificationSoundPrompt ? (
        <NotificationSoundPrompt
          isEnabling={isEnablingSound}
          onEnable={onEnableSound}
          onDismiss={onDismissSoundPrompt}
        />
      ) : null}

      {isChannelFeedLens ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
            <ProfileChannelTimeline channelId={descriptor.ref.container_id} />
          </div>
        </div>
      ) : isContainerOpen ? (
        <>
          <GlobalAudioPlayerBar />
          <div ref={splitLayoutRef} className="flex min-h-0 flex-1">
            <div className="relative flex min-w-0 flex-1 flex-col">
              <div
                ref={scrollContainerRef}
                className="scrollbar-hidden flex-1 overflow-y-auto flex flex-col-reverse p-4 scroll-smooth overscroll-contain"
                onScroll={(event) => handleScroll(event.currentTarget)}
              >
                {isTyping ? (
                  <div className="self-start mb-2 ml-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-secondary/50 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-muted-foreground flex items-center gap-2 shadow-sm">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                ) : null}

                <ChatTimelineItems
                  renderItems={renderItems}
                  chronology="newest-first"
                  currentUserId={currentUserId}
                  highlightedMessageIds={highlightedMessageIds}
                  onOpenMenu={onOpenMenu}
                  onSwipeReply={onSwipeReply}
                  onToggleReaction={onToggleReaction}
                  isTogglingReaction={isTogglingReaction}
                  onMediaClick={onMediaClick}
                  audioQueueKey={audioQueueKey}
                  audioQueue={audioQueue}
                  isMessageMenuOpen={isMessageMenuOpen}
                  registerMessageElement={registerMessageElement}
                  standaloneSystemMessages
                  getBubbleFooter={(message) =>
                    message.isThreadRoot || message.threadReplyCount > 0 ? (
                      <ThreadReplyBadge message={message} onOpenThread={() => onOpenThread(message)} />
                    ) : null
                  }
                />

                {isFetchingNextPage ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : null}

                <div className="h-1 w-full" ref={loadMoreSentinelRef} />

                {mainChatMessages.length === 0 && !isFetchingNextPage ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                    <div className="bg-muted/30 p-4 rounded-full mb-3">
                      <MessageSquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Start the conversation by sending a message</p>
                  </div>
                ) : null}
              </div>

              {pendingNewMessageCount > 0 ? (
                <div className="absolute bottom-24 right-4 z-20">
                  <Button size="sm" className="gap-2 rounded-full shadow-lg" onClick={() => scrollToLatest()}>
                    <ArrowDown className="h-4 w-4" />
                    <span>
                      {pendingNewMessageCount === 1 ? '1 new message' : `${pendingNewMessageCount} new messages`}
                    </span>
                  </Button>
                </div>
              ) : null}

              {composer ? <div className="shrink-0 z-20 bg-background px-4">{composer}</div> : null}
            </div>

            {resizeHandle}
            {threadPanel}
          </div>
        </>
      ) : accessGate ? (
        <ConversationAccessState
          pingStatus={accessGate.pingStatus}
          displaySelectedUser={accessGate.displaySelectedUser}
          isGhost={accessGate.isGhost}
          incomingPingId={accessGate.incomingPingId}
          isAcceptingPing={accessGate.isAcceptingPing}
          isDecliningPing={accessGate.isDecliningPing}
          isSendingPing={accessGate.isSendingPing}
          canSendPing={accessGate.canSendPing}
          onAcceptPing={accessGate.onAcceptPing}
          onDeclinePing={accessGate.onDeclinePing}
          onSendPing={accessGate.onSendPing}
        />
      ) : null}
    </>
  );
}
