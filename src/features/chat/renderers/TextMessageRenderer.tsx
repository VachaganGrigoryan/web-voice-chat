import React from 'react';
import { TextMessage } from '../types/message';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import { MessageTextContent } from '../content/MessageTextContent';

interface TextMessageRendererProps {
  message: TextMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  bubbleFooter?: React.ReactNode;
}

/** The chat shell around `MessageTextContent`; the feed wraps the same content in a post card. */
export const TextMessageRenderer: React.FC<TextMessageRendererProps> = ({
  message,
  highlighted = false,
  groupedWithAbove = false,
  groupedWithBelow = false,
  bubbleFooter,
}) => (
  <MessageBubble
    isOwn={message.isOwn}
    highlighted={highlighted}
    groupedWithAbove={groupedWithAbove}
    groupedWithBelow={groupedWithBelow}
    className="max-w-full min-w-0"
  >
    <MessageReplyPreview message={message} />
    <MessageContent>
      <MessageTextContent
        text={message.text}
        tone={message.isOwn ? 'accent' : 'surface'}
        mentionCount={message.mentionCount}
        mentionScope={message.mentionScope}
      />
    </MessageContent>
    {bubbleFooter}
  </MessageBubble>
);
