import React from 'react';
import { ArrowDown, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import VoiceRecorder from '../media/recorders/VoiceRecorder';
import { GlobalAudioPlayerBar } from '../media/players/GlobalAudioPlayerBar';
import { ComposerReplyTarget, ChatMessage } from '../types/message';
import { ChatRenderItem } from '../utils/mediaGroupUtils';
import { MessageMenuAnchor } from './MessageShell';
import { ChatTimelineItems } from './ChatTimelineItems';
import { useChatTimelineState } from '../hooks/useChatTimelineState';
import { ThreadReplyBadge } from './ThreadReplyBadge';

interface MainChatPaneProps {
  selectedUser: string;
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
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  isTogglingReaction: boolean;
  onMediaClick: (payload: {
    type: 'image' | 'video';
    messageId: string;
    url: string;
    downloadName?: string;
  }) => void;
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
  onSendVoice: (data: {
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
  }) => Promise<unknown>;
  onSendText: (data: { receiver_id: string; text: string }) => Promise<void>;
  replyTarget: ComposerReplyTarget | null;
  onClearReplyTarget: () => void;
  splitLayoutRef: React.RefObject<HTMLDivElement | null>;
  resizeHandle?: React.ReactNode;
  threadPanel?: React.ReactNode;
}

export function MainChatPane({
  selectedUser,
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
  onToggleReaction,
  isTogglingReaction,
  onMediaClick,
  audioQueueKey,
  audioQueue,
  isMessageMenuOpen,
  onOpenThread,
  onSendVoice,
  onSendText,
  replyTarget,
  onClearReplyTarget,
  splitLayoutRef,
  resizeHandle,
  threadPanel,
}: MainChatPaneProps) {
  const {
    scrollContainerRef,
    pendingNewMessageCount,
    registerMessageElement,
    handleScroll,
    scrollToLatest,
  } = useChatTimelineState({
    enabled: true,
    resetKey: selectedUser,
    latestMessageId: mainChatMessages[0]?.id || null,
    messageIds: mainChatMessages.map((message) => message.id),
    newestEdge: 'start',
    onVisibleMessageIdsChange,
  });

  return (
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
                  <ThreadReplyBadge
                    message={message}
                    onOpenThread={() => onOpenThread(message)}
                  />
                ) : null
              }
            />

            {isFetchingNextPage ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : null}

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
                }
              }}
            />

            {mainChatMessages.length === 0 && !isFetchingNextPage ? (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                <div className="bg-muted/30 p-4 rounded-full mb-3">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">No messages yet</p>
                <p className="text-xs text-muted-foreground">
                  Start the conversation by sending a message
                </p>
              </div>
            ) : null}
          </div>

          {pendingNewMessageCount > 0 ? (
            <div className="absolute bottom-24 right-4 z-20">
              <Button
                size="sm"
                className="gap-2 rounded-full shadow-lg"
                onClick={() => scrollToLatest()}
              >
                <ArrowDown className="h-4 w-4" />
                <span>
                  {pendingNewMessageCount === 1
                    ? '1 new message'
                    : `${pendingNewMessageCount} new messages`}
                </span>
              </Button>
            </div>
          ) : null}

          <div className="shrink-0 z-20 bg-background flex items-center gap-2 p-4">
            <VoiceRecorder
              receiverId={selectedUser}
              onSendVoice={onSendVoice}
              onSendText={onSendText}
              replyTarget={replyTarget}
              onClearReplyTarget={onClearReplyTarget}
            />
          </div>
        </div>

        {resizeHandle}
        {threadPanel}
      </div>
    </>
  );
}
