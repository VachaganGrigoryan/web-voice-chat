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
import { useComposerTextInput } from './hooks/useComposerTextInput';
import { useAttachmentComposerController } from './hooks/useAttachmentComposerController';
import { ComposerAttachmentBatchDialog } from './components/ComposerAttachmentBatchDialog';
import { ComposerAttachmentPanel } from './components/ComposerAttachmentPanel';
import { ComposerEmojiPanel } from './components/ComposerEmojiPanel';
import { ComposerInputRow } from './components/ComposerInputRow';
import { ComposerReplyBar } from './components/ComposerReplyBar';
import { ComposerRecorder } from './components/ComposerRecorder';
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

  const textInput = useComposerTextInput({
    receiverId,
    onSendText,
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
    if (attachmentComposer.isBatchDialogOpen) {
      setActivePanel(null);
    }
  }, [attachmentComposer.isBatchDialogOpen]);

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

  const isBusy =
    isUploading ||
    textInput.isSendingText ||
    attachmentComposer.isBatchUploading;
  const isEmojiPanel = activePanel === 'emoji';

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
            ? 'left-0 flex h-[28rem] w-[min(100%,26rem)] flex-col overflow-hidden'
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
          <DialogContent
            className={cn(
              'z-[60] [&>button]:hidden fixed inset-x-0 bottom-0 top-auto flex w-full translate-x-0 translate-y-0 flex-col overflow-hidden rounded-t-[28px] border-x-0 border-b-0 border-t border-border/70 bg-background/98 shadow-2xl',
              isEmojiPanel
                ? 'h-[75dvh] max-h-[75dvh] gap-0 px-3 pb-0 pt-3'
                : 'max-h-[75dvh] p-4'
            )}
          >
            <div className={cn('mx-auto h-1.5 w-12 rounded-full bg-border/80', isEmojiPanel ? 'mb-2' : 'mb-3')} />
            {isEmojiPanel ? (
              <>
                <DialogTitle className="sr-only">Emoji Panel</DialogTitle>
                <DialogDescription className="sr-only">
                  Choose emojis, GIFs, or stickers in the {contextLabel} composer.
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle className="text-sm font-semibold">
                  Attachments
                </DialogTitle>
                <DialogDescription className="mb-3 text-xs text-muted-foreground">
                  {`Choose how to attach media or files in ${contextLabel}.`}
                </DialogDescription>
              </>
            )}
            <div
              className={cn(
                'min-h-0 flex-1',
                isEmojiPanel
                  ? 'overflow-hidden pb-[env(safe-area-inset-bottom)]'
                  : 'overflow-y-auto pb-[env(safe-area-inset-bottom)]'
              )}
            >
              {isEmojiPanel ? (
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
          <ComposerRecorder
            audio
            video
            receiverId={receiverId}
            onSendMedia={onSendMedia}
            replyTarget={replyTarget}
            onClearReplyTarget={onClearReplyTarget}
            disabled={isBusy}
            onEngage={closePanels}
            renderIdleRow={(recorderTrigger) => (
              <ComposerInputRow
                activePanel={activePanel}
                isBusy={isBusy}
                hasText={textInput.hasText}
                text={textInput.text}
                textareaRef={textInput.textareaRef}
                recorderTrigger={recorderTrigger}
                onTogglePanel={handleTogglePanel}
                onTextChange={textInput.handleTextChange}
                onTextareaFocus={() => textInput.setIsFocused(true)}
                onTextareaBlur={() => {
                  window.setTimeout(() => textInput.setIsFocused(false), 120);
                }}
                onSend={() => {
                  void handleSendText();
                }}
              />
            )}
          />
        </div>
      </div>
    </>
  );
}
