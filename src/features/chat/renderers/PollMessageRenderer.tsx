import React from 'react';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { PollMessage } from '../types/message';
import { MessagePollContent } from '../content/MessagePollContent';

interface PollMessageRendererProps {
  message: PollMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  bubbleFooter?: React.ReactNode;
}

/** The chat shell around `MessagePollContent`; the feed wraps the same content in a post card. */
export const PollMessageRenderer: React.FC<PollMessageRendererProps> = ({
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
  >
    <MessageContent className="min-w-[16rem] max-w-[22rem]">
      <MessagePollContent pollId={message.pollId} question={message.question} />
    </MessageContent>
    {bubbleFooter}
  </MessageBubble>
);
