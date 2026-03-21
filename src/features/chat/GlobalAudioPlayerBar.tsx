import { useEffect, useMemo, useRef } from 'react';
import { Loader2, Pause, Play, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { EVENTS } from '@/socket/events';
import { getSocket } from '@/socket/socket';
import { formatDuration } from '@/utils/dateUtils';
import { useChatAudioPlayerStore } from './audioPlayerStore';

export function GlobalAudioPlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
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
  const close = useChatAudioPlayerStore((state) => state.close);
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
  const progress = visibleDuration > 0 ? Math.min(currentTime / visibleDuration, 1) : 0;

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
      if (canPlayNext) {
        playNext();
      }
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
    canPlayNext,
    hasPlayedMessage,
    markMessagePlayed,
    playNext,
    setCurrentTime,
    setDuration,
    setIsLoading,
    setIsPlaying,
  ]);

  const handleScrub = (clientX: number) => {
    const scrubber = scrubberRef.current;
    if (!scrubber || visibleDuration <= 0) {
      return;
    }

    const rect = scrubber.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    seekTo(ratio * visibleDuration);
  };

  const handleProgressPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleScrub(event.clientX);

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      handleScrub(moveEvent.clientX);
    };

    const handlePointerEnd = () => {
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerEnd);
      target.removeEventListener('pointercancel', handlePointerEnd);
    };

    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerEnd);
    target.addEventListener('pointercancel', handlePointerEnd);
  };

  return (
    <>
      <audio ref={audioRef} src={activeItem?.src || undefined} preload="metadata" />

      {activeItem ? (
        <div className="z-20 shrink-0 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto w-full max-w-5xl px-3 py-2 sm:px-4">
            <div className="rounded-2xl border border-border/60 bg-background/90 shadow-sm">
              <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Volume2 className="h-4 w-4" />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  onClick={playPrevious}
                  disabled={!canPlayPrevious}
                  aria-label="Previous audio message"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className={cn('h-10 w-10 shrink-0 rounded-full shadow-sm', isLoading && 'pointer-events-none')}
                  onClick={togglePlayback}
                  aria-label={isPlaying ? 'Pause playback' : 'Play audio'}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                  )}
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="truncate text-xs font-medium text-foreground">
                      {activeItem.isMe ? 'Your voice message' : 'Voice message'}
                    </div>
                    <div className="shrink-0 text-[11px] font-mono text-muted-foreground">
                      {formatDuration(currentTime * 1000)} / {formatDuration(visibleDuration * 1000)}
                    </div>
                  </div>

                  <div
                    ref={scrubberRef}
                    role="slider"
                    aria-label="Audio progress"
                    aria-valuemin={0}
                    aria-valuemax={visibleDuration || 1}
                    aria-valuenow={Math.min(currentTime, visibleDuration || 0)}
                    tabIndex={0}
                    className="group relative flex h-6 cursor-pointer touch-pan-x items-center"
                    onPointerDown={handleProgressPointerDown}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        seekTo(Math.max(currentTime - 5, 0));
                      }
                      if (event.key === 'ArrowRight') {
                        event.preventDefault();
                        seekTo(Math.min(currentTime + 5, visibleDuration || currentTime + 5));
                      }
                    }}
                  >
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-150 ease-linear"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                    <div
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm transition-[left] duration-150 ease-linear"
                      style={{ left: `calc(${progress * 100}% - 7px)` }}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  onClick={playNext}
                  disabled={!canPlayNext}
                  aria-label="Next audio message"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  onClick={close}
                  aria-label="Close audio player"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
