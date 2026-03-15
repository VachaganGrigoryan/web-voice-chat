import React from 'react';
import { MessageDoc } from '@/api/types';
import { cn } from '@/lib/utils';
import AudioPlayer from './AudioPlayer';

interface MessageRendererProps {
  message: MessageDoc;
  isMe: boolean;
  highlighted: boolean;
  onMediaClick: (type: 'image' | 'video', url: string) => void;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ message, isMe, highlighted, onMediaClick }) => {
  const baseClasses = cn(
    "rounded-2xl px-1 py-1 shadow-sm overflow-hidden transition-all duration-300",
    isMe
      ? "bg-primary text-primary-foreground rounded-br-none"
      : highlighted
      ? "bg-blue-100 border border-blue-300 rounded-bl-none dark:bg-blue-900/30 dark:border-blue-800"
      : "bg-muted text-foreground rounded-bl-none border border-border"
  );
  const messageTextClasses = cn(
    "px-4 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap min-w-0",
    "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-current [&_a]:transition-opacity [&_a]:hover:opacity-80 [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-ring [&_a]:focus-visible:ring-offset-2 [&_a]:focus-visible:ring-offset-transparent",
    isMe
      ? "[&_a]:text-sky-300 [&_a]:hover:text-sky-200 dark:[&_a]:text-sky-700 dark:[&_a]:hover:text-sky-800"
      : "[&_a]:text-sky-600 [&_a]:hover:text-sky-700 dark:[&_a]:text-sky-400 dark:[&_a]:hover:text-sky-300"
  );

  switch (message.type) {
    case 'text':
      const renderText = (text: string | null) => {
        if (!text) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.split(urlRegex).map((part, i) => {
          if (part.match(urlRegex)) {
            return (
              <a 
                key={i} 
                href={part} 
                target="_blank" 
                rel="noopener noreferrer"
                className="break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </a>
            );
          }
          return part;
        });
      };

      return (
        <div className={cn(baseClasses, "max-w-full min-w-0")}>
          <div className={messageTextClasses} style={{ wordBreak: 'break-word' }}>
            {renderText(message.text)}
          </div>
        </div>
      );
    case 'voice':
      return (
        <div className={baseClasses}>
          <AudioPlayer 
            src={message.media?.url || ''} 
            durationMs={message.media?.duration_ms || 0}
            messageId={message.id}
            isRead={message.status === 'read'}
            isMe={isMe}
            createdAt={message.created_at}
            className={cn(
              "w-full min-w-[200px]",
              isMe ? "bg-primary-foreground/10" : "bg-background/50"
            )}
          />
        </div>
      );
    case 'image':
      return (
        <div className={baseClasses}>
          <div className="p-1 cursor-pointer" onClick={() => onMediaClick('image', message.media?.url || '')}>
            <img src={message.media?.url} alt="Message" className="max-w-full max-h-64 rounded-lg object-contain" referrerPolicy="no-referrer" />
            {message.text && <p className="px-3 py-2 text-sm">{message.text}</p>}
          </div>
        </div>
      );
    case 'video':
      return (
        <div className={baseClasses}>
          <div className="p-1 cursor-pointer" onClick={() => onMediaClick('video', message.media?.url || '')}>
            <video src={message.media?.url} className="max-w-full max-h-64 rounded-lg object-contain" />
            {message.text && <p className="px-3 py-2 text-sm">{message.text}</p>}
          </div>
        </div>
      );
    case 'sticker':
      return (
        <div className="p-1">
          <img src={message.media?.url} alt="Sticker" className="max-w-[150px]" referrerPolicy="no-referrer" />
        </div>
      );
    default:
      return <div className="px-4 py-2">Unknown message type</div>;
  }
};
