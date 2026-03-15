import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';

interface AudioPlayerProps {
  src: string;
  durationMs?: number | null;
  className?: string;
  messageId?: string;
  isRead?: boolean;
  isMe?: boolean;
}

export default function AudioPlayer({ src, durationMs, className, messageId, isRead, isMe }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (!durationMs) setDuration(audio.duration);
      setIsLoading(false);
    };
    const handleEnded = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handlePlay = () => {
      setIsPlaying(true);
      if (messageId && !isRead && !hasPlayedRef.current) {
        const socket = getSocket();
        socket?.emit(EVENTS.MESSAGE_READ, { message_id: messageId });
        hasPlayedRef.current = true;
      }
    };
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [durationMs, messageId]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-3 rounded-full bg-secondary/50 p-2 pr-4 w-full max-w-[300px]", className)}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 shrink-0 rounded-full",
          isMe 
            ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90" 
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        onClick={togglePlay}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </Button>
      
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className={cn("h-1.5 w-full rounded-full overflow-hidden", isMe ? "bg-primary-foreground/30" : "bg-secondary")}>
          <div 
            className={cn("h-full transition-all duration-100 ease-linear", isMe ? "bg-primary-foreground" : "bg-primary")}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={cn("flex justify-between text-[10px] font-mono", isMe ? "text-primary-foreground/80" : "text-muted-foreground")}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
