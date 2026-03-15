import React from 'react';
import { ChatMessage } from './types/message';
import { AudioMessageRenderer } from './renderers/AudioMessageRenderer';
import { EmojiMessageRenderer } from './renderers/EmojiMessageRenderer';
import { ImageMessageRenderer } from './renderers/ImageMessageRenderer';
import { StickerMessageRenderer } from './renderers/StickerMessageRenderer';
import { SystemMessageRenderer } from './renderers/SystemMessageRenderer';
import { TextMessageRenderer } from './renderers/TextMessageRenderer';
import { VideoMessageRenderer } from './renderers/VideoMessageRenderer';

interface MessageRendererProps {
  message: ChatMessage;
  highlighted?: boolean;
  onMediaClick?: (type: 'image' | 'video', url: string) => void;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({
  message,
  highlighted = false,
  onMediaClick,
}) => {
  switch (message.kind) {
    case 'text':
      return <TextMessageRenderer message={message} highlighted={highlighted} />;
    case 'image':
      return <ImageMessageRenderer message={message} highlighted={highlighted} onMediaClick={onMediaClick} />;
    case 'video':
      return <VideoMessageRenderer message={message} highlighted={highlighted} onMediaClick={onMediaClick} />;
    case 'audio':
      return <AudioMessageRenderer message={message} highlighted={highlighted} />;
    case 'system':
      return <SystemMessageRenderer message={message} />;
    case 'emoji':
      return <EmojiMessageRenderer message={message} />;
    case 'sticker':
      return <StickerMessageRenderer message={message} />;
    default:
      return <div className="px-4 py-2 text-sm text-muted-foreground">Unknown message type</div>;
  }
};
