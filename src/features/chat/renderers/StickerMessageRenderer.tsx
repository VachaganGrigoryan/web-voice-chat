import React from 'react';
import { StickerMessage } from '../types/message';

interface StickerMessageRendererProps {
  message: StickerMessage;
}

export const StickerMessageRenderer: React.FC<StickerMessageRendererProps> = ({ message }) => {
  return (
    <div className="p-1">
      <img
        src={message.stickerUrl}
        alt="Sticker"
        className="max-w-[150px]"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
