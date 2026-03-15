import { Loader2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/dateUtils';
import {
  ChatAudioQueueItem,
  useChatAudioPlayerStore,
} from './audioPlayerStore';

interface AudioPlayerProps {
  src: string;
  durationMs?: number | null;
  className?: string;
  messageId?: string;
  isRead?: boolean;
  isMe?: boolean;
  createdAt?: string;
}

export default function AudioPlayer({
  src,
  durationMs,
  className,
  messageId,
  isRead,
  isMe,
  createdAt,
}: AudioPlayerProps) {
  const activeMessageId = useChatAudioPlayerStore((state) => state.activeItem?.id ?? null);
  const isActive = !!messageId && activeMessageId === messageId;
  const isPlaying = useChatAudioPlayerStore((state) => (isActive ? state.isPlaying : false));
  const isLoading = useChatAudioPlayerStore((state) => (isActive ? state.isLoading : false));
  const currentTime = useChatAudioPlayerStore((state) => (isActive ? state.currentTime : 0));
  const activeDuration = useChatAudioPlayerStore((state) => (isActive ? state.duration : 0));
  const toggleTrack = useChatAudioPlayerStore((state) => state.toggleTrack);

  const visibleDuration = isActive
    ? activeDuration || (durationMs ? durationMs / 1000 : 0)
    : durationMs
    ? durationMs / 1000
    : 0;
  const visibleCurrentTime = isActive ? currentTime : 0;
  const progress = visibleDuration > 0 ? (visibleCurrentTime / visibleDuration) * 100 : 0;

  const handleToggle = () => {
    if (!messageId || !src) return;

    const item: ChatAudioQueueItem = {
      id: messageId,
      src,
      durationMs,
      createdAt,
      isRead,
      isMe,
    };

    toggleTrack(item);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-black/5 p-2.5 pr-3.5 shadow-sm transition-colors",
        isActive && "ring-1 ring-primary/30",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-9 w-9 shrink-0 rounded-full",
          isMe
            ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        onClick={handleToggle}
        aria-label={isActive && isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {isActive && isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive && isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </Button>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-[11px] font-semibold uppercase tracking-[0.18em]",
              isMe ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            Voice
          </span>
          <span
            className={cn(
              "shrink-0 text-[11px] font-mono",
              isMe ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {formatDuration(visibleCurrentTime * 1000)} / {formatDuration(visibleDuration * 1000)}
          </span>
        </div>

        <div
          className={cn(
            "h-1.5 w-full overflow-hidden rounded-full",
            isMe ? "bg-primary-foreground/25" : "bg-secondary"
          )}
        >
          <div
            className={cn(
              "h-full transition-[width] duration-150 ease-linear",
              isMe ? "bg-primary-foreground" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
