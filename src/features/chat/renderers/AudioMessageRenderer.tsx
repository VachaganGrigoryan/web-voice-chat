import React from 'react';
import AudioPlayer from '../media/players/AudioPlayer';
import { MessageBubble } from '../components/MessageShell';
import { AudioMessage } from '../types/message';
import { cn } from '@/lib/utils';
import { MessageReplyPreview } from '../components/MessageReplyPreview';

import { ChatAudioQueueItem } from '../media/players/audioPlayerStore';
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
  const mediaKind = message.media?.kind === 'audio' ? 'audio' : 'voice';
  const playerTitle = mediaKind === 'audio' ? message.fileName || 'Audio file' : 'Voice message';

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
        mediaKind={mediaKind}
        title={playerTitle}
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
      {message.caption ? (
        <div
          className={cn(
            'px-3 pb-2 pt-2 text-sm leading-relaxed',
            message.isOwn ? 'text-primary-foreground/90' : 'text-foreground'
          )}
        >
          {message.caption}
        </div>
      ) : null}
      {bubbleFooter}
    </MessageBubble>
  );
};
