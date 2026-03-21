import React from 'react';
import { MessageBubble } from '../components/MessageShell';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import { EmojiMessage } from '../types/message';

interface EmojiMessageRendererProps {
  message: EmojiMessage;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
}

export const EmojiMessageRenderer: React.FC<EmojiMessageRendererProps> = ({
  message,
  groupedWithAbove = false,
  groupedWithBelow = false,
}) => {
  return (
    <MessageBubble
      isOwn={message.isOwn}
      groupedWithAbove={groupedWithAbove}
      groupedWithBelow={groupedWithBelow}
      className="bg-transparent shadow-none border-transparent"
    >
      <MessageReplyPreview message={message} />
      <div className="px-4 py-2 text-4xl">{message.text}</div>
    </MessageBubble>
  );
};
