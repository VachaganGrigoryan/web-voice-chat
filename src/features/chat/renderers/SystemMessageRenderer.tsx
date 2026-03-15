import React from 'react';
import { SystemMessage } from '../types/message';

interface SystemMessageRendererProps {
  message: SystemMessage;
}

export const SystemMessageRenderer: React.FC<SystemMessageRendererProps> = ({ message }) => {
  return (
    <div className="flex justify-center my-4">
      <div className="bg-muted/50 text-muted-foreground text-xs px-3 py-1 rounded-full text-center max-w-[80%]">
        {message.text}
      </div>
    </div>
  );
};
