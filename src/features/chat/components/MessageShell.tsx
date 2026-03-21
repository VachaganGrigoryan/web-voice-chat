import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMessageTime } from '@/utils/dateUtils';
import { ChatMessage } from '../types/message';

interface MessageItemProps {
  isOwn: boolean;
  children: React.ReactNode;
  onOpenMenu?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ isOwn, children, onOpenMenu }) => {
  const touchTimerRef = React.useRef<number | null>(null);

  const clearTouchTimer = () => {
    if (touchTimerRef.current) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchStart = () => {
    if (!onOpenMenu) return;
    clearTouchTimer();
    touchTimerRef.current = window.setTimeout(() => {
      onOpenMenu();
      touchTimerRef.current = null;
    }, 450);
  };

  return (
    <div
      className={cn(
        "flex flex-col max-w-[85%] md:max-w-[70%] mb-1 min-w-0",
        isOwn ? "self-end items-end" : "self-start items-start"
      )}
      onContextMenu={
        onOpenMenu
          ? (event) => {
              event.preventDefault();
              onOpenMenu();
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
  children: React.ReactNode;
  className?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ isOwn, highlighted, children, className }) => {
  return (
    <div
      className={cn(
        "rounded-2xl px-1 py-1 shadow-sm overflow-hidden transition-all duration-300",
        isOwn
          ? "bg-primary text-primary-foreground rounded-br-none"
          : highlighted
          ? "bg-blue-100 border border-blue-300 rounded-bl-none dark:bg-blue-900/30 dark:border-blue-800"
          : "bg-muted text-foreground rounded-bl-none border border-border",
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

interface MessageMetaProps {
  message: ChatMessage;
}

export const MessageMeta: React.FC<MessageMetaProps> = ({ message }) => {
  return (
    <div
      className={cn(
        "flex items-center gap-1 mt-1 px-1 text-[10px] text-muted-foreground/70",
        message.isOwn ? "justify-end" : "justify-start"
      )}
    >
      {message.isDeleted ? <span>deleted</span> : null}
      {!message.isDeleted && message.editedAt ? <span>edited</span> : null}
      <span>{formatMessageTime(message.createdAt)}</span>
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
