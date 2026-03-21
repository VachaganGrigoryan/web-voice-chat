import React from 'react';
import { MessageBubble } from '../components/MessageShell';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import { EmojiMessage } from '../types/message';

interface EmojiMessageRendererProps {
  message: EmojiMessage;
}

export const EmojiMessageRenderer: React.FC<EmojiMessageRendererProps> = ({ message }) => {
  return (
    <MessageBubble isOwn={message.isOwn} className="bg-transparent shadow-none">
      <MessageReplyPreview message={message} />
      <div className="px-4 py-2 text-4xl">{message.text}</div>
    </MessageBubble>
  );
};
