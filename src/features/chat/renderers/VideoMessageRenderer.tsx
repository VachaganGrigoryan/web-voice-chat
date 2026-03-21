import React from 'react';
import { cn } from '@/lib/utils';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';
import { VideoMessage } from '../types/message';
import { MessageReplyPreview } from '../components/MessageReplyPreview';

interface VideoMessageRendererProps {
  message: VideoMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  onMediaClick?: (type: 'image' | 'video', url: string) => void;
  bubbleFooter?: React.ReactNode;
}

export const VideoMessageRenderer: React.FC<VideoMessageRendererProps> = ({
  message,
  highlighted = false,
  groupedWithAbove = false,
  groupedWithBelow = false,
  onMediaClick,
  bubbleFooter,
}) => {
  return (
    <MessageBubble
      isOwn={message.isOwn}
      highlighted={highlighted}
      groupedWithAbove={groupedWithAbove}
      groupedWithBelow={groupedWithBelow}
    >
      <MessageReplyPreview message={message} />
      <div
        className={cn("p-1", onMediaClick && "cursor-pointer")}
        onClick={onMediaClick ? () => onMediaClick('video', message.videoUrl) : undefined}
      >
        <video src={message.videoUrl} className="max-w-full max-h-64 rounded-lg object-contain" />
      </div>
      {message.caption ? (
        <MessageContent className="px-3 pb-2 pt-1 text-sm">
          <MessageMarkdown text={message.caption} isOwn={message.isOwn} />
        </MessageContent>
      ) : null}
      {bubbleFooter}
    </MessageBubble>
  );
};
