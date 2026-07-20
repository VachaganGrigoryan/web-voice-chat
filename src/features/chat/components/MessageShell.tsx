import React from 'react';
import { Check, CheckCheck, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatChatMessageTime } from '@/utils/dateUtils';
import { triggerHaptic } from '@/utils/haptics';
import { ChatMessage } from '../types/message';

export interface MessageMenuAnchor {
  x: number;
  y: number;
  rect: DOMRect;
  source: 'mouse' | 'touch';
}

const SWIPE_REPLY_THRESHOLD = 56;
const SWIPE_REPLY_MAX = 72;

interface MessageItemProps {
  isOwn: boolean;
  children: React.ReactNode;
  onOpenMenu?: (anchor: MessageMenuAnchor) => void;
  openMenuOnClick?: boolean;
  onSwipeReply?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  isOwn,
  children,
  onOpenMenu,
  openMenuOnClick = false,
  onSwipeReply,
}) => {
  const touchTimerRef = React.useRef<number | null>(null);
  const swipeContentRef = React.useRef<HTMLDivElement | null>(null);
  const swipeIconRef = React.useRef<HTMLSpanElement | null>(null);
  const swipeStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const swipeAxisRef = React.useRef<'horizontal' | 'vertical' | null>(null);
  const swipeDeltaRef = React.useRef(0);

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

  const resetSwipe = () => {
    swipeStartRef.current = null;
    swipeAxisRef.current = null;
    swipeDeltaRef.current = 0;
    if (swipeContentRef.current) {
      swipeContentRef.current.style.transition = 'transform 200ms ease-out';
      swipeContentRef.current.style.transform = '';
    }
    if (swipeIconRef.current) {
      swipeIconRef.current.style.opacity = '0';
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (onOpenMenu) {
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
    }

    if (onSwipeReply) {
      const touch = event.touches[0];
      swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
      swipeAxisRef.current = null;
    }
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    clearTouchTimer();

    if (!onSwipeReply || !swipeStartRef.current) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - swipeStartRef.current.x;
    const deltaY = touch.clientY - swipeStartRef.current.y;

    if (!swipeAxisRef.current) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      swipeAxisRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    if (swipeAxisRef.current !== 'horizontal' || deltaX <= 0) {
      return;
    }

    const clamped = Math.min(deltaX, SWIPE_REPLY_MAX);
    swipeDeltaRef.current = clamped;

    if (swipeContentRef.current) {
      swipeContentRef.current.style.transition = 'none';
      swipeContentRef.current.style.transform = `translateX(${clamped}px)`;
    }
    if (swipeIconRef.current) {
      swipeIconRef.current.style.opacity = String(Math.min(clamped / SWIPE_REPLY_THRESHOLD, 1));
    }
  };

  const handleTouchEnd = () => {
    clearTouchTimer();

    if (onSwipeReply && swipeDeltaRef.current >= SWIPE_REPLY_THRESHOLD) {
      triggerHaptic('reaction');
      onSwipeReply();
    }

    resetSwipe();
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col max-w-[85%] md:max-w-[70%] mb-1 min-w-0 touch-pan-y",
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
      onTouchStart={onOpenMenu || onSwipeReply ? handleTouchStart : undefined}
      onTouchEnd={onOpenMenu || onSwipeReply ? handleTouchEnd : undefined}
      onTouchMove={onOpenMenu || onSwipeReply ? handleTouchMove : undefined}
      onTouchCancel={onOpenMenu || onSwipeReply ? resetSwipe : undefined}
    >
      {onSwipeReply ? (
        <span
          ref={swipeIconRef}
          className="pointer-events-none absolute -left-7 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0"
        >
          <Reply className="h-4 w-4" />
        </span>
      ) : null}
      <div ref={swipeContentRef} className="flex flex-col min-w-0">
        {children}
      </div>
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
