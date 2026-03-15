import React from 'react';
import { MessageDoc } from '@/api/types';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';

interface TextMessageRendererProps {
  message: MessageDoc;
  isMe: boolean;
  highlighted?: boolean;
}

export const TextMessageRenderer: React.FC<TextMessageRendererProps> = ({ message, isMe, highlighted }) => {
  return (
    <MessageBubble isMe={isMe} highlighted={highlighted} className="max-w-full min-w-0">
      <MessageContent>
        <MessageMarkdown text={message.text || ''} isMe={isMe} />
      </MessageContent>
    </MessageBubble>
  );
};
