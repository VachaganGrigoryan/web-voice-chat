import React from 'react';
import { cn } from '@/lib/utils';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';
import { MediaClickPayload, VideoMessage } from '../types/message';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import { VideoThumbnail } from '../media/players/VideoPlayer';

interface VideoMessageRendererProps {
  message: VideoMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  onMediaClick?: (payload: MediaClickPayload) => void;
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
      <div className={cn("p-1", onMediaClick && "cursor-pointer")}>
        <VideoThumbnail
          src={message.videoUrl}
          className="rounded-lg"
          videoClassName="max-h-64 min-h-[14rem] max-w-full object-contain"
          onClick={
            onMediaClick
              ? () =>
                  onMediaClick({
                    type: 'video',
                    messageId: message.id,
                    url: message.videoUrl,
                    downloadName: message.fileName,
                  })
              : undefined
          }
        />
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
