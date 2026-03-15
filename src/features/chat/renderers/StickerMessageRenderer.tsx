import React from 'react';
import { MessageDoc } from '@/api/types';
import { MessageBubble } from '../components/MessageShell';

interface StickerMessageRendererProps {
  message: MessageDoc;
  isMe: boolean;
  highlighted?: boolean;
}

export const StickerMessageRenderer: React.FC<StickerMessageRendererProps> = ({ message, isMe, highlighted }) => {
  return (
    <div className="p-1">
      <img src={message.media?.url} alt="Sticker" className="max-w-[150px]" referrerPolicy="no-referrer" />
    </div>
  );
};
