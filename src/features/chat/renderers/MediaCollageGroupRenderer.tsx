import React from 'react';
import { Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageBubble } from '../components/MessageShell';
import { MediaClickPayload } from '../types/message';
import { MediaCollageMessage } from '../utils/mediaGroupUtils';

interface MediaCollageGroupRendererProps {
  messages: MediaCollageMessage[];
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
      <div className={cn('grid gap-1 overflow-hidden rounded-[1.1rem]', getGridClassName(visibleMessages.length))}>
        {visibleMessages.map((message, index) => {
          const showOverflow = hiddenCount > 0 && index === visibleMessages.length - 1;

          return (
            <button
              key={message.id}
              type="button"
              className={cn(
                'group relative overflow-hidden rounded-[0.9rem] bg-black/10 text-left transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                getTileClassName(index, visibleMessages.length)
              )}
              onClick={() =>
                onMediaClick?.({
                  type: message.kind,
                  messageId: message.id,
                  url: message.kind === 'image' ? message.imageUrl : message.videoUrl,
                  downloadName: message.fileName,
                })
              }
            >
              {message.kind === 'image' ? (
                <img
                  src={message.imageUrl}
                  alt={message.fileName || 'Message image'}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <>
                  <video
                    src={message.videoUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="absolute left-3 top-3 rounded-full bg-black/55 p-2 text-white">
                    <Video className="h-4 w-4" />
                  </div>
                </>
              )}

              {showOverflow ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-2xl font-semibold text-white">
                  +{hiddenCount}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </MessageBubble>
  );
};
