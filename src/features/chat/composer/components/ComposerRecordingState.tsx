import React from 'react';
import { Mic, Pause, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface ComposerRecordingStateProps {
  isRecordingPaused: boolean;
  durationSec: number;
  onPauseOrResume: () => void;
  onStop: () => void;
}

export function ComposerRecordingState({
  isRecordingPaused,
  durationSec,
  onPauseOrResume,
  onStop,
}: ComposerRecordingStateProps) {
  return (
    <div className="flex items-center gap-2 rounded-[28px] border border-red-500/20 bg-red-500/10 p-2 shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-2">
        <div className="relative flex h-3 w-3 shrink-0">
          {!isRecordingPaused ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          ) : null}
          <span
            className={cn(
              'relative inline-flex h-3 w-3 rounded-full',
              isRecordingPaused ? 'bg-red-300' : 'bg-red-500'
            )}
          />
        </div>
        <span className="min-w-[3rem] shrink-0 font-mono text-sm font-medium text-red-500">
          {formatDuration(durationSec)}
        </span>
        <div className="flex h-8 flex-1 items-center justify-around gap-1 overflow-hidden opacity-60">
          {[...Array(24)].map((_, index) => {
            const height = isRecordingPaused ? 4 : 6 + (index % 6) * 3;
            return (
              <span
                key={`wave-${index}`}
                className="w-1 rounded-full bg-red-400"
                style={{ height }}
              />
            );
          })}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 rounded-full text-red-500 hover:bg-red-500/15 hover:text-red-600"
        onClick={onPauseOrResume}
      >
        {isRecordingPaused ? <Mic className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
      </Button>

      <Button
        variant="destructive"
        size="icon"
        className="h-11 w-11 rounded-full"
        onClick={onStop}
      >
        <Square className="h-4 w-4" />
      </Button>
    </div>
  );
}
