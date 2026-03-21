import React from 'react';
import { cn } from '@/lib/utils';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';
import { ImageMessage } from '../types/message';
import { MessageReplyPreview } from '../components/MessageReplyPreview';

interface ImageMessageRendererProps {
  message: ImageMessage;
  highlighted?: boolean;
  onMediaClick?: (type: 'image' | 'video', url: string) => void;
}

export const ImageMessageRenderer: React.FC<ImageMessageRendererProps> = ({
  message,
  highlighted = false,
  onMediaClick,
}) => {
  return (
    <MessageBubble isOwn={message.isOwn} highlighted={highlighted}>
      <MessageReplyPreview message={message} />
      <div
        className={cn("p-1", onMediaClick && "cursor-pointer")}
        onClick={onMediaClick ? () => onMediaClick('image', message.imageUrl) : undefined}
      >
        <img
          src={message.imageUrl}
          alt={message.fileName || "Message image"}
          className="max-w-full max-h-64 rounded-lg object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
      {message.caption ? (
        <MessageContent className="px-3 pb-2 pt-1 text-sm">
          <MessageMarkdown text={message.caption} isOwn={message.isOwn} />
        </MessageContent>
      ) : null}
    </MessageBubble>
  );
};
