import React, { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Loader2, MessageSquareText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMessageDay, isSameLocalDay } from '@/utils/dateUtils';
import { ChatMessage } from '../types/message';
import { MessageItem, MessageMenuAnchor, MessageMeta } from './MessageShell';
import { MessageRenderer } from '../MessageRenderer';

interface ThreadPanelProps {
  open: boolean;
  rootMessage: ChatMessage | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  onClose: () => void;
  onOpenMenu: (message: ChatMessage, anchor: MessageMenuAnchor) => void;
  onMediaClick?: (type: 'image' | 'video', url: string) => void;
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
  onClose,
  onOpenMenu,
  onMediaClick,
  composer,
  isMobile = false,
  isMessageMenuOpen = false,
  className,
  style,
}: ThreadPanelProps) {
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

  const shouldGroupMessages = (current: ChatMessage, adjacent?: ChatMessage) => {
    if (!adjacent) return false;
    if (current.kind === 'system' || adjacent.kind === 'system') return false;
    if (current.senderId !== adjacent.senderId) return false;
    if (!isSameLocalDay(current.createdAt, adjacent.createdAt)) return false;

    const currentTime = new Date(current.createdAt).getTime();
    const adjacentTime = new Date(adjacent.createdAt).getTime();
    return Math.abs(currentTime - adjacentTime) <= 60 * 1000;
  };

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

      <div className="scrollbar-hidden flex-1 overflow-y-auto overscroll-contain">
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
              <MessageRenderer message={rootMessage} onMediaClick={onMediaClick} />
              <MessageMeta message={rootMessage} />
            </MessageItem>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : threadReplyMessages.length > 0 ? (
              threadReplyMessages.map((message, index) => {
                const previousMessage = threadReplyMessages[index - 1];
                const nextMessage = threadReplyMessages[index + 1];
                const showDateHeader =
                  !previousMessage || !isSameLocalDay(message.createdAt, previousMessage.createdAt);
                const groupedWithAbove = shouldGroupMessages(message, previousMessage);
                const groupedWithBelow = shouldGroupMessages(message, nextMessage);

                return (
                  <div
                    key={message.id}
                    className={cn(
                      'flex flex-col w-full min-w-0',
                      groupedWithAbove ? 'mt-px' : index === 0 ? '' : 'mt-6'
                    )}
                  >
                    {showDateHeader ? (
                      <div className="flex justify-center pb-4">
                        <div className="rounded-full border border-border/50 bg-muted/50 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                          {formatMessageDay(message.createdAt)}
                        </div>
                      </div>
                    ) : null}

                    <MessageItem
                      isOwn={message.isOwn}
                      onOpenMenu={(anchor) => onOpenMenu(message, anchor)}
                      openMenuOnClick={isMessageMenuOpen}
                    >
                      <MessageRenderer
                        message={message}
                        groupedWithAbove={groupedWithAbove}
                        groupedWithBelow={groupedWithBelow}
                        onMediaClick={onMediaClick}
                      />
                      <MessageMeta message={message} showTimestamp={!groupedWithBelow} />
                    </MessageItem>
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

      {composer ? <div className="border-t">{composer}</div> : null}
    </aside>
  );
}
