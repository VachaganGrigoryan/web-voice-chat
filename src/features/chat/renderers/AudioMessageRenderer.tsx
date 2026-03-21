import React from 'react';
import AudioPlayer from '../AudioPlayer';
import { MessageBubble } from '../components/MessageShell';
import { AudioMessage } from '../types/message';
import { cn } from '@/lib/utils';
import { MessageReplyPreview } from '../components/MessageReplyPreview';

import { ChatAudioQueueItem } from '../audioPlayerStore';
interface AudioMessageRendererProps {
  message: AudioMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  bubbleFooter?: React.ReactNode;
  audioQueueKey?: string | null;
  audioQueue?: ChatAudioQueueItem[];
}

export const AudioMessageRenderer: React.FC<AudioMessageRendererProps> = ({
  message,
  highlighted = false,
  groupedWithAbove = false,
  groupedWithBelow = false,
  bubbleFooter,
  audioQueueKey,
  audioQueue,
}) => {
  return (
    <MessageBubble
      isOwn={message.isOwn}
      highlighted={highlighted}
      groupedWithAbove={groupedWithAbove}
      groupedWithBelow={groupedWithBelow}
    >
      <MessageReplyPreview message={message} />
      <AudioPlayer
        src={message.audioUrl}
        durationMs={message.durationSec ? message.durationSec * 1000 : 0}
        messageId={message.id}
        queueKey={audioQueueKey}
        queue={audioQueue}
        isRead={message.status === 'read'}
        isMe={message.isOwn}
        createdAt={message.createdAt}
        className={cn(
          "w-full min-w-[200px]",
          message.isOwn ? "bg-primary-foreground/10" : "bg-background/50"
        )}
      />
      {bubbleFooter}
    </MessageBubble>
  );
};
