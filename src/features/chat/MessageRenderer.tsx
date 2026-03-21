import React from 'react';
import { ChatMessage } from './types/message';
import { AudioMessageRenderer } from './renderers/AudioMessageRenderer';
import { EmojiMessageRenderer } from './renderers/EmojiMessageRenderer';
import { ImageMessageRenderer } from './renderers/ImageMessageRenderer';
import { StickerMessageRenderer } from './renderers/StickerMessageRenderer';
import { SystemMessageRenderer } from './renderers/SystemMessageRenderer';
import { TextMessageRenderer } from './renderers/TextMessageRenderer';
import { VideoMessageRenderer } from './renderers/VideoMessageRenderer';
import { MessageBubble, MessageContent } from './components/MessageShell';

interface MessageRendererProps {
  message: ChatMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  onMediaClick?: (type: 'image' | 'video', url: string) => void;
  bubbleFooter?: React.ReactNode;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({
  message,
  highlighted = false,
  groupedWithAbove = false,
  groupedWithBelow = false,
  onMediaClick,
  bubbleFooter,
}) => {
  if (message.isDeleted && !message.isOwn) {
    return (
      <MessageBubble
        isOwn={message.isOwn}
        highlighted={highlighted}
        groupedWithAbove={groupedWithAbove}
        groupedWithBelow={groupedWithBelow}
        className="max-w-full min-w-0"
      >
        <MessageContent className="py-1.5">
          <span
            className="text-xs font-medium tracking-wide text-current/45"
            aria-label="deleted"
          >
            deleted
          </span>
        </MessageContent>
        {bubbleFooter}
      </MessageBubble>
    );
  }

  switch (message.kind) {
    case 'text':
      return <TextMessageRenderer message={message} highlighted={highlighted} groupedWithAbove={groupedWithAbove} groupedWithBelow={groupedWithBelow} bubbleFooter={bubbleFooter} />;
    case 'image':
      return <ImageMessageRenderer message={message} highlighted={highlighted} groupedWithAbove={groupedWithAbove} groupedWithBelow={groupedWithBelow} onMediaClick={onMediaClick} bubbleFooter={bubbleFooter} />;
    case 'video':
      return <VideoMessageRenderer message={message} highlighted={highlighted} groupedWithAbove={groupedWithAbove} groupedWithBelow={groupedWithBelow} onMediaClick={onMediaClick} bubbleFooter={bubbleFooter} />;
    case 'audio':
      return <AudioMessageRenderer message={message} highlighted={highlighted} groupedWithAbove={groupedWithAbove} groupedWithBelow={groupedWithBelow} bubbleFooter={bubbleFooter} />;
    case 'system':
      return <SystemMessageRenderer message={message} />;
    case 'emoji':
      return <EmojiMessageRenderer message={message} groupedWithAbove={groupedWithAbove} groupedWithBelow={groupedWithBelow} bubbleFooter={bubbleFooter} />;
    case 'sticker':
      return <StickerMessageRenderer message={message} groupedWithAbove={groupedWithAbove} groupedWithBelow={groupedWithBelow} bubbleFooter={bubbleFooter} />;
    default:
      return <div className="px-4 py-2 text-sm text-muted-foreground">Unknown message type</div>;
  }
};
