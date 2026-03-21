import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowDown, Loader2, MessageSquareText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMessageDay, isSameLocalDay } from '@/utils/dateUtils';
import { ChatMessage, MediaClickPayload } from '../types/message';
import { DaySeparator, MessageItem, MessageMenuAnchor, MessageMeta } from './MessageShell';
import { MessageReactions } from './MessageReactions';
import { MessageRenderer } from '../MessageRenderer';
import { ChatAudioQueueItem } from '../audioPlayerStore';
import { MediaCollageGroupRenderer } from '../renderers/MediaCollageGroupRenderer';
import { buildChatRenderItems, shouldGroupMessages } from '../utils/mediaGroupUtils';

interface ThreadPanelProps {
  open: boolean;
  rootMessage: ChatMessage | null;
  messages: ChatMessage[];
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
  messages,
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
  const BOTTOM_THRESHOLD = 80;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingInitialScrollRef = useRef(false);
  const activeRootIdRef = useRef<string | null>(null);
  const latestMessageIdRef = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);
  const [pendingNewMessageCount, setPendingNewMessageCount] = useState(0);
  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      ),
    [messages]
  );
  const threadReplyMessages = useMemo(
    () => orderedMessages.filter((message) => message.id !== rootMessage?.id),
    [orderedMessages, rootMessage?.id]
  );
  const threadRenderItems = useMemo(
    () => buildChatRenderItems(threadReplyMessages),
    [threadReplyMessages]
  );

  const isNearBottom = (container: HTMLDivElement | null) => {
    if (!container) return true;
    return container.scrollHeight - container.clientHeight - container.scrollTop <= BOTTOM_THRESHOLD;
  };

  const scrollToLatest = (behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior,
        });
        isNearBottomRef.current = true;
        setPendingNewMessageCount(0);
      });
    });
  };

  const emitVisibleUnreadMessages = () => {
    if (!onVisibleUnreadMessages || !scrollContainerRef.current) {
      return;
    }

    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    const visibleIds = threadReplyMessages
      .filter((message) => message.receiverId === currentUserId && message.status !== 'read')
      .filter((message) => {
        const element = messageElementRefs.current.get(message.id);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.bottom > containerRect.top && rect.top < containerRect.bottom;
      })
      .map((message) => message.id);

    if (visibleIds.length > 0) {
      onVisibleUnreadMessages(visibleIds);
    }
  };

  useEffect(() => {
    if (!open || !rootMessage) {
      activeRootIdRef.current = null;
      pendingInitialScrollRef.current = false;
      latestMessageIdRef.current = null;
      isNearBottomRef.current = true;
      setPendingNewMessageCount(0);
      return;
    }

    if (activeRootIdRef.current !== rootMessage.id) {
      activeRootIdRef.current = rootMessage.id;
      pendingInitialScrollRef.current = true;
      latestMessageIdRef.current = threadReplyMessages[threadReplyMessages.length - 1]?.id || null;
      setPendingNewMessageCount(0);
    }
  }, [open, rootMessage, threadReplyMessages]);

  useEffect(() => {
    if (!open || !rootMessage || isLoading || !pendingInitialScrollRef.current) {
      return;
    }

    let frameOne = 0;
    let frameTwo = 0;

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        if (!container) {
          return;
        }

        container.scrollTop = container.scrollHeight;
        isNearBottomRef.current = true;
        pendingInitialScrollRef.current = false;
        emitVisibleUnreadMessages();
      });
    });

    return () => {
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
    };
  }, [open, rootMessage, isLoading, threadReplyMessages.length]);

  useEffect(() => {
    if (!open || !rootMessage || isLoading) {
      return;
    }

    const latestMessageId = threadReplyMessages[threadReplyMessages.length - 1]?.id || null;
    if (!latestMessageId) {
      latestMessageIdRef.current = null;
      return;
    }

    if (!latestMessageIdRef.current) {
      latestMessageIdRef.current = latestMessageId;
      return;
    }

    if (latestMessageIdRef.current === latestMessageId) {
      return;
    }

    latestMessageIdRef.current = latestMessageId;

    if (pendingInitialScrollRef.current || isNearBottomRef.current) {
      scrollToLatest();
      return;
    }

    setPendingNewMessageCount((current) => current + 1);
  }, [open, rootMessage, isLoading, threadReplyMessages]);

  useEffect(() => {
    if (!open || !rootMessage || isLoading) {
      return;
    }

    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      emitVisibleUnreadMessages();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, rootMessage, isLoading, threadReplyMessages, onVisibleUnreadMessages, currentUserId]);

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
        onScroll={(event) => {
          const nextIsNearBottom = isNearBottom(event.currentTarget);
          isNearBottomRef.current = nextIsNearBottom;
          if (nextIsNearBottom) {
            setPendingNewMessageCount(0);
          }
          emitVisibleUnreadMessages();
        }}
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
            ) : threadRenderItems.length > 0 ? (
              threadRenderItems.map((item, index) => {
                const previousItem = threadRenderItems[index - 1];
                const nextItem = threadRenderItems[index + 1];
                const showDateHeader =
                  !previousItem || !isSameLocalDay(item.firstMessage.createdAt, previousItem.lastMessage.createdAt);
                const groupedWithAbove = shouldGroupMessages(item.firstMessage, previousItem?.lastMessage);
                const groupedWithBelow = shouldGroupMessages(item.lastMessage, nextItem?.firstMessage);

                return (
                  <div
                    key={item.id}
                    ref={(node) => {
                      item.messages.forEach((message) => {
                        if (node) {
                          messageElementRefs.current.set(message.id, node);
                        } else {
                          messageElementRefs.current.delete(message.id);
                        }
                      });
                    }}
                    className={cn(
                      'flex flex-col w-full min-w-0',
                      groupedWithAbove ? 'mt-px' : index === 0 ? '' : 'mt-6'
                    )}
                  >
                    {showDateHeader ? (
                      <DaySeparator
                        label={formatMessageDay(item.firstMessage.createdAt)}
                        className="pb-3"
                      />
                    ) : null}

                    {item.type === 'media-group' ? (
                      <MessageItem
                        isOwn={item.isOwn}
                        onOpenMenu={(anchor) => onOpenMenu(item.latestMessage, anchor)}
                        openMenuOnClick={isMessageMenuOpen}
                      >
                        <MediaCollageGroupRenderer
                          messages={item.messages}
                          caption={item.caption}
                          groupedWithAbove={groupedWithAbove}
                          groupedWithBelow={groupedWithBelow}
                          onMediaClick={onMediaClick}
                        />
                        <MessageMeta message={item.latestMessage} showTimestamp={!groupedWithBelow} />
                      </MessageItem>
                    ) : (
                      <MessageItem
                        isOwn={item.message.isOwn}
                        onOpenMenu={(anchor) => onOpenMenu(item.message, anchor)}
                        openMenuOnClick={isMessageMenuOpen}
                      >
                        <MessageRenderer
                          message={item.message}
                          groupedWithAbove={groupedWithAbove}
                          groupedWithBelow={groupedWithBelow}
                          onMediaClick={onMediaClick}
                          audioQueueKey={audioQueueKey}
                          audioQueue={audioQueue}
                        />
                        <MessageReactions
                          message={item.message}
                          currentUserId={currentUserId}
                          isBusy={isTogglingReaction}
                          onToggleReaction={(emoji) => onToggleReaction(item.message.id, emoji)}
                        />
                        <MessageMeta message={item.message} showTimestamp={!groupedWithBelow} />
                      </MessageItem>
                    )}
                  </div>
                );
              })
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
