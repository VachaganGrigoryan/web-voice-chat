import React from 'react';
import { MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatChatMessageTime } from '@/utils/dateUtils';
import { ChatMessage } from '../types/message';

interface ThreadReplyBadgeProps {
  message: ChatMessage;
  onOpenThread: () => void;
}

export function ThreadReplyBadge({ message, onOpenThread }: ThreadReplyBadgeProps) {
  const rootId = message.isThreadRoot ? message.id : message.threadRootId;
  if (!rootId) return null;

  const count = message.threadReplyCount;
  const unreadCount = message.unreadThreadReplyCount;
  const activityLabel = count > 0
    ? `${count} ${count === 1 ? 'reply' : 'replies'}`
    : 'Start thread';
  const rootTime = formatChatMessageTime(message.createdAt);
  const lastActivityTime = message.lastThreadReplyAt
    ? formatChatMessageTime(message.lastThreadReplyAt)
    : '';

  return (
    <button
      type="button"
      onClick={onOpenThread}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
        message.isOwn
          ? "bg-primary-foreground/10 text-primary-foreground/85 hover:bg-primary-foreground/16"
          : "bg-background/65 text-foreground/80 hover:bg-background"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            message.isOwn ? "bg-primary-foreground/12" : "bg-foreground/6"
          )}
        >
          <MessageSquareText className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium">
            Open thread
          </span>
          <span
            className={cn(
              "block truncate text-[10px]",
              message.isOwn ? "text-primary-foreground/65" : "text-muted-foreground"
            )}
          >
            {activityLabel}
            {lastActivityTime ? ` • Active ${lastActivityTime}` : ''}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {unreadCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
        {rootTime ? (
          <span
            className={cn(
              "text-[10px]",
              message.isOwn ? "text-primary-foreground/65" : "text-muted-foreground"
            )}
          >
            {rootTime}
          </span>
        ) : null}
      </span>
    </button>
  );
}
