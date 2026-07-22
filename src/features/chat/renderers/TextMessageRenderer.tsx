import React from 'react';
import { TextMessage } from '../types/message';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';
import { MessageReplyPreview } from '../components/MessageReplyPreview';

interface TextMessageRendererProps {
  message: TextMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  bubbleFooter?: React.ReactNode;
}

export const TextMessageRenderer: React.FC<TextMessageRendererProps> = ({
  message,
  highlighted = false,
  groupedWithAbove = false,
  groupedWithBelow = false,
  bubbleFooter,
}) => {
  const mentionCount = message.raw.mention_user_ids?.length || 0;
  const mentionScope = message.raw.mention_scope;

  return (
    <MessageBubble
      isOwn={message.isOwn}
      highlighted={highlighted}
      groupedWithAbove={groupedWithAbove}
      groupedWithBelow={groupedWithBelow}
      className="max-w-full min-w-0"
    >
      <MessageReplyPreview message={message} />
      <MessageContent>
        {mentionScope || mentionCount > 0 ? (
          <div className="mb-1 flex flex-wrap gap-1">
            {mentionScope ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                @{mentionScope}
              </span>
            ) : null}
            {mentionCount > 0 ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {mentionCount} mention{mentionCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        ) : null}
        <MessageMarkdown text={message.text} isOwn={message.isOwn} />
      </MessageContent>
      {bubbleFooter}
    </MessageBubble>
  );
};
