import React from 'react';
import { ImagePlus, Loader2, Mic, Send, Smile, Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { ComposerRecorderTriggerProps } from './ComposerRecorder';

interface ComposerInputRowProps {
  activePanel: 'emoji' | 'attachments' | null;
  isBusy: boolean;
  hasText: boolean;
  text: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  recorderTrigger: ComposerRecorderTriggerProps;
  onTogglePanel: (panel: 'emoji' | 'attachments') => void;
  onTextChange: (value: string) => void;
  onTextareaFocus: () => void;
  onTextareaBlur: () => void;
  onSend: () => void;
}

export function ComposerInputRow({
  activePanel,
  isBusy,
  hasText,
  text,
  textareaRef,
  recorderTrigger,
  onTogglePanel,
  onTextChange,
  onTextareaFocus,
  onTextareaBlur,
  onSend,
}: ComposerInputRowProps) {
  const CurrentRecorderIcon =
    recorderTrigger.mode === 'audio' ? Mic : Video;
  const NextRecorderIcon =
    recorderTrigger.nextMode === 'audio' ? Mic : Video;

  return (
    <div className="flex items-end gap-2 rounded-[28px] border border-border/70 bg-background p-2 shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-11 w-11 shrink-0 rounded-full text-muted-foreground transition-colors',
          activePanel === 'emoji'
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-primary/10 hover:text-primary'
        )}
        onClick={() => onTogglePanel('emoji')}
        disabled={isBusy}
        title="Open emojis"
      >
        <Smile className="h-5 w-5" />
      </Button>

      <div className="flex min-h-[44px] flex-1 items-end gap-2 rounded-[24px] border border-border/60 bg-muted/35 px-2.5 py-1.5 transition-colors focus-within:border-primary/50 focus-within:bg-background">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onFocus={onTextareaFocus}
          onBlur={onTextareaBlur}
          placeholder="Message"
          className="max-h-32 min-h-[34px] w-full resize-none border-0 bg-transparent px-0 py-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          rows={1}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />

        {!hasText ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'mb-0.5 h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-colors',
              activePanel === 'attachments'
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-primary/10 hover:text-primary'
            )}
            onClick={() => onTogglePanel('attachments')}
            disabled={isBusy}
            title="Attach media or files"
          >
            <ImagePlus className="h-4.5 w-4.5" />
          </Button>
        ) : null}
      </div>

      <div className="relative shrink-0">
        <Button
          size="icon"
          className={cn(
            'h-11 w-11 rounded-full shadow-sm transition-colors',
            hasText ? 'bg-primary hover:bg-primary/90' : ''
          )}
          onPointerDown={hasText ? undefined : recorderTrigger.onPressStart}
          onPointerUp={hasText ? undefined : recorderTrigger.onPressEnd}
          onPointerCancel={hasText ? undefined : recorderTrigger.onPressEnd}
          onPointerLeave={hasText ? undefined : recorderTrigger.onPressEnd}
          onClick={hasText ? onSend : recorderTrigger.onClick}
          disabled={hasText ? isBusy : recorderTrigger.disabled}
          title={
            hasText
              ? 'Send message'
              : recorderTrigger.mode === 'audio'
              ? 'Record voice message'
              : 'Record video message'
          }
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasText ? (
            <Send className="ml-0.5 h-4.5 w-4.5" />
          ) : (
            <CurrentRecorderIcon className="h-4.5 w-4.5" />
          )}
        </Button>

        {!hasText ? (
          <>
            <button
              type="button"
              className={cn(
                'absolute -bottom-1 -right-1 flex h-5.5 min-w-[1.4rem] items-center justify-center rounded-full border border-background bg-primary px-1 text-primary-foreground shadow-sm transition-transform',
                recorderTrigger.canSwitchMode
                  ? 'hover:scale-105 active:scale-95'
                  : 'cursor-default opacity-70'
              )}
              onClick={recorderTrigger.onToggleMode}
              aria-label={
                recorderTrigger.nextLabel
                  ? `Switch recorder mode to ${recorderTrigger.nextLabel}`
                  : 'Recorder mode switch unavailable'
              }
              title={
                recorderTrigger.nextLabel
                  ? `Switch to ${recorderTrigger.nextLabel}`
                  : 'Recorder mode switch unavailable'
              }
              disabled={!recorderTrigger.canSwitchMode}
            >
              <NextRecorderIcon className="h-3 w-3" />
            </button>
            <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-background/95 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
              {recorderTrigger.currentLabel}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
