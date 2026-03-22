import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const formatVideoTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const detectHasAudio = (video: HTMLVideoElement) => {
  const candidate = video as HTMLVideoElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
  };

  return Boolean(
    candidate.mozHasAudio ||
      (typeof candidate.webkitAudioDecodedByteCount === 'number' && candidate.webkitAudioDecodedByteCount > 0) ||
      (candidate.audioTracks && candidate.audioTracks.length > 0)
  );
};

interface VideoThumbnailProps {
  src: string;
  className?: string;
  videoClassName?: string;
  label?: string;
  onClick?: () => void;
  asButton?: boolean;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  src,
  className,
  videoClassName,
  label = 'Video',
  onClick,
  asButton = true,
}) => {
  const [duration, setDuration] = useState<number | null>(null);
  const Container = asButton ? 'button' : 'div';

  return (
    <Container
      {...(asButton ? { type: 'button' as const } : {})}
      className={cn(
        'group relative overflow-hidden rounded-[inherit] bg-black text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      onClick={onClick}
    >
      <video
        src={src}
        className={cn('h-full w-full object-cover', videoClassName)}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          setDuration(Number.isFinite(nextDuration) ? nextDuration : null);
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/55" />
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
        <span className="rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/95 backdrop-blur-md">
          {label}
        </span>
      </div>
      {duration ? (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
          {formatVideoTime(duration)}
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white shadow-lg backdrop-blur-md transition-transform duration-200 group-hover:scale-105">
          <Play className="ml-1 h-6 w-6 fill-current" />
        </div>
      </div>
    </Container>
  );
};

interface CustomVideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  className?: string;
  onClose?: () => void;
  onDownload?: () => void;
}

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  src,
  autoPlay = true,
  className,
  onClose,
  onDownload,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnded, setIsEnded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasAudio, setHasAudio] = useState(true);

  const progressPercent = useMemo(
    () => (duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0),
    [currentTime, duration]
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    setIsPlaying(autoPlay);
    setIsLoading(true);
    setIsEnded(false);
    setCurrentTime(0);

    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.currentTime = 0;
    if (autoPlay) {
      void video.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [src, autoPlay]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused || video.ended) {
      if (video.ended) {
        video.currentTime = 0;
        setCurrentTime(0);
      }
      void video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await container.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden rounded-[inherit] bg-black text-white', className)}
    >
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full object-contain"
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
          setHasAudio(detectHasAudio(event.currentTarget));
        }}
        onCanPlay={() => setIsLoading(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
          setIsEnded(false);
        }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          setIsEnded(true);
          setCurrentTime(duration);
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70" />

      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </div>
      ) : null}

      {!isPlaying || isEnded ? (
        <button
          type="button"
          className="absolute inset-0 z-10 flex items-center justify-center"
          onClick={togglePlayback}
          aria-label={isEnded ? 'Replay video' : 'Play video'}
        >
          <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-white/20 bg-black/50 text-white shadow-xl backdrop-blur-md transition-transform duration-200 hover:scale-105">
            <Play className="ml-1 h-8 w-8 fill-current" />
          </div>
        </button>
      ) : null}

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 sm:p-4">
        <div className="rounded-full border border-white/12 bg-black/40 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">
          {isLoading ? 'Loading' : isEnded ? 'Ended' : isPlaying ? 'Playing' : 'Paused'}
        </div>
        <div className="flex items-center gap-2">
          {onDownload ? (
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
              onClick={onDownload}
              aria-label="Download video"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
              onClick={onClose}
              aria-label="Close player"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4">
        <div className="rounded-[24px] border border-white/12 bg-black/42 p-3 text-white backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/20"
              onClick={togglePlayback}
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>

            <div className="min-w-0 flex-1">
              <div className="relative h-2 overflow-hidden rounded-full bg-white/18">
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(event) => {
                    const video = videoRef.current;
                    if (!video) {
                      return;
                    }

                    const nextTime = Number(event.target.value);
                    video.currentTime = nextTime;
                    setCurrentTime(nextTime);
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Seek video"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-white/75">
                <span>{formatVideoTime(currentTime)}</span>
                <span>{formatVideoTime(duration)}</span>
              </div>
            </div>

            {hasAudio ? (
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/20"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute video' : 'Mute video'}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            ) : null}

            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/20"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
