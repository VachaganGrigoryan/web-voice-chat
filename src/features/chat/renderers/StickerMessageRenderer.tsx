import React from 'react';
import { MessageBubble } from '../components/MessageShell';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import { StickerMessage } from '../types/message';

interface StickerMessageRendererProps {
  message: StickerMessage;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  bubbleFooter?: React.ReactNode;
}

export const StickerMessageRenderer: React.FC<StickerMessageRendererProps> = ({
  message,
  groupedWithAbove = false,
  groupedWithBelow = false,
  bubbleFooter,
}) => {
  return (
    <MessageBubble
      isOwn={message.isOwn}
      groupedWithAbove={groupedWithAbove}
      groupedWithBelow={groupedWithBelow}
    >
      <MessageReplyPreview message={message} />
      <div className="p-1">
        <img
          src={message.stickerUrl}
          alt="Sticker"
          className="max-w-[150px]"
          referrerPolicy="no-referrer"
        />
      </div>
      {bubbleFooter}
    </MessageBubble>
  );
};
