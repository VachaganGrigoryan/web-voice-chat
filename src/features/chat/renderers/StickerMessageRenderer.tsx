import React from 'react';
import { MessageBubble } from '../components/MessageShell';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import { StickerMessage } from '../types/message';

interface StickerMessageRendererProps {
  message: StickerMessage;
}

export const StickerMessageRenderer: React.FC<StickerMessageRendererProps> = ({ message }) => {
  return (
    <MessageBubble isOwn={message.isOwn}>
      <MessageReplyPreview message={message} />
      <div className="p-1">
        <img
          src={message.stickerUrl}
          alt="Sticker"
          className="max-w-[150px]"
          referrerPolicy="no-referrer"
        />
      </div>
    </MessageBubble>
  );
};
