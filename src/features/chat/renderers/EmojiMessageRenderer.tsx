import React from 'react';
import { EmojiMessage } from '../types/message';

interface EmojiMessageRendererProps {
  message: EmojiMessage;
}

export const EmojiMessageRenderer: React.FC<EmojiMessageRendererProps> = ({ message }) => {
  return (
    <div className="px-4 py-2 text-4xl">
      {message.text}
    </div>
  );
};
