import React from 'react';
import { Loader2, Pause, Play, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface ComposerAudioPreviewProps {
  audioUrl: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlayingPreview: boolean;
  previewProgress: number;
  durationSec: number;
  isBusy: boolean;
  isSendingAudio: boolean;
  onCancel: () => void;
  onTogglePlayback: () => void;
  onSend: () => void;
  onSetProgress: (value: number) => void;
  onSetPlaying: (value: boolean) => void;
}

export function ComposerAudioPreview({
  audioUrl,
  audioRef,
  isPlayingPreview,
  previewProgress,
  durationSec,
  isBusy,
  isSendingAudio,
  onCancel,
  onTogglePlayback,
  onSend,
  onSetProgress,
  onSetPlaying,
}: ComposerAudioPreviewProps) {
  return (
    <div className="flex items-center gap-2 rounded-[28px] border border-border/70 bg-background p-2 shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={onCancel}
      >
        <Trash2 className="h-5 w-5" />
      </Button>

      <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted/40 px-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
          onClick={onTogglePlayback}
        >
          {isPlayingPreview ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" />
          )}
        </Button>
        <div
          className="relative h-1.5 min-w-[4rem] flex-1 cursor-pointer overflow-hidden rounded-full bg-primary/20"
          onClick={(event) => {
            if (!audioRef.current) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const nextPosition = (event.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = nextPosition * audioRef.current.duration;
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-75"
            style={{ width: `${previewProgress}%` }}
          />
        </div>
        <span className="shrink-0 px-1 font-mono text-xs font-medium text-muted-foreground">
          {formatDuration(durationSec)}
        </span>
      </div>

      <Button
        size="icon"
        className="h-11 w-11 rounded-full shadow-sm"
        onClick={onSend}
        disabled={isBusy}
      >
        {isSendingAudio ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="ml-0.5 h-4 w-4" />
        )}
      </Button>

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          onSetProgress(
            (audioRef.current.currentTime / audioRef.current.duration) * 100
          );
        }}
        onEnded={() => {
          onSetPlaying(false);
          onSetProgress(0);
        }}
        className="hidden"
      />
    </div>
  );
}
