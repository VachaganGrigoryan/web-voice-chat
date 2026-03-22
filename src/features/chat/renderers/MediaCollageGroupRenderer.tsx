import React from 'react';
import { cn } from '@/lib/utils';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';
import { VideoThumbnail } from '../components/VideoPlayer';
import { MediaClickPayload } from '../types/message';
import { MediaCollageMessage } from '../utils/mediaGroupUtils';

interface MediaCollageGroupRendererProps {
  messages: MediaCollageMessage[];
  caption?: string;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  onMediaClick?: (payload: MediaClickPayload) => void;
}

const getGridClassName = (count: number) => {
  if (count === 2) {
    return 'grid-cols-2';
  }

  return 'grid-cols-2 grid-rows-2 h-72 sm:h-80';
};

const getTileClassName = (index: number, count: number) => {
  if (count === 2) {
    return 'aspect-[4/5]';
  }

  if (count === 3 && index === 0) {
    return 'row-span-2 h-full';
  }

  return 'h-full';
};

export const MediaCollageGroupRenderer: React.FC<MediaCollageGroupRendererProps> = ({
  messages,
  caption,
  highlighted = false,
  groupedWithAbove = false,
  groupedWithBelow = false,
  onMediaClick,
}) => {
  const visibleMessages = messages.slice(0, 4);
  const hiddenCount = messages.length - visibleMessages.length;

  return (
    <MessageBubble
      isOwn={messages[0].isOwn}
      highlighted={highlighted}
      groupedWithAbove={groupedWithAbove}
      groupedWithBelow={groupedWithBelow}
      className="p-1"
    >
      {caption ? (
        <MessageContent className="px-3 pb-2 pt-3 text-sm">
          <MessageMarkdown text={caption} isOwn={messages[0].isOwn} />
        </MessageContent>
      ) : null}
      <div className={cn('grid gap-1 overflow-hidden rounded-[1.1rem]', getGridClassName(visibleMessages.length))}>
        {visibleMessages.map((message, index) => {
          const showOverflow = hiddenCount > 0 && index === visibleMessages.length - 1;
          const handleClick = () =>
            onMediaClick?.({
              type: message.kind,
              messageId: message.id,
              url: message.kind === 'image' ? message.imageUrl : message.videoUrl,
              downloadName: message.fileName,
            });

          return (
            <div
              key={message.id}
              className={cn(
                'group relative overflow-hidden rounded-[0.9rem] bg-black/10 text-left transition-transform',
                getTileClassName(index, visibleMessages.length)
              )}
            >
              {message.kind === 'image' ? (
                <button
                  type="button"
                  className="h-full w-full"
                  onClick={handleClick}
                >
                  <img
                    src={message.imageUrl}
                    alt={message.fileName || 'Message image'}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ) : (
                <VideoThumbnail
                  src={message.videoUrl}
                  className="h-full w-full rounded-[0.9rem]"
                  videoClassName="h-full w-full object-cover"
                  label="Video"
                  onClick={handleClick}
                />
              )}

              {showOverflow ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 text-2xl font-semibold text-white">
                  +{hiddenCount}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </MessageBubble>
  );
};
