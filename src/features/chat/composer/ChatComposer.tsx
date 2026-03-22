import React, { useEffect, useRef, useState } from 'react';
import { FILE_ATTACH_ACCEPT, MEDIA_ATTACH_ACCEPT } from '@/utils/fileUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import { MOBILE_BREAKPOINT } from '../utils/chatLayoutUtils';
import VideoRecorderModal from '../media/recorders/VideoRecorderModal';
import { useComposerTextInput } from './hooks/useComposerTextInput';
import { useAudioRecorderController } from './hooks/useAudioRecorderController';
import { useAttachmentComposerController } from './hooks/useAttachmentComposerController';
import { ComposerAttachmentBatchDialog } from './components/ComposerAttachmentBatchDialog';
import { ComposerAudioPreview } from './components/ComposerAudioPreview';
import { ComposerAttachmentPanel } from './components/ComposerAttachmentPanel';
import { ComposerEmojiPanel } from './components/ComposerEmojiPanel';
import { ComposerInputRow } from './components/ComposerInputRow';
import { ComposerRecordingState } from './components/ComposerRecordingState';
import { ComposerReplyBar } from './components/ComposerReplyBar';
import { ChatComposerProps, ComposerPanel } from './types';

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
        {activePanel === 'emoji' ? (
          <ComposerEmojiPanel
            isMobileViewport={isMobileViewport}
            contextLabel={contextLabel}
            onSelectEmoji={textInput.appendText}
          />
        ) : (
          <ComposerAttachmentPanel
            attachMode={attachmentComposer.attachMode}
            onAttachModeChange={attachmentComposer.setAttachMode}
            onPickAttachments={handlePickAttachments}
            isBusy={isBusy}
          />
        )}
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
              {activePanel === 'emoji' ? (
                <ComposerEmojiPanel
                  isMobileViewport={isMobileViewport}
                  contextLabel={contextLabel}
                  onSelectEmoji={textInput.appendText}
                />
              ) : (
                <ComposerAttachmentPanel
                  attachMode={attachmentComposer.attachMode}
                  onAttachModeChange={attachmentComposer.setAttachMode}
                  onPickAttachments={handlePickAttachments}
                  isBusy={isBusy}
                />
              )}
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
            <ComposerRecordingState
              isRecordingPaused={audioRecorder.isRecordingPaused}
              durationSec={audioRecorder.durationSec}
              onPauseOrResume={
                audioRecorder.isRecordingPaused
                  ? () => void audioRecorder.resumeAudioRecording()
                  : () => void audioRecorder.pauseAudioRecording()
              }
              onStop={() => void audioRecorder.stopAudioRecording()}
            />
          ) : audioRecorder.audioUrl ? (
            <ComposerAudioPreview
              audioUrl={audioRecorder.audioUrl}
              audioRef={audioRecorder.audioRef}
              isPlayingPreview={audioRecorder.isPlayingPreview}
              previewProgress={audioRecorder.previewProgress}
              durationSec={audioRecorder.durationSec}
              isBusy={isBusy}
              isSendingAudio={audioRecorder.isSendingAudio || isUploading}
              onCancel={() => void audioRecorder.cancelAudioRecording()}
              onTogglePlayback={audioRecorder.togglePreviewPlayback}
              onSend={() => void audioRecorder.sendRecordedAudio()}
              onSetProgress={audioRecorder.setPreviewProgress}
              onSetPlaying={audioRecorder.setIsPlayingPreview}
            />
          ) : (
            <ComposerInputRow
              activePanel={activePanel}
              isBusy={isBusy}
              hasText={textInput.hasText}
              text={textInput.text}
              textareaRef={textInput.textareaRef}
              recorderMode={audioRecorder.recorderMode}
              canSwitchRecorderModes={canSwitchRecorderModes}
              currentRecorderLabel={currentRecorderLabel}
              onTogglePanel={handleTogglePanel}
              onTextChange={textInput.handleTextChange}
              onTextareaFocus={() => textInput.setIsFocused(true)}
              onTextareaBlur={() => {
                window.setTimeout(() => textInput.setIsFocused(false), 120);
              }}
              onTextareaEnter={() => {
                void handleSendText();
              }}
              onRecorderPressStart={handleRecorderPressStart}
              onRecorderPressEnd={handleRecorderPressEnd}
              onRecorderClick={handleRecorderClick}
              onToggleRecorderMode={() => {
                if (!canSwitchRecorderModes) return;
                audioRecorder.setRecorderMode((current) =>
                  current === 'audio' ? 'video' : 'audio'
                );
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
