import React from 'react';
import { MessageDoc } from '@/api/types';
import { TextMessageRenderer } from './renderers/TextMessageRenderer';
import { ImageMessageRenderer } from './renderers/ImageMessageRenderer';
import { VideoMessageRenderer } from './renderers/VideoMessageRenderer';
import { AudioMessageRenderer } from './renderers/AudioMessageRenderer';
import { StickerMessageRenderer } from './renderers/StickerMessageRenderer';

interface MessageRendererProps {
  message: MessageDoc;
  isMe: boolean;
  highlighted: boolean;
  onMediaClick: (type: 'image' | 'video', url: string) => void;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ message, isMe, highlighted, onMediaClick }) => {
  switch (message.type) {
    case 'text':
      return <TextMessageRenderer message={message} isMe={isMe} highlighted={highlighted} />;
    case 'voice':
      return <AudioMessageRenderer message={message} isMe={isMe} highlighted={highlighted} />;
    case 'image':
      return <ImageMessageRenderer message={message} isMe={isMe} highlighted={highlighted} onMediaClick={onMediaClick} />;
    case 'video':
      return <VideoMessageRenderer message={message} isMe={isMe} highlighted={highlighted} onMediaClick={onMediaClick} />;
    case 'sticker':
      return <StickerMessageRenderer message={message} isMe={isMe} highlighted={highlighted} />;
    default:
      return <div className="px-4 py-2">Unknown message type</div>;
  }
};
