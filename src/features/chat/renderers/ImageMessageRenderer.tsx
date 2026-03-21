import React from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';
import { ImageMessage, MediaClickPayload } from '../types/message';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import { downloadFile } from '@/utils/download';

interface ImageMessageRendererProps {
  message: ImageMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  onMediaClick?: (payload: MediaClickPayload) => void;
  bubbleFooter?: React.ReactNode;
}

export const ImageMessageRenderer: React.FC<ImageMessageRendererProps> = ({
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
        className={cn("relative p-1", onMediaClick && "cursor-pointer")}
        onClick={
          onMediaClick
            ? () =>
                onMediaClick({
                  type: 'image',
                  messageId: message.id,
                  url: message.imageUrl,
                  downloadName: message.fileName,
                })
            : undefined
        }
      >
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/60"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void downloadFile(message.imageUrl, message.fileName);
          }}
          aria-label="Download image"
          title="Download image"
        >
          <Download className="h-4 w-4" />
        </button>
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
      {bubbleFooter}
    </MessageBubble>
  );
};
