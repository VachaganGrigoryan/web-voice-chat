import React from 'react';
import { MessageDoc } from '@/api/types';
import { MessageBubble } from '../components/MessageShell';
import { useAudioPlayerStore } from '../store/audioPlayerStore';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/dateUtils';

interface AudioMessageRendererProps {
  message: MessageDoc;
  isMe: boolean;
  highlighted?: boolean;
}

export const AudioMessageRenderer: React.FC<AudioMessageRendererProps> = ({ message, isMe, highlighted }) => {
  const { activeMessage, isPlaying, currentTime, duration, togglePlay } = useAudioPlayerStore();
  
  const isActive = activeMessage?.id === message.id;
  const currentProgress = isActive && duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayTime = isActive ? currentTime : 0;
  const displayDuration = isActive ? duration : (message.media?.duration_ms ? message.media.duration_ms / 1000 : 0);

  return (
    <MessageBubble isMe={isMe} highlighted={highlighted}>
      <div className={cn(
        "flex items-center gap-3 rounded-2xl p-2 pr-4 w-full min-w-[200px] max-w-[300px]",
        isMe ? "bg-primary-foreground/10" : "bg-background/50"
      )}>
        <button
          className={cn(
            "h-8 w-8 shrink-0 rounded-full flex items-center justify-center transition-colors",
            isMe 
              ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90" 
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          onClick={() => togglePlay(message)}
        >
          {isActive && isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current ml-0.5" />
          )}
        </button>
        
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className={cn("h-1.5 w-full rounded-full overflow-hidden", isMe ? "bg-primary-foreground/30" : "bg-secondary")}>
            <div 
              className={cn("h-full transition-all duration-100 ease-linear", isMe ? "bg-primary-foreground" : "bg-primary")}
              style={{ width: `${currentProgress}%` }}
            />
          </div>
          <div className={cn("flex justify-between text-[10px] font-mono", isMe ? "text-primary-foreground/80" : "text-muted-foreground")}>
            <span>{formatDuration(displayTime * 1000)}</span>
            <span>{formatDuration(displayDuration * 1000)}</span>
          </div>
        </div>
      </div>
    </MessageBubble>
  );
};
