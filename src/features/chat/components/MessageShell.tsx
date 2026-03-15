import React from 'react';
import { cn } from '@/lib/utils';
import { MessageDoc } from '@/api/types';
import { formatMessageTime, formatMessageDateTime } from '@/utils/dateUtils';
import { Check, CheckCheck } from 'lucide-react';

interface MessageItemProps {
  isMe: boolean;
  children: React.ReactNode;
}

export const MessageItem: React.FC<MessageItemProps> = ({ isMe, children }) => {
  return (
    <div
      className={cn(
        "flex flex-col max-w-[85%] md:max-w-[70%] mb-1 relative group min-w-0",
        isMe ? "self-end items-end" : "self-start items-start"
      )}
    >
      {children}
    </div>
  );
};

interface MessageBubbleProps {
  isMe: boolean;
  highlighted?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ isMe, highlighted, children, className }) => {
  return (
    <div
      className={cn(
        "rounded-2xl px-1 py-1 shadow-sm overflow-hidden transition-all duration-300",
        isMe
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
    <div className={cn("px-4 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap min-w-0", className)} style={{ wordBreak: 'break-word' }}>
      {children}
    </div>
  );
};

interface MessageMetaProps {
  message: MessageDoc;
  isMe: boolean;
}

export const MessageMeta: React.FC<MessageMetaProps> = ({ message, isMe }) => {
  return (
    <div className={cn(
      "flex items-center gap-1 mt-1 px-1 text-[10px] text-muted-foreground/70 cursor-help",
      isMe ? "justify-end" : "justify-start"
    )}>
      <span title={`Sent: ${formatMessageDateTime(message.created_at)}${message.delivered_at ? `\nDelivered: ${formatMessageDateTime(message.delivered_at)}` : ''}${message.read_at ? `\nRead: ${formatMessageDateTime(message.read_at)}` : ''}`}>
        {formatMessageTime(message.created_at)}
      </span>
      {isMe && (
        <span 
          className={cn(
            "flex items-center",
            message.status === 'read' ? "text-blue-500" : ""
          )}
          title={message.read_at ? `Read at ${formatMessageTime(message.read_at)}` : undefined}
        >
          {message.status === 'read' ? (
            <CheckCheck className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </span>
      )}
    </div>
  );
};

interface MessageAvatarProps {
  src?: string;
  fallback?: string;
}

export const MessageAvatar: React.FC<MessageAvatarProps> = ({ src, fallback }) => {
  if (!src && !fallback) return null;
  return (
    <div className="flex-shrink-0 mr-2">
      <img src={src} alt={fallback || "Avatar"} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
    </div>
  );
};
