import React from 'react';
import AudioPlayer from '../AudioPlayer';
import { MessageBubble } from '../components/MessageShell';
import { AudioMessage } from '../types/message';
import { cn } from '@/lib/utils';
import { MessageReplyPreview } from '../components/MessageReplyPreview';

interface AudioMessageRendererProps {
  message: AudioMessage;
  highlighted?: boolean;
}

export const AudioMessageRenderer: React.FC<AudioMessageRendererProps> = ({ message, highlighted = false }) => {
  return (
    <MessageBubble isOwn={message.isOwn} highlighted={highlighted}>
      <MessageReplyPreview message={message} />
      <AudioPlayer
        src={message.audioUrl}
        durationMs={message.durationSec ? message.durationSec * 1000 : 0}
        messageId={message.id}
        isRead={message.status === 'read'}
        isMe={message.isOwn}
        createdAt={message.createdAt}
        className={cn(
          "w-full min-w-[200px]",
          message.isOwn ? "bg-primary-foreground/10" : "bg-background/50"
        )}
      />
    </MessageBubble>
  );
};
