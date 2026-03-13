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

  switch (message.type) {
    case 'text':
      return (
        <div className={cn(baseClasses, "max-w-full min-w-0")}>
          <div className="px-4 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap min-w-0" style={{ wordBreak: 'break-word' }}>
            {message.text}
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
