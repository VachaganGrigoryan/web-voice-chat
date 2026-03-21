import React, { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Loader2, MessageSquareText, X } from 'lucide-react';
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
}: ThreadPanelProps) {
  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      ),
    [messages]
  );

  if (!open || !rootMessage) {
    return null;
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l bg-background shadow-xl md:static md:w-[380px] md:min-w-[380px] md:shadow-none">
      <div className="flex h-16 items-center justify-between border-b px-4">
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

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquareText className="h-3.5 w-3.5" />
              Original Message
            </div>
            <MessageItem isOwn={rootMessage.isOwn} onOpenMenu={(anchor) => onOpenMenu(rootMessage, anchor)}>
              <MessageRenderer message={rootMessage} onMediaClick={onMediaClick} />
              <MessageMeta message={rootMessage} />
            </MessageItem>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : orderedMessages.length > 0 ? (
              orderedMessages.map((message) => (
                <MessageItem
                  key={message.id}
                  isOwn={message.isOwn}
                  onOpenMenu={(anchor) => onOpenMenu(message, anchor)}
                >
                  <MessageRenderer message={message} onMediaClick={onMediaClick} />
                  <MessageMeta message={message} />
                </MessageItem>
              ))
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
      </ScrollArea>

      {composer ? <div className="border-t">{composer}</div> : null}
    </aside>
  );
}
