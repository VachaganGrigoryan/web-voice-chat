import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatChatMessageTime } from '@/utils/dateUtils';
import { ChatMessage } from '../types/message';

export interface MessageMenuAnchor {
  x: number;
  y: number;
  rect: DOMRect;
  source: 'mouse' | 'touch';
}

interface MessageItemProps {
  isOwn: boolean;
  children: React.ReactNode;
  onOpenMenu?: (anchor: MessageMenuAnchor) => void;
  openMenuOnClick?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  isOwn,
  children,
  onOpenMenu,
  openMenuOnClick = false,
}) => {
  const touchTimerRef = React.useRef<number | null>(null);

  const getAnchorFromRect = (rect: DOMRect, x?: number, y?: number): MessageMenuAnchor => ({
    x: x ?? rect.left + rect.width / 2,
    y: y ?? rect.top + rect.height / 2,
    rect,
    source: 'mouse',
  });

  const clearTouchTimer = () => {
    if (touchTimerRef.current) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!onOpenMenu) return;
    clearTouchTimer();
    const rect = event.currentTarget.getBoundingClientRect();
    touchTimerRef.current = window.setTimeout(() => {
      onOpenMenu({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        rect,
        source: 'touch',
      });
      touchTimerRef.current = null;
    }, 450);
  };

  return (
    <div
      className={cn(
        "group flex flex-col max-w-[85%] md:max-w-[70%] mb-1 min-w-0",
        isOwn ? "self-end items-end" : "self-start items-start"
      )}
      onClickCapture={
        onOpenMenu && openMenuOnClick
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenMenu(getAnchorFromRect(rect, event.clientX, event.clientY));
            }
          : undefined
      }
      onContextMenu={
        onOpenMenu
          ? (event) => {
              event.preventDefault();
              onOpenMenu(
                getAnchorFromRect(
                  event.currentTarget.getBoundingClientRect(),
                  event.clientX,
                  event.clientY
                )
              );
            }
          : undefined
      }
      onTouchStart={onOpenMenu ? handleTouchStart : undefined}
      onTouchEnd={onOpenMenu ? clearTouchTimer : undefined}
      onTouchMove={onOpenMenu ? clearTouchTimer : undefined}
      onTouchCancel={onOpenMenu ? clearTouchTimer : undefined}
    >
      {children}
    </div>
  );
};

interface MessageBubbleProps {
  isOwn: boolean;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  isOwn,
  highlighted,
  groupedWithAbove = false,
  groupedWithBelow = false,
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        "rounded-2xl px-1 py-1 shadow-sm overflow-hidden transition-all duration-300",
        isOwn
          ? "bg-primary text-primary-foreground"
          : highlighted
          ? "bg-blue-100 border border-blue-300 dark:bg-blue-900/30 dark:border-blue-800"
          : "bg-muted text-foreground border border-border",
        isOwn
          ? groupedWithAbove
            ? "rounded-tr-md"
            : "rounded-tr-2xl"
          : groupedWithAbove
          ? "rounded-tl-md"
          : "rounded-tl-2xl",
        isOwn ? "rounded-tl-2xl rounded-bl-2xl" : "rounded-tr-2xl rounded-br-2xl",
        isOwn
          ? groupedWithBelow
            ? "rounded-br-md"
            : "rounded-br-none"
          : groupedWithBelow
          ? "rounded-bl-md"
          : "rounded-bl-none",
        className
      )}
    >
      {children}
    </div>
  );
};

interface MessageContentProps {
  children: React.ReactNode;
  className?: string;
}

export const MessageContent: React.FC<MessageContentProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        "px-4 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap min-w-0",
        className
      )}
      style={{ wordBreak: 'break-word' }}
    >
      {children}
    </div>
  );
};

interface MessageBubbleFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const MessageBubbleFooter: React.FC<MessageBubbleFooterProps> = ({
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        "px-2 pb-2 pt-1",
        className
      )}
    >
      {children}
    </div>
  );
};

interface DaySeparatorProps {
  label: string;
  className?: string;
}

export const DaySeparator: React.FC<DaySeparatorProps> = ({ label, className }) => {
  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <div className="h-px flex-1 bg-border/60" />
      <div className="rounded-full border border-border/60 bg-background/90 px-3 py-1 text-[10px] font-semibold text-muted-foreground shadow-sm">
        {label}
      </div>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
};

interface MessageMetaProps {
  message: ChatMessage;
  showTimestamp?: boolean;
}

export const MessageMeta: React.FC<MessageMetaProps> = ({ message, showTimestamp = true }) => {
  if (!showTimestamp) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 mt-0.5 px-1 text-[10px] text-muted-foreground/70",
        message.isOwn ? "justify-end" : "justify-start"
      )}
    >
      {message.isDeleted ? (
        <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/90">
          deleted
        </span>
      ) : null}
      {!message.isDeleted && message.editedAt ? <span>edited</span> : null}
      <span>{formatChatMessageTime(message.createdAt)}</span>
      {message.isOwn ? (
        <span
          className={cn(
            "flex items-center",
            message.status === 'read' ? "text-blue-500" : ""
          )}
        >
          {message.status === 'read' ? (
            <CheckCheck className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </span>
      ) : null}
    </div>
  );
};

interface MessageAvatarProps {
  children?: React.ReactNode;
  className?: string;
}

export const MessageAvatar: React.FC<MessageAvatarProps> = ({ children, className }) => {
  if (!children) return null;

  return <div className={cn("shrink-0", className)}>{children}</div>;
};
