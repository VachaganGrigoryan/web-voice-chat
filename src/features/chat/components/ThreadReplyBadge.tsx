import React from 'react';
import { MessageSquareText } from 'lucide-react';
import { ChatMessage } from '../types/message';

interface ThreadReplyBadgeProps {
  message: ChatMessage;
  onOpenThread: () => void;
}

const formatTimestamp = (value?: string) => {
  if (!value) return '';

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function ThreadReplyBadge({ message, onOpenThread }: ThreadReplyBadgeProps) {
  const rootId = message.isThreadRoot ? message.id : message.threadRootId;
  if (!rootId) return null;

  const count = message.threadReplyCount;
  const unreadCount = message.unreadThreadReplyCount;
  const label = count === 1 ? '1 reply' : `${count} replies`;
  const timestamp = formatTimestamp(message.lastThreadReplyAt);

  return (
    <button
      type="button"
      onClick={onOpenThread}
      className="mt-1 inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
    >
      <MessageSquareText className="h-3.5 w-3.5" />
      <span>{count > 0 ? label : 'Reply in thread'}</span>
      {unreadCount > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
      {timestamp ? <span className="text-muted-foreground/70">{timestamp}</span> : null}
    </button>
  );
}
