import React from 'react';
import { MessageDoc } from '@/api/types';
import { MessageBubble } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';

interface VideoMessageRendererProps {
  message: MessageDoc;
  isMe: boolean;
  highlighted?: boolean;
  onMediaClick: (type: 'image' | 'video', url: string) => void;
}

export const VideoMessageRenderer: React.FC<VideoMessageRendererProps> = ({ message, isMe, highlighted, onMediaClick }) => {
  return (
    <MessageBubble isMe={isMe} highlighted={highlighted}>
      <div className="p-1 cursor-pointer" onClick={() => onMediaClick('video', message.media?.url || '')}>
        <video src={message.media?.url} className="max-w-full max-h-64 rounded-lg object-contain" />
      </div>
      {message.text && (
        <div className="px-3 pb-2 pt-1 text-sm">
          <MessageMarkdown text={message.text} isMe={isMe} />
        </div>
      )}
    </MessageBubble>
  );
};
