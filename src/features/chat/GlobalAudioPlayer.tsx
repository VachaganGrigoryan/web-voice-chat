import React, { useRef, useEffect } from 'react';
import { useAudioPlayerStore } from './store/audioPlayerStore';
import { Play, Pause, X, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/dateUtils';

export const GlobalAudioPlayer: React.FC = () => {
  const { 
    activeMessage, 
    isPlaying, 
    currentTime, 
    duration, 
    togglePlay, 
    close, 
    seek, 
    playNext, 
    playPrevious,
    audioMessages
  } = useAudioPlayerStore();
  
  const progressRef = useRef<HTMLDivElement>(null);

  if (!activeMessage) return null;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    seek(percentage * duration);
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  const currentIndex = audioMessages.findIndex(m => m.id === activeMessage.id);
  const hasNext = currentIndex > 0;
  const hasPrev = currentIndex !== -1 && currentIndex < audioMessages.length - 1;

  return (
    <div className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border shadow-sm">
      <div className="flex flex-col w-full max-w-3xl mx-auto px-4 py-2 gap-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button 
              onClick={() => togglePlay(activeMessage)}
              className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0 transition-colors"
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
            </button>
            
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium truncate">Voice message</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{formatDuration(currentTime * 1000)}</span>
                <span>/</span>
                <span className="tabular-nums">{formatDuration(duration * 1000)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button 
              onClick={playPrevious}
              disabled={!hasPrev}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground disabled:opacity-50 transition-colors"
            >
              <SkipBack className="h-4 w-4 fill-current" />
            </button>
            <button 
              onClick={playNext}
              disabled={!hasNext}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground disabled:opacity-50 transition-colors"
            >
              <SkipForward className="h-4 w-4 fill-current" />
            </button>
            <div className="w-px h-6 bg-border mx-1" />
            <button 
              onClick={close}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div 
          ref={progressRef}
          className="h-2 bg-muted rounded-full overflow-hidden cursor-pointer relative group"
          onClick={handleProgressClick}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-primary transition-all duration-100 ease-linear"
            style={{ width: `${progressPercentage}%` }}
          />
          {/* Scrubber handle */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progressPercentage}% - 6px)` }}
          />
        </div>
      </div>
    </div>
  );
};
