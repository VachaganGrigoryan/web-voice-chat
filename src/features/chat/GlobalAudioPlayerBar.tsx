import { useEffect, useMemo, useRef } from 'react';
import {
  FastForward,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { EVENTS } from '@/socket/events';
import { getSocket } from '@/socket/socket';
import {
  useChatAudioPlayerStore,
} from './audioPlayerStore';
import {
  formatDuration,
  formatMessageDay,
  formatMessageTime,
} from '@/utils/dateUtils';

const SEEK_STEP_SECONDS = 10;

export function GlobalAudioPlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const queue = useChatAudioPlayerStore((state) => state.queue);
  const activeItem = useChatAudioPlayerStore((state) => state.activeItem);
  const isPlaying = useChatAudioPlayerStore((state) => state.isPlaying);
  const isLoading = useChatAudioPlayerStore((state) => state.isLoading);
  const currentTime = useChatAudioPlayerStore((state) => state.currentTime);
  const duration = useChatAudioPlayerStore((state) => state.duration);
  const shouldAutoplay = useChatAudioPlayerStore((state) => state.shouldAutoplay);
  const setAudioElement = useChatAudioPlayerStore((state) => state.setAudioElement);
  const setCurrentTime = useChatAudioPlayerStore((state) => state.setCurrentTime);
  const setDuration = useChatAudioPlayerStore((state) => state.setDuration);
  const setIsLoading = useChatAudioPlayerStore((state) => state.setIsLoading);
  const setIsPlaying = useChatAudioPlayerStore((state) => state.setIsPlaying);
  const consumeAutoplay = useChatAudioPlayerStore((state) => state.consumeAutoplay);
  const hasPlayedMessage = useChatAudioPlayerStore((state) => state.hasPlayedMessage);
  const markMessagePlayed = useChatAudioPlayerStore((state) => state.markMessagePlayed);
  const togglePlayback = useChatAudioPlayerStore((state) => state.togglePlayback);
  const stop = useChatAudioPlayerStore((state) => state.stop);
  const close = useChatAudioPlayerStore((state) => state.close);
  const seekBy = useChatAudioPlayerStore((state) => state.seekBy);
  const seekTo = useChatAudioPlayerStore((state) => state.seekTo);
  const playNext = useChatAudioPlayerStore((state) => state.playNext);
  const playPrevious = useChatAudioPlayerStore((state) => state.playPrevious);

  const activeIndex = useMemo(() => {
    if (!activeItem) return -1;
    return queue.findIndex((item) => item.id === activeItem.id);
  }, [activeItem?.id, queue]);

  const canPlayPrevious = activeIndex > 0;
  const canPlayNext = activeIndex !== -1 && activeIndex < queue.length - 1;
  const visibleDuration = duration || (activeItem?.durationMs ? activeItem.durationMs / 1000 : 0);
  const progressMax = visibleDuration > 0 ? visibleDuration : 0;
  const subtitle = activeItem?.createdAt
    ? `${formatMessageDay(activeItem.createdAt)} • ${formatMessageTime(activeItem.createdAt)}`
    : activeItem?.isMe
    ? 'Sent by you'
    : 'Voice message';

  useEffect(() => {
    setAudioElement(audioRef.current);
    return () => setAudioElement(null);
  }, [setAudioElement]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!activeItem) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    audio.load();
  }, [activeItem?.id, activeItem?.src]);

  useEffect(() => {
    if (!shouldAutoplay || !activeItem) return;

    const audio = audioRef.current;
    if (!audio) return;

    const playPromise = audio.play();
    consumeAutoplay();

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setIsPlaying(false);
        setIsLoading(false);
      });
    }
  }, [activeItem?.id, consumeAutoplay, setIsLoading, setIsPlaying, shouldAutoplay]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else {
        setDuration(activeItem?.durationMs ? activeItem.durationMs / 1000 : 0);
      }
      setIsLoading(false);
    };
    const handleDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handlePlay = () => {
      setIsPlaying(true);
      if (activeItem && !activeItem.isRead && !hasPlayedMessage(activeItem.id)) {
        getSocket()?.emit(EVENTS.MESSAGE_READ, { message_id: activeItem.id });
        markMessagePlayed(activeItem.id);
      }
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setIsLoading(false);
      setCurrentTime(audio.duration || 0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [
    activeItem?.durationMs,
    activeItem?.id,
    activeItem?.isRead,
    hasPlayedMessage,
    markMessagePlayed,
    setCurrentTime,
    setDuration,
    setIsLoading,
    setIsPlaying,
  ]);

  return (
    <>
      <audio ref={audioRef} src={activeItem?.src || undefined} preload="metadata" />

      {activeItem ? (
        <div className="sticky top-0 z-20 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-3 py-3 sm:px-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Volume2 className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Now playing
                    </div>
                    <div className="truncate text-sm font-semibold text-foreground">
                      {activeItem.isMe ? 'Your voice message' : 'Voice message'}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {subtitle}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={stop}
                      aria-label="Stop playback"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={close}
                      aria-label="Close audio player"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <input
                    type="range"
                    min={0}
                    max={progressMax || 1}
                    step={0.1}
                    value={Math.min(currentTime, progressMax || 1)}
                    onChange={(event) => seekTo(Number(event.target.value))}
                    className="h-2 w-full cursor-pointer accent-primary"
                    aria-label="Audio progress"
                  />

                  <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>{formatDuration(currentTime * 1000)}</span>
                    <span>{formatDuration(visibleDuration * 1000)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1 sm:justify-center sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={playPrevious}
                disabled={!canPlayPrevious}
                aria-label="Previous audio message"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => seekBy(-SEEK_STEP_SECONDS)}
                aria-label="Seek backward 10 seconds"
              >
                <div className="relative flex h-5 w-5 items-center justify-center">
                  <SkipBack className="h-5 w-5" />
                  <span className="absolute -bottom-2 text-[9px] font-bold">10</span>
                </div>
              </Button>

              <Button
                type="button"
                variant="default"
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-full shadow-sm",
                  isLoading && "pointer-events-none"
                )}
                onClick={togglePlayback}
                aria-label={isPlaying ? 'Pause playback' : 'Play audio'}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => seekBy(SEEK_STEP_SECONDS)}
                aria-label="Seek forward 10 seconds"
              >
                <div className="relative flex h-5 w-5 items-center justify-center">
                  <FastForward className="h-5 w-5" />
                  <span className="absolute -bottom-2 text-[9px] font-bold">10</span>
                </div>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={playNext}
                disabled={!canPlayNext}
                aria-label="Next audio message"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
