import React from 'react';
import { AlertCircle, FileText, ImagePlus, Loader2, Send, Video, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { AttachmentMode } from '@/utils/fileUtils';
import { ComposerReplyTarget } from '../../types/message';
import { PendingMediaItem } from '../hooks/useAttachmentComposerController';

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

interface ComposerAttachmentBatchDialogProps {
  open: boolean;
  items: PendingMediaItem[];
  attachMode: AttachmentMode;
  captionText: string;
  onCaptionTextChange: (value: string) => void;
  isBatchUploading: boolean;
  hasSentCaption: boolean;
  replyTarget?: ComposerReplyTarget | null;
  onDismiss: () => void;
  onRemoveItem: (itemId: string) => void;
  onSendBatch: () => void;
  onAddMore: () => void;
  canAddMore: boolean;
}

export function ComposerAttachmentBatchDialog({
  open,
  items,
  attachMode,
  captionText,
  onCaptionTextChange,
  isBatchUploading,
  hasSentCaption,
  replyTarget,
  onDismiss,
  onRemoveItem,
  onSendBatch,
  onAddMore,
  canAddMore,
}: ComposerAttachmentBatchDialogProps) {
  const isFileBatch = attachMode === 'file';
  const sendButtonLabel = isFileBatch
    ? items.length === 1
      ? 'Send file'
      : `Send ${items.length} files`
    : items.length === 1
    ? 'Send media'
    : `Send ${items.length} items`;
  const captionHelpText = isFileBatch
    ? items.length <= 1
      ? 'This text will be sent with the file message.'
      : 'This text will be attached only to the first file in the batch.'
    : items.length <= 1
    ? 'This text will be sent as the caption for this media.'
    : hasSentCaption
    ? 'The batch caption is already attached to the first sent item.'
    : 'This text will be attached only to the first media item and shown above the collage.';
  const previewGridClassName =
    items.length <= 1
      ? 'grid-cols-1'
      : items.length === 2
      ? 'grid-cols-2'
      : items.length <= 4
      ? 'grid-cols-2'
      : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4';
  const previewAspectClass =
    items.length === 1
      ? 'aspect-[16/11] sm:aspect-[16/10]'
      : items.length <= 4
      ? 'aspect-[4/4.5] sm:aspect-square'
      : 'aspect-square';
  const batchMetaLabel = `${items.length}/10 selected`;
  const batchContextLabel = replyTarget
    ? `Sending as ${replyTarget.mode === 'thread' ? 'thread reply' : 'reply'}`
    : `Sending as one ${isFileBatch ? 'file' : 'media'} batch`;
  const activeModeMetaLabel = attachMode === 'media' ? 'Media mode' : 'File mode';
  const canSend = items.some((item) => item.status === 'pending' || item.status === 'failed');

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onDismiss()}>
      <DialogPortal>
        <DialogOverlay className="bg-background/45 backdrop-blur-md" />
        <DialogContent
          className="z-[60] [&>button]:hidden fixed inset-0 left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 p-0 shadow-none lg:left-[50%] lg:top-[50%] lg:h-[min(86vh,52rem)] lg:w-[min(60rem,calc(100vw-10rem))] lg:max-w-[60rem] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[28px] lg:border lg:border-border/70 lg:shadow-2xl xl:w-[min(64rem,calc(100vw-16rem))] xl:max-w-[64rem]"
          onPointerDownOutside={(event) => {
            if (isBatchUploading) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (isBatchUploading) {
              event.preventDefault();
            }
          }}
        >
          <div className="shrink-0 border-b border-border/60 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold sm:text-base">
                  {isFileBatch ? 'Send files' : 'Send media'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-muted-foreground">
                  {isFileBatch
                    ? 'Review the selected files, add an optional message, then send.'
                    : 'Preview the batch, add a caption, then send it as one flow.'}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs sm:text-sm"
                  onClick={onAddMore}
                  disabled={isBatchUploading || !canAddMore}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {canAddMore ? 'Add more' : 'Max reached'}
                </Button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 sm:h-9 sm:w-9"
                  onClick={onDismiss}
                  disabled={isBatchUploading}
                  aria-label="Close media composer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
                {batchMetaLabel}
              </span>
              <span className="rounded-full bg-muted/60 px-2.5 py-1">
                {activeModeMetaLabel}
              </span>
              <span className="rounded-full bg-muted/60 px-2.5 py-1">
                {batchContextLabel}
              </span>
              {hasSentCaption ? (
                <span className="rounded-full bg-muted/60 px-2.5 py-1">
                  Caption already attached
                </span>
              ) : null}
            </div>

            {replyTarget ? (
              <div className="mt-3 rounded-2xl border border-border/60 bg-muted/25 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {replyTarget.mode === 'thread' ? 'Thread Reply' : 'Reply'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {replyTarget.senderLabel}
                </div>
                <div className="truncate text-sm text-foreground">
                  {replyTarget.previewText}
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-muted/10">
            <div className="scrollbar-hidden h-full overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
              <div className="rounded-[18px] border border-border/60 bg-muted/20 p-2 sm:rounded-[22px] sm:p-3 md:p-4">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-foreground">
                    {isFileBatch
                      ? items.length === 1
                        ? 'Selected file'
                        : `${items.length} selected files`
                      : items.length === 1
                      ? 'Selected item'
                      : `${items.length} selected items`}
                  </div>
                <div className="text-xs text-muted-foreground">
                  {isFileBatch
                    ? 'Files stay in a compact list while the message and send controls remain fixed.'
                    : 'The preview stays scrollable while the caption and send controls remain fixed.'}
                </div>
              </div>

                <div
                  className={cn(
                    isFileBatch ? 'space-y-2' : 'grid gap-2 sm:gap-2.5',
                    !isFileBatch && previewGridClassName
                  )}
                >
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-[18px] border border-border/60 bg-background/80"
                    >
                      <div
                        className={cn(
                          'relative overflow-hidden bg-muted',
                          isFileBatch ? 'flex items-center gap-3 px-4 py-3' : previewAspectClass
                        )}
                      >
                        {isFileBatch ? (
                          <div className="flex min-w-0 flex-1 items-center gap-3 pr-8">
                            <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {item.file.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatFileSize(item.file.size)}
                                {item.file.type ? ` • ${item.file.type}` : ''}
                              </div>
                            </div>
                          </div>
                        ) : item.type === 'image' ? (
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <>
                            <video
                              src={item.previewUrl}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <div className="rounded-full bg-black/55 p-2 text-white">
                                <Video className="h-4 w-4" />
                              </div>
                            </div>
                          </>
                        )}
                          <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                            {item.type}
                          </div>
                          <button
                            type="button"
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70 sm:h-8 sm:w-8"
                            onClick={() => onRemoveItem(item.id)}
                            aria-label={
                              item.status === 'uploading'
                                ? 'Cancel upload'
                                : 'Remove selected media'
                            }
                            title={item.status === 'uploading' ? 'Cancel upload' : 'Remove'}
                          >
                            <X className="h-4 w-4" />
                          </button>
                      </div>

                      <div className="space-y-1.5 px-2.5 py-2 sm:px-3 sm:py-2.5">
                        {isFileBatch ? null : (
                          <div className="truncate text-[11px] font-medium text-foreground sm:text-xs">
                            {item.file.name}
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full transition-[width] duration-200',
                                item.status === 'failed'
                                  ? 'bg-destructive'
                                  : 'bg-primary'
                              )}
                              style={{
                                width: `${item.status === 'failed' ? 100 : item.progress}%`,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground sm:text-[11px]">
                            <span className="capitalize">{item.status}</span>
                            {item.status === 'failed' ? (
                              <span className="flex items-center gap-1 text-destructive">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {item.error || 'Upload failed'}
                              </span>
                            ) : (
                              <span>
                                {item.status === 'pending'
                                  ? 'Ready'
                                  : `${item.progress}%`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-border/60 bg-background/96 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
            <div className="mb-2.5">
              <div className="text-sm font-semibold text-foreground">Caption</div>
              <div className="mt-1 text-xs text-muted-foreground">{captionHelpText}</div>
            </div>

            <textarea
              value={captionText}
              onChange={(event) => onCaptionTextChange(event.target.value)}
              placeholder={items.length <= 1 ? 'Add a caption...' : 'Add a batch caption...'}
              disabled={hasSentCaption}
              className="min-h-20 w-full resize-none rounded-2xl border border-border/70 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-24 sm:px-4 sm:py-3"
            />
          </div>

          <div className="shrink-0 border-t border-border/60 bg-background/96 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {replyTarget
                  ? `Will send as ${replyTarget.mode === 'thread' ? 'thread reply' : 'reply'}.`
                  : 'Will send as a media batch.'}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full sm:px-4"
                  onClick={onDismiss}
                  disabled={isBatchUploading}
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  className="rounded-full px-4 sm:px-5"
                  onClick={onSendBatch}
                  disabled={!canSend || isBatchUploading}
                >
                  {isBatchUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {sendButtonLabel}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
