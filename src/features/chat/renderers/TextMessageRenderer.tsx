import React from 'react';
import { TextMessage } from '../types/message';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';
import { MessageReplyPreview } from '../components/MessageReplyPreview';

interface TextMessageRendererProps {
  message: TextMessage;
  highlighted?: boolean;
}

export const TextMessageRenderer: React.FC<TextMessageRendererProps> = ({ message, highlighted = false }) => {
  return (
    <MessageBubble isOwn={message.isOwn} highlighted={highlighted} className="max-w-full min-w-0">
      <MessageReplyPreview message={message} />
      <MessageContent>
        <MessageMarkdown text={message.text} isOwn={message.isOwn} />
      </MessageContent>
    </MessageBubble>
  );
};
