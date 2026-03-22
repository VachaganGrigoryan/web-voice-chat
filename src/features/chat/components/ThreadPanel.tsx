import React from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowDown, Loader2, MessageSquareText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessage, MediaClickPayload } from '../types/message';
import { MessageItem, MessageMenuAnchor, MessageMeta } from './MessageShell';
import { MessageRenderer } from '../MessageRenderer';
import { ChatAudioQueueItem } from '../media/players/audioPlayerStore';
import { ChatRenderItem } from '../utils/mediaGroupUtils';
import { ChatTimelineItems } from './ChatTimelineItems';
import { useChatTimelineState } from '../hooks/useChatTimelineState';
import { MessageReactions } from './MessageReactions';

interface ThreadPanelProps {
  open: boolean;
  rootMessage: ChatMessage | null;
  replyMessages: ChatMessage[];
  renderItems: ChatRenderItem[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  currentUserId?: string | null;
  onClose: () => void;
  onOpenMenu: (message: ChatMessage, anchor: MessageMenuAnchor) => void;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  isTogglingReaction?: boolean;
  onVisibleUnreadMessages?: (messageIds: string[]) => void;
  onMediaClick?: (payload: MediaClickPayload) => void;
  audioQueueKey?: string | null;
  audioQueue?: ChatAudioQueueItem[];
  composer?: React.ReactNode;
  isMobile?: boolean;
  isMessageMenuOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ThreadPanel({
  open,
  rootMessage,
  replyMessages,
  renderItems,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  currentUserId,
  onClose,
  onOpenMenu,
  onToggleReaction,
  isTogglingReaction = false,
  onVisibleUnreadMessages,
  onMediaClick,
  audioQueueKey,
  audioQueue,
  composer,
  isMobile = false,
  isMessageMenuOpen = false,
  className,
  style,
}: ThreadPanelProps) {
  const {
    scrollContainerRef,
    pendingNewMessageCount,
    registerMessageElement,
    handleScroll,
    scrollToLatest,
  } = useChatTimelineState({
    enabled: open && !!rootMessage && !isLoading,
    resetKey: rootMessage?.id || null,
    latestMessageId: replyMessages[replyMessages.length - 1]?.id || null,
    messageIds: replyMessages.map((message) => message.id),
    newestEdge: 'end',
    onVisibleMessageIdsChange: onVisibleUnreadMessages,
  });

  if (!open || !rootMessage) {
    return null;
  }

  return (
    <aside
      className={cn(
        'z-30 flex min-h-0 flex-col bg-background/98 backdrop-blur-xl',
        isMobile
          ? 'absolute inset-0 w-full shadow-2xl'
          : 'relative shrink-0 border-l border-l-border/50 shadow-[inset_1px_0_0_rgba(255,255,255,0.04)] transition-[width] duration-200 ease-out',
        className
      )}
      style={style}
    >
      <div className="flex h-16 items-center justify-between border-b border-border/70 bg-background/95 px-4 shadow-sm">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Thread</div>
          <div className="truncate text-xs text-muted-foreground">
            {rootMessage.threadReplyCount > 0
              ? `${rootMessage.threadReplyCount} ${rootMessage.threadReplyCount === 1 ? 'reply' : 'replies'}`
              : 'No replies yet'}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={scrollContainerRef}
        className="scrollbar-hidden flex-1 overflow-y-auto overscroll-contain"
        onScroll={(event) => handleScroll(event.currentTarget)}
      >
        <div className="p-4">
          <div className="rounded-3xl border border-border/70 bg-muted/20 p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquareText className="h-3.5 w-3.5" />
              Original Message
            </div>
            <MessageItem
              isOwn={rootMessage.isOwn}
              onOpenMenu={(anchor) => onOpenMenu(rootMessage, anchor)}
              openMenuOnClick={isMessageMenuOpen}
            >
              <MessageRenderer
                message={rootMessage}
                onMediaClick={onMediaClick}
                audioQueueKey={audioQueueKey}
                audioQueue={audioQueue}
              />
              <MessageReactions
                message={rootMessage}
                currentUserId={currentUserId}
                isBusy={isTogglingReaction}
                onToggleReaction={(emoji) => onToggleReaction(rootMessage.id, emoji)}
              />
              <MessageMeta message={rootMessage} />
            </MessageItem>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : renderItems.length > 0 ? (
              <ChatTimelineItems
                renderItems={renderItems}
                chronology="oldest-first"
                currentUserId={currentUserId}
                onOpenMenu={onOpenMenu}
                onToggleReaction={onToggleReaction}
                isTogglingReaction={isTogglingReaction}
                onMediaClick={onMediaClick}
                audioQueueKey={audioQueueKey}
                audioQueue={audioQueue}
                isMessageMenuOpen={isMessageMenuOpen}
                registerMessageElement={registerMessageElement}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center">
                <div className="text-sm font-medium text-foreground">No thread replies yet</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Start the thread from the composer below.
                </div>
              </div>
            )}

            {hasNextPage ? (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" onClick={fetchNextPage} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading
                    </>
                  ) : (
                    'Load Older Replies'
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {pendingNewMessageCount > 0 ? (
        <div className={cn('absolute right-4 z-20', composer ? 'bottom-28' : 'bottom-4')}>
          <Button
            size="sm"
            className="gap-2 rounded-full shadow-lg"
            onClick={() => scrollToLatest()}
          >
            <ArrowDown className="h-4 w-4" />
            <span>{pendingNewMessageCount === 1 ? '1 new reply' : `${pendingNewMessageCount} new replies`}</span>
          </Button>
        </div>
      ) : null}

      {composer ? <div className="border-t">{composer}</div> : null}
    </aside>
  );
}
