import React, { useEffect, useMemo, useRef, useState } from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import {
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  Pause,
  Play,
  Send,
  Smile,
  Square,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { SendMediaInput, SendTextInput } from '@/hooks/useChat';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import { FILE_ATTACH_ACCEPT, MEDIA_ATTACH_ACCEPT } from '@/utils/fileUtils';
import { ComposerReplyTarget } from './types/message';
import { MOBILE_BREAKPOINT } from './utils/chatLayoutUtils';
import VideoRecorderModal from './media/recorders/VideoRecorderModal';
import { useComposerTextInput } from './hooks/useComposerTextInput';
import { useAudioRecorderController } from './hooks/useAudioRecorderController';
import { useAttachmentComposerController } from './hooks/useAttachmentComposerController';
import { ComposerAttachmentBatchDialog } from './components/ComposerAttachmentBatchDialog';

type ComposerPanel = 'emoji' | 'attachments' | null;

interface ChatComposerProps {
  receiverId: string;
  onSendText: (data: SendTextInput) => Promise<unknown>;
  onSendMedia: (data: SendMediaInput) => Promise<unknown>;
  replyTarget?: ComposerReplyTarget | null;
  onClearReplyTarget?: () => void;
  isUploading?: boolean;
  contextLabel?: string;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function ComposerReplyBar({
  replyTarget,
  onClear,
}: {
  replyTarget?: ComposerReplyTarget | null;
  onClear?: () => void;
}) {
  if (!replyTarget) {
    return null;
  }

  return (
    <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">
          {replyTarget.mode === 'thread' ? 'Thread Reply' : 'Reply'}
        </div>
        <div className="text-xs text-muted-foreground">{replyTarget.senderLabel}</div>
        <div className="truncate text-sm text-foreground">{replyTarget.previewText}</div>
      </div>
      {onClear ? (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function ComposerPlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-[18rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 text-center">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{description}</div>
    </div>
  );
}

export default function ChatComposer({
  receiverId,
  onSendText,
  onSendMedia,
  replyTarget,
  onClearReplyTarget,
  isUploading = false,
  contextLabel = 'chat',
}: ChatComposerProps) {
  const [activePanel, setActivePanel] = useState<ComposerPanel>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  const desktopPanelRef = useRef<HTMLDivElement | null>(null);
  const composerShellRef = useRef<HTMLDivElement | null>(null);
  const recorderLongPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderActionTriggeredRef = useRef(false);

  const textInput = useComposerTextInput({
    receiverId,
    onSendText,
    onClearReplyTarget,
  });

  const audioRecorder = useAudioRecorderController({
    receiverId,
    onSendMedia,
    replyTarget,
    onClearReplyTarget,
  });

  const attachmentComposer = useAttachmentComposerController({
    receiverId,
    onSendMedia,
    replyTarget,
    onClearReplyTarget,
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (
      attachmentComposer.isBatchDialogOpen ||
      audioRecorder.isRecording ||
      audioRecorder.audioUrl
    ) {
      setActivePanel(null);
    }
  }, [
    attachmentComposer.isBatchDialogOpen,
    audioRecorder.isRecording,
    audioRecorder.audioUrl,
  ]);

  useEffect(() => {
    if (!activePanel || isMobileViewport) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (desktopPanelRef.current?.contains(target) || composerShellRef.current?.contains(target))
      ) {
        return;
      }

      setActivePanel(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePanel(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [activePanel, isMobileViewport]);

  const closePanels = () => setActivePanel(null);

  const handleTogglePanel = (panel: Exclude<ComposerPanel, null>) => {
    textInput.blurTextarea();
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const handlePickAttachments = (mode: 'media' | 'file') => {
    attachmentComposer.openPickerForMode(mode);
    closePanels();
  };

  const handleSendText = async () => {
    const sent = await textInput.handleSendText();
    if (sent) {
      closePanels();
    }
  };

  const clearRecorderPressTimeout = () => {
    if (recorderLongPressTimeoutRef.current) {
      clearTimeout(recorderLongPressTimeoutRef.current);
      recorderLongPressTimeoutRef.current = null;
    }
  };

  const handleRecorderPressStart = () => {
    if (textInput.hasText) {
      return;
    }

    recorderActionTriggeredRef.current = false;
    clearRecorderPressTimeout();
    recorderLongPressTimeoutRef.current = setTimeout(() => {
      recorderActionTriggeredRef.current = true;
      closePanels();
      audioRecorder.handleRecorderAction();
    }, 280);
  };

  const handleRecorderPressEnd = () => {
    clearRecorderPressTimeout();
  };

  const handleRecorderClick = () => {
    if (textInput.hasText) {
      void handleSendText();
      return;
    }

    if (recorderActionTriggeredRef.current) {
      recorderActionTriggeredRef.current = false;
      return;
    }

    closePanels();
    audioRecorder.handleRecorderAction();
  };

  const currentRecorderLabel =
    audioRecorder.recorderMode === 'audio' ? 'Audio' : 'Video';
  const CurrentRecorderIcon =
    audioRecorder.recorderMode === 'audio' ? Mic : Video;
  const NextRecorderIcon =
    audioRecorder.recorderMode === 'audio' ? Video : Mic;

  const isBusy =
    isUploading ||
    textInput.isSendingText ||
    audioRecorder.isSendingAudio ||
    attachmentComposer.isBatchUploading;

  const canSwitchRecorderModes =
    !isBusy &&
    !audioRecorder.isRecording &&
    !audioRecorder.audioUrl &&
    !audioRecorder.isVideoRecorderOpen;

  const emojiPickerWidth = useMemo(() => {
    if (typeof window === 'undefined') {
      return 320;
    }

    return isMobileViewport ? Math.max(280, window.innerWidth - 24) : 340;
  }, [isMobileViewport]);

  const renderEmojiPanel = () => (
    <Tabs defaultValue="emoji" className="w-full">
      <TabsList className="grid h-11 w-full grid-cols-3 rounded-2xl bg-muted/50">
        <TabsTrigger value="emoji" className="rounded-xl text-xs sm:text-sm">
          Emojis
        </TabsTrigger>
        <TabsTrigger value="gif" className="rounded-xl text-xs sm:text-sm">
          GIFs
        </TabsTrigger>
        <TabsTrigger value="stickers" className="rounded-xl text-xs sm:text-sm">
          Stickers
        </TabsTrigger>
      </TabsList>
      <TabsContent value="emoji" className="mt-3 overflow-hidden rounded-2xl">
        <EmojiPicker
          onEmojiClick={(emojiObject) => textInput.appendText(emojiObject.emoji)}
          theme={Theme.AUTO}
          width={emojiPickerWidth}
          height={isMobileViewport ? 360 : 400}
        />
      </TabsContent>
      <TabsContent value="gif" className="mt-3">
        <ComposerPlaceholderPanel
          title="GIFs are coming next"
          description={`This ${contextLabel} composer now has the Telegram-style panel structure, but GIF sources are not integrated yet.`}
        />
      </TabsContent>
      <TabsContent value="stickers" className="mt-3">
        <ComposerPlaceholderPanel
          title="Sticker picker coming next"
          description="Sticker rendering already exists in chat, but sticker selection is not wired to a real source in this first composer refactor."
        />
      </TabsContent>
    </Tabs>
  );

  const renderAttachmentPanel = () => (
    <Tabs
      value={attachmentComposer.attachMode}
      onValueChange={(value) =>
        attachmentComposer.setAttachMode(value as 'media' | 'file')
      }
      className="w-full"
    >
      <TabsList className="grid h-11 w-full grid-cols-2 rounded-2xl bg-muted/50">
        <TabsTrigger value="media" className="rounded-xl text-xs sm:text-sm">
          Media
        </TabsTrigger>
        <TabsTrigger value="file" className="rounded-xl text-xs sm:text-sm">
          Files
        </TabsTrigger>
      </TabsList>

      <TabsContent value="media" className="mt-3">
        <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-primary/10 p-2 text-primary">
              <ImagePlus className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">
                Gallery / Media
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Choose photos and videos. Batch preview, caption, retry, and send keep the current working flow.
              </div>
            </div>
          </div>
          <Button
            className="mt-4 w-full rounded-full"
            onClick={() => handlePickAttachments('media')}
            disabled={isBusy}
          >
            Open media picker
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="file" className="mt-3">
        <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-primary/10 p-2 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">Files</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Attach documents, images, audio, and supported files using the existing validated upload flow.
              </div>
            </div>
          </div>
          <Button
            className="mt-4 w-full rounded-full"
            onClick={() => handlePickAttachments('file')}
            disabled={isBusy}
          >
            Open file picker
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );

  const renderDesktopPanel = () => {
    if (!activePanel || isMobileViewport) {
      return null;
    }

    return (
      <div
        ref={desktopPanelRef}
        className={cn(
          'absolute bottom-full z-50 mb-3 rounded-[28px] border border-border/70 bg-background/98 p-3 shadow-2xl backdrop-blur-xl',
          activePanel === 'emoji'
            ? 'left-0 w-[min(100%,22rem)]'
            : 'right-0 w-[min(100%,22rem)]'
        )}
      >
        {activePanel === 'emoji' ? renderEmojiPanel() : renderAttachmentPanel()}
      </div>
    );
  };

  return (
    <>
      <VideoRecorderModal
        open={audioRecorder.isVideoRecorderOpen}
        onOpenChange={audioRecorder.setIsVideoRecorderOpen}
        receiverId={receiverId}
        onSendVideo={onSendMedia}
        replyTarget={replyTarget}
        onClearReplyTarget={onClearReplyTarget}
      />

      <input
        type="file"
        ref={attachmentComposer.mediaInputRef}
        className="hidden"
        onChange={attachmentComposer.onMediaInputChange}
        accept={MEDIA_ATTACH_ACCEPT}
        multiple
      />
      <input
        type="file"
        ref={attachmentComposer.fileInputRef}
        className="hidden"
        onChange={attachmentComposer.onFileInputChange}
        accept={FILE_ATTACH_ACCEPT}
        multiple
      />

      <ComposerAttachmentBatchDialog
        open={attachmentComposer.isBatchDialogOpen}
        items={attachmentComposer.items}
        attachMode={attachmentComposer.attachMode}
        captionText={attachmentComposer.captionText}
        onCaptionTextChange={attachmentComposer.setCaptionText}
        isBatchUploading={attachmentComposer.isBatchUploading}
        hasSentCaption={attachmentComposer.hasSentCaption}
        replyTarget={replyTarget}
        onDismiss={attachmentComposer.dismissBatchDialog}
        onRemoveItem={attachmentComposer.removeItem}
        onSendBatch={() => void attachmentComposer.handleSendBatch()}
        onAddMore={() =>
          attachmentComposer.openPickerForMode(attachmentComposer.attachMode)
        }
        canAddMore={attachmentComposer.canAddMore}
      />

      <Dialog
        open={isMobileViewport && !!activePanel}
        onOpenChange={(open) => {
          if (!open) {
            closePanels();
          }
        }}
      >
        {isMobileViewport ? (
          <DialogContent className="z-[60] [&>button]:hidden fixed inset-x-0 bottom-0 top-auto max-h-[75dvh] w-full translate-x-0 translate-y-0 rounded-t-[28px] border-x-0 border-b-0 border-t border-border/70 bg-background/98 p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border/80" />
            <DialogTitle className="text-sm font-semibold">
              {activePanel === 'emoji' ? 'Emoji Panel' : 'Attachments'}
            </DialogTitle>
            <DialogDescription className="mb-3 text-xs text-muted-foreground">
              {activePanel === 'emoji'
                ? `Emoji is fully working now. GIF and sticker tabs for ${contextLabel} ship as structured placeholders.`
                : `Choose how to attach media or files in ${contextLabel}.`}
            </DialogDescription>
            <div className="min-h-0 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
              {activePanel === 'emoji' ? renderEmojiPanel() : renderAttachmentPanel()}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <div className="w-full bg-background/90 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <ComposerReplyBar
          replyTarget={replyTarget}
          onClear={onClearReplyTarget}
        />

        <div ref={composerShellRef} className="relative">
          {renderDesktopPanel()}

          {audioRecorder.isRecording ? (
            <div className="flex items-center gap-2 rounded-[28px] border border-red-500/20 bg-red-500/10 p-2 shadow-sm">
              <div className="flex min-w-0 flex-1 items-center gap-3 px-2">
                <div className="relative flex h-3 w-3 shrink-0">
                  {!audioRecorder.isRecordingPaused ? (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  ) : null}
                  <span
                    className={cn(
                      'relative inline-flex h-3 w-3 rounded-full',
                      audioRecorder.isRecordingPaused ? 'bg-red-300' : 'bg-red-500'
                    )}
                  />
                </div>
                <span className="min-w-[3rem] shrink-0 font-mono text-sm font-medium text-red-500">
                  {formatDuration(audioRecorder.durationSec)}
                </span>
                <div className="flex h-8 flex-1 items-center justify-around gap-1 overflow-hidden opacity-60">
                  {[...Array(24)].map((_, index) => {
                    const height =
                      audioRecorder.isRecordingPaused ? 4 : 6 + (index % 6) * 3;
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
                onClick={
                  audioRecorder.isRecordingPaused
                    ? () => void audioRecorder.resumeAudioRecording()
                    : () => void audioRecorder.pauseAudioRecording()
                }
              >
                {audioRecorder.isRecordingPaused ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <Pause className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant="destructive"
                size="icon"
                className="h-11 w-11 rounded-full"
                onClick={() => void audioRecorder.stopAudioRecording()}
              >
                <Square className="h-4 w-4" />
              </Button>
            </div>
          ) : audioRecorder.audioUrl ? (
            <div className="flex items-center gap-2 rounded-[28px] border border-border/70 bg-background p-2 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void audioRecorder.cancelAudioRecording()}
              >
                <Trash2 className="h-5 w-5" />
              </Button>

              <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted/40 px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
                  onClick={audioRecorder.togglePreviewPlayback}
                >
                  {audioRecorder.isPlayingPreview ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4" />
                  )}
                </Button>
                <div
                  className="relative h-1.5 min-w-[4rem] flex-1 cursor-pointer overflow-hidden rounded-full bg-primary/20"
                  onClick={(event) => {
                    if (!audioRecorder.audioRef.current) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const nextPosition = (event.clientX - rect.left) / rect.width;
                    audioRecorder.audioRef.current.currentTime =
                      nextPosition * audioRecorder.audioRef.current.duration;
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-75"
                    style={{ width: `${audioRecorder.previewProgress}%` }}
                  />
                </div>
                <span className="shrink-0 px-1 font-mono text-xs font-medium text-muted-foreground">
                  {formatDuration(audioRecorder.durationSec)}
                </span>
              </div>

              <Button
                size="icon"
                className="h-11 w-11 rounded-full shadow-sm"
                onClick={() => void audioRecorder.sendRecordedAudio()}
                disabled={isBusy}
              >
                {audioRecorder.isSendingAudio || isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="ml-0.5 h-4 w-4" />
                )}
              </Button>

              <audio
                ref={audioRecorder.audioRef}
                src={audioRecorder.audioUrl}
                onTimeUpdate={() => {
                  if (!audioRecorder.audioRef.current) return;
                  audioRecorder.setPreviewProgress(
                    (audioRecorder.audioRef.current.currentTime /
                      audioRecorder.audioRef.current.duration) *
                      100
                  );
                }}
                onEnded={() => {
                  audioRecorder.setIsPlayingPreview(false);
                  audioRecorder.setPreviewProgress(0);
                }}
                className="hidden"
              />
            </div>
          ) : (
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
                onClick={() => handleTogglePanel('emoji')}
                disabled={isBusy}
                title="Open emojis"
              >
                <Smile className="h-5 w-5" />
              </Button>

              <div className="flex min-h-[44px] flex-1 items-end gap-2 rounded-[24px] border border-border/60 bg-muted/35 px-2.5 py-1.5 transition-colors focus-within:border-primary/50 focus-within:bg-background">
                <textarea
                  ref={textInput.textareaRef}
                  value={textInput.text}
                  onChange={(event) => textInput.handleTextChange(event.target.value)}
                  onFocus={() => textInput.setIsFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => textInput.setIsFocused(false), 120);
                  }}
                  placeholder="Message"
                  className="max-h-32 min-h-[34px] w-full resize-none border-0 bg-transparent px-0 py-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
                  rows={1}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendText();
                    }
                  }}
                />

                {!textInput.hasText ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'mb-0.5 h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-colors',
                      activePanel === 'attachments'
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-primary/10 hover:text-primary'
                    )}
                    onClick={() => handleTogglePanel('attachments')}
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
                    textInput.hasText ? 'bg-primary hover:bg-primary/90' : ''
                  )}
                  onPointerDown={handleRecorderPressStart}
                  onPointerUp={handleRecorderPressEnd}
                  onPointerCancel={handleRecorderPressEnd}
                  onPointerLeave={handleRecorderPressEnd}
                  onClick={handleRecorderClick}
                  disabled={isBusy}
                  title={
                    textInput.hasText
                      ? 'Send message'
                      : audioRecorder.recorderMode === 'audio'
                      ? 'Record voice message'
                      : 'Record video message'
                  }
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : textInput.hasText ? (
                    <Send className="ml-0.5 h-4.5 w-4.5" />
                  ) : (
                    <CurrentRecorderIcon className="h-4.5 w-4.5" />
                  )}
                </Button>

                {!textInput.hasText ? (
                  <>
                    <button
                      type="button"
                      className={cn(
                        'absolute -bottom-1 -right-1 flex h-5.5 min-w-[1.4rem] items-center justify-center rounded-full border border-background bg-primary px-1 text-primary-foreground shadow-sm transition-transform',
                        canSwitchRecorderModes
                          ? 'hover:scale-105 active:scale-95'
                          : 'cursor-default opacity-70'
                      )}
                      onClick={() => {
                        if (!canSwitchRecorderModes) return;
                        audioRecorder.setRecorderMode((current) =>
                          current === 'audio' ? 'video' : 'audio'
                        );
                      }}
                      aria-label={`Switch recorder mode from ${currentRecorderLabel}`}
                      title={`Switch recorder mode from ${currentRecorderLabel}`}
                      disabled={!canSwitchRecorderModes}
                    >
                      <NextRecorderIcon className="h-3 w-3" />
                    </button>
                    <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-background/95 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
                      {currentRecorderLabel}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
