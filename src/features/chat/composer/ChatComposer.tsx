import React, { useEffect, useRef, useState } from 'react';
import { Link2, X } from 'lucide-react';
import { useCallStore } from '@/features/calls/callController';
import { FILE_ATTACH_ACCEPT, MEDIA_ATTACH_ACCEPT } from '@/utils/fileUtils';
import { cn } from '@/lib/utils';
import { MOBILE_BREAKPOINT } from '../utils/chatLayoutUtils';
import { useComposerTextInput } from './hooks/useComposerTextInput';
import { useAttachmentComposerController } from './hooks/useAttachmentComposerController';
import { ComposerAttachmentBatchDialog } from './components/ComposerAttachmentBatchDialog';
import { ComposerAttachmentPanel } from './components/ComposerAttachmentPanel';
import { ComposerEmojiPanel } from './components/ComposerEmojiPanel';
import { ComposerInputRow } from './components/ComposerInputRow';
import { ComposerReplyBar } from './components/ComposerReplyBar';
import {
  ComposerContactDialog,
  ComposerLocationDialog,
} from './components/ComposerRichContentDialogs';
import { ComposerRecorder } from './components/ComposerRecorder';
import { BuiltInBotSheet } from '../builtInBots/BuiltInBotSheet';
import { PollBotComposer, type PollComposerValues } from '../builtInBots/PollBotComposer';
import { BUILT_IN_BOTS, findBuiltInBotByCommand } from '../builtInBots/registry';
import type { BuiltInBotId } from '../builtInBots/types';
import { ChatComposerProps, ComposerPanel } from './types';

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/i;
const TRAILING_URL_PUNCTUATION = /[),.;!?]+$/;

const extractFirstUrl = (value: string) => {
  const match = value.match(URL_PATTERN);
  return match ? match[0].replace(TRAILING_URL_PUNCTUATION, '') : null;
};

const getUrlHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export default function ChatComposer({
  receiverId,
  onSendText,
  onSendMedia,
  onSendRichContent,
  onCreatePoll,
  contacts = [],
  replyTarget,
  onClearReplyTarget,
  isUploading = false,
  contextLabel = 'chat',
  enableDraft = false,
}: ChatComposerProps) {
  const [activePanel, setActivePanel] = useState<ComposerPanel>(null);
  const [activeBotId, setActiveBotId] = useState<BuiltInBotId | null>(null);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [dismissedLinkPreviewUrl, setDismissedLinkPreviewUrl] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  const callPhase = useCallStore((state) => state.phase);
  const desktopPanelRef = useRef<HTMLDivElement | null>(null);
  const composerShellRef = useRef<HTMLDivElement | null>(null);

  const textInput = useComposerTextInput({
    receiverId,
    onSendText,
    onClearReplyTarget,
    enableDraft,
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
    if ((!activePanel && !activeBotId) || isMobileViewport) {
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
      setActiveBotId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePanel(null);
        setActiveBotId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [activePanel, activeBotId, isMobileViewport]);

  const closePanels = () => setActivePanel(null);

  const handleTogglePanel = (panel: Exclude<ComposerPanel, null>) => {
    textInput.blurTextarea();
    setActiveBotId(null);
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const closeBot = () => {
    setActiveBotId(null);
    window.setTimeout(() => textInput.focusTextarea(), 0);
  };

  const handlePickAttachments = (mode: 'media' | 'file') => {
    attachmentComposer.openPickerForMode(mode);
    closePanels();
  };

  const openLocationDialog = () => {
    closePanels();
    setActiveBotId(null);
    setIsLocationDialogOpen(true);
  };

  const openPollBot = () => {
    closePanels();
    setActiveBotId('poll');
  };

  const openContactDialog = () => {
    closePanels();
    setActiveBotId(null);
    setIsContactDialogOpen(true);
  };

  const handleSendText = async () => {
    const trimmedText = textInput.text.trim();
    const previewUrl = extractFirstUrl(trimmedText);
    if (previewUrl && previewUrl !== dismissedLinkPreviewUrl) {
      textInput.stopTyping();
      await onSendRichContent({
        conversation_id: receiverId,
        type: 'link_preview',
        text: trimmedText,
        link_preview: {
          url: previewUrl,
          title: getUrlHost(previewUrl),
        },
      });
      textInput.clearTextAfterSend();
      setDismissedLinkPreviewUrl(null);
      closePanels();
      return;
    }

    const sent = await textInput.handleSendText();
    if (sent) {
      closePanels();
      setDismissedLinkPreviewUrl(null);
    }
  };

  const handleTextChange = (value: string) => {
    const command = value.trim();
    const bot = findBuiltInBotByCommand(command);
    if (bot && value.length === command.length) {
      closePanels();
      setActiveBotId(bot.id);
      textInput.setText('');
      return;
    }

    const nextPreviewUrl = extractFirstUrl(value);
    if (nextPreviewUrl !== dismissedLinkPreviewUrl) {
      setDismissedLinkPreviewUrl(null);
    }
    textInput.handleTextChange(value);
  };

  const handleSendPoll = async (values: PollComposerValues) => {
    await onCreatePoll({ conversation_id: receiverId, ...values });
    setActiveBotId(null);
    onClearReplyTarget?.();
  };

  const handleSendLocation = async (location: Parameters<typeof onSendRichContent>[0]['location']) => {
    if (!location) return;
    await onSendRichContent({
      conversation_id: receiverId,
      type: 'location',
      location,
    });
    onClearReplyTarget?.();
  };

  const handleSendContact = async (contact: Parameters<typeof onSendRichContent>[0]['contact']) => {
    if (!contact) return;
    await onSendRichContent({
      conversation_id: receiverId,
      type: 'contact',
      contact,
    });
    onClearReplyTarget?.();
  };

  const isBusy =
    isUploading ||
    textInput.isSendingText ||
    attachmentComposer.isBatchUploading;
  const isCallActive = callPhase !== 'idle';
  const isEmojiPanel = activePanel === 'emoji';
  const isAttachmentsPanel = activePanel === 'attachments';
  const isMobileEmojiPanelOpen = isMobileViewport && isEmojiPanel;
  const isMobileAttachmentPanelOpen = isMobileViewport && isAttachmentsPanel;
  const activeBot = BUILT_IN_BOTS.find((bot) => bot.id === activeBotId) ?? null;
  const isBotSheetOpen = !!activeBot;
  const isMobileBotSheetOpen = isMobileViewport && isBotSheetOpen;
  const isMobileDockedPanelOpen = isMobileEmojiPanelOpen || isMobileAttachmentPanelOpen || isMobileBotSheetOpen;
  const linkPreviewUrl = extractFirstUrl(textInput.text);
  const activeLinkPreviewUrl =
    linkPreviewUrl && linkPreviewUrl !== dismissedLinkPreviewUrl ? linkPreviewUrl : null;

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
            isMobileViewport={isMobileViewport}
            attachMode={attachmentComposer.attachMode}
            onAttachModeChange={attachmentComposer.setAttachMode}
            onPickAttachments={handlePickAttachments}
            onOpenLocation={openLocationDialog}
            onOpenContact={openContactDialog}
            onOpenPoll={openPollBot}
            isBusy={isBusy}
          />
        )}
      </div>
    );
  };

  const renderMobileAttachmentPanel = () => {
    if (!isMobileViewport) {
      return null;
    }

    return (
      <div
        className={cn(
          'overflow-hidden transition-[max-height,opacity] duration-200 ease-out',
          isMobileAttachmentPanelOpen
            ? 'max-h-[min(40dvh,19rem)] opacity-100'
            : 'pointer-events-none max-h-0 opacity-0'
        )}
      >
        <div className="h-[min(40dvh,19rem)] overflow-hidden rounded-b-[28px] border border-border/70 border-t-0 bg-background/98">
          <div className="flex h-full min-h-0 flex-col px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
            <ComposerAttachmentPanel
              isMobileViewport={isMobileViewport}
              attachMode={attachmentComposer.attachMode}
              onAttachModeChange={attachmentComposer.setAttachMode}
              onPickAttachments={handlePickAttachments}
              onOpenLocation={openLocationDialog}
              onOpenContact={openContactDialog}
              onOpenPoll={openPollBot}
              isBusy={isBusy}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderMobileEmojiPanel = () => {
    if (!isMobileViewport) {
      return null;
    }

    return (
      <div
        className={cn(
          'overflow-hidden transition-[max-height,opacity] duration-200 ease-out',
          isMobileEmojiPanelOpen
            ? 'max-h-[min(40dvh,19rem)] opacity-100'
            : 'pointer-events-none max-h-0 opacity-0'
        )}
      >
        <div className="h-[min(40dvh,19rem)] overflow-hidden rounded-b-[28px] border border-border/70 border-t-0 bg-background/98">
          <div className="flex h-full min-h-0 flex-col px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
            <ComposerEmojiPanel
              isMobileViewport={isMobileViewport}
              contextLabel={contextLabel}
              onSelectEmoji={textInput.appendText}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderBuiltInBotSheet = () => {
    if (!activeBot) {
      return null;
    }

    return (
      <BuiltInBotSheet
        bot={activeBot}
        isMobileViewport={isMobileViewport}
        onClose={closeBot}
      >
        {activeBot.id === 'poll' ? (
          <PollBotComposer
            isSending={isBusy}
            onSubmit={handleSendPoll}
            onCancel={closeBot}
          />
        ) : null}
      </BuiltInBotSheet>
    );
  };

  const renderPendingLinkPreview = () => {
    if (!activeLinkPreviewUrl || activeBot) {
      return null;
    }

    return (
      <div className="mx-1 mb-2 flex min-w-0 items-start gap-3 rounded-2xl border border-border/70 bg-muted/25 px-3 py-2.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Link2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {getUrlHost(activeLinkPreviewUrl)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {activeLinkPreviewUrl}
          </span>
        </span>
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => setDismissedLinkPreviewUrl(activeLinkPreviewUrl)}
          aria-label="Dismiss link preview"
        >
          <X className="h-4 w-4" />
        </button>
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
      <ComposerLocationDialog
        open={isLocationDialogOpen}
        isSending={isBusy}
        onOpenChange={setIsLocationDialogOpen}
        onSend={handleSendLocation}
      />
      <ComposerContactDialog
        open={isContactDialogOpen}
        contacts={contacts}
        isSending={isBusy}
        onOpenChange={setIsContactDialogOpen}
        onSend={handleSendContact}
      />

      <div
        className={cn(
          'w-full bg-background/90 pt-3 backdrop-blur-md',
          isMobileDockedPanelOpen
            ? 'pb-0'
            : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
        )}
      >
        <ComposerReplyBar
          replyTarget={replyTarget}
          onClear={onClearReplyTarget}
        />

        <div ref={composerShellRef} className="relative">
          {renderDesktopPanel()}
          {renderBuiltInBotSheet()}
          {renderPendingLinkPreview()}
          <ComposerRecorder
            audio
            video
            receiverId={receiverId}
            onSendMedia={onSendMedia}
            replyTarget={replyTarget}
            onClearReplyTarget={onClearReplyTarget}
            disabled={isBusy || isCallActive}
            onEngage={() => {
              closePanels();
              setActiveBotId(null);
            }}
            renderIdleRow={(recorderTrigger) => (
              <ComposerInputRow
                activePanel={activePanel}
                isBusy={isBusy}
                hasText={textInput.hasText}
                text={textInput.text}
                textareaRef={textInput.textareaRef}
                isPanelDocked={isMobileDockedPanelOpen}
                recorderTrigger={recorderTrigger}
                onTogglePanel={handleTogglePanel}
                onTextChange={handleTextChange}
                onTextareaFocus={() => {
                  if (isMobileDockedPanelOpen) {
                    closePanels();
                    setActiveBotId(null);
                  }
                  textInput.setIsFocused(true);
                }}
                onTextareaBlur={() => {
                  window.setTimeout(() => textInput.setIsFocused(false), 120);
                }}
                onSend={() => {
                  void handleSendText();
                }}
              />
            )}
          />
          {renderMobileEmojiPanel()}
          {renderMobileAttachmentPanel()}
        </div>
      </div>
    </>
  );
}
