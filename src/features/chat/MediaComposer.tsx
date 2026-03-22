import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ImagePlus, Loader2, Paperclip, Send, Video, X } from 'lucide-react';
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
import { getMessageType, validateFile } from '@/utils/fileUtils';
import { ComposerReplyTarget } from './types/message';

type MediaUploadType = 'image' | 'video';
type PendingMediaStatus = 'pending' | 'uploading' | 'failed';
const MAX_MEDIA_ITEMS = 10;

interface PendingMediaItem {
  id: string;
  file: File;
  type: MediaUploadType;
  previewUrl: string;
  progress: number;
  status: PendingMediaStatus;
  error?: string;
  abortController?: AbortController;
}

interface MediaComposerProps {
  receiverId: string;
  onSendMedia: (data: {
    type: 'voice' | 'image' | 'sticker' | 'video' | 'file';
    receiver_id: string;
    file: File;
    text?: string;
    duration_ms?: number;
    reply_mode?: ComposerReplyTarget['mode'] | null;
    reply_to_message_id?: string;
    client_batch_id?: string;
    signal?: AbortSignal;
    onUploadProgress?: (progress: number) => void;
  }) => Promise<any>;
  isUploading: boolean;
  replyTarget?: ComposerReplyTarget | null;
  onClearReplyTarget?: () => void;
}

const createItemId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createBatchId = () => `media-batch-${createItemId()}`;

export default function MediaComposer({
  receiverId,
  onSendMedia,
  isUploading,
  replyTarget,
  onClearReplyTarget,
}: MediaComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<PendingMediaItem[]>([]);
  const [items, setItems] = useState<PendingMediaItem[]>([]);
  const [captionText, setCaptionText] = useState('');
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [hasSentCaption, setHasSentCaption] = useState(false);

  const commitItems = (
    updater: PendingMediaItem[] | ((current: PendingMediaItem[]) => PendingMediaItem[])
  ) => {
    const next = typeof updater === 'function' ? updater(itemsRef.current) : updater;
    itemsRef.current = next;
    setItems(next);
  };

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        item.abortController?.abort();
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (items.length === 0 && !isBatchUploading) {
      setCaptionText('');
      setHasSentCaption(false);
    }
  }, [items.length, isBatchUploading]);

  const revokePreviewUrl = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
  };

  const dismissModal = () => {
    if (isBatchUploading) {
      return;
    }

    itemsRef.current.forEach((item) => {
      item.abortController?.abort();
      revokePreviewUrl(item.previewUrl);
    });
    commitItems([]);
  };

  const removeItem = (itemId: string) => {
    commitItems((current) => {
      const item = current.find((entry) => entry.id === itemId);
      item?.abortController?.abort();
      if (item) {
        revokePreviewUrl(item.previewUrl);
      }
      return current.filter((entry) => entry.id !== itemId);
    });
  };

  const updateItem = (itemId: string, updater: (item: PendingMediaItem) => PendingMediaItem) => {
    commitItems((current) =>
      current.map((item) => (item.id === itemId ? updater(item) : item))
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    const nextSelections: Array<{ file: File; type: MediaUploadType }> = [];
    const errors: string[] = [];

    files.forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
        return;
      }

      const type = getMessageType(file);
      if (type !== 'image' && type !== 'video') {
        errors.push(`${file.name}: only images and videos can be attached here`);
        return;
      }

      nextSelections.push({
        file,
        type,
      });
    });

    const availableSlots = Math.max(0, MAX_MEDIA_ITEMS - itemsRef.current.length);
    if (availableSlots <= 0 && nextSelections.length > 0) {
      errors.push(`You can attach up to ${MAX_MEDIA_ITEMS} media files in one send flow.`);
    }

    const acceptedSelections = nextSelections.slice(0, availableSlots);
    if (nextSelections.length > acceptedSelections.length) {
      errors.push(
        `Only ${MAX_MEDIA_ITEMS} media files can be sent at once. ${nextSelections.length - acceptedSelections.length} file(s) were not added.`
      );
    }

    const nextItems: PendingMediaItem[] = acceptedSelections.map(({ file, type }) => ({
        id: createItemId(),
        file,
        type,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: 'pending',
      }));

    if (nextItems.length > 0) {
      commitItems((current) => [...current, ...nextItems]);
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    event.target.value = '';
  };

  const handleSendBatch = async () => {
    const queuedItems = itemsRef.current.filter((item) => item.status === 'pending' || item.status === 'failed');
    if (!queuedItems.length || isBatchUploading) {
      return;
    }

    const trimmedCaption = captionText.trim();
    const shouldAttachCaption = !hasSentCaption && trimmedCaption.length > 0;
    const captionTargetId = shouldAttachCaption ? queuedItems[0]?.id : null;
    const batchId = createBatchId();
    const capturedReplyTarget = replyTarget;
    let sentAny = false;
    let captionAttached = false;

    setIsBatchUploading(true);

    try {
      for (const queuedItem of queuedItems) {
        const currentItem = itemsRef.current.find((item) => item.id === queuedItem.id);
        if (!currentItem) {
          continue;
        }

        const abortController = new AbortController();
        updateItem(currentItem.id, (item) => ({
          ...item,
          status: 'uploading',
          progress: 0,
          error: undefined,
          abortController,
        }));

        const attachCaptionToThisItem = !captionAttached && currentItem.id === captionTargetId;

        try {
          await onSendMedia({
            type: currentItem.type,
            receiver_id: receiverId,
            file: currentItem.file,
            text: attachCaptionToThisItem ? trimmedCaption : undefined,
            reply_mode: capturedReplyTarget?.mode,
            reply_to_message_id: capturedReplyTarget?.messageId,
            client_batch_id: batchId,
            signal: abortController.signal,
            onUploadProgress: (progress) => {
              updateItem(currentItem.id, (item) => ({
                ...item,
                progress,
              }));
            },
          });

          sentAny = true;
          if (attachCaptionToThisItem) {
            captionAttached = true;
            setHasSentCaption(true);
            setCaptionText('');
          }

          commitItems((current) => {
            const item = current.find((entry) => entry.id === currentItem.id);
            if (item) {
              revokePreviewUrl(item.previewUrl);
            }
            return current.filter((entry) => entry.id !== currentItem.id);
          });
        } catch (error: any) {
          const cancelled = error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
          if (cancelled) {
            commitItems((current) => {
              const item = current.find((entry) => entry.id === currentItem.id);
              if (item) {
                revokePreviewUrl(item.previewUrl);
              }
              return current.filter((entry) => entry.id !== currentItem.id);
            });
            continue;
          }

          updateItem(currentItem.id, (item) => ({
            ...item,
            status: 'failed',
            progress: 0,
            abortController: undefined,
            error: 'Upload failed',
          }));
        }
      }
    } finally {
      setIsBatchUploading(false);
      if (sentAny && itemsRef.current.length === 0) {
        setHasSentCaption(false);
        onClearReplyTarget?.();
      }
    }
  };

  const canSend = items.some((item) => item.status === 'pending' || item.status === 'failed');
  const isModalOpen = items.length > 0;
  const canAddMore = items.length < MAX_MEDIA_ITEMS;
  const sendButtonLabel = items.length === 1 ? 'Send media' : `Send ${items.length} items`;
  const captionHelpText =
    items.length <= 1
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
  const batchMetaLabel = `${items.length}/${MAX_MEDIA_ITEMS} selected`;
  const batchContextLabel = replyTarget
    ? `Sending as ${replyTarget.mode === 'thread' ? 'thread reply' : 'reply'}`
    : 'Sending as one media batch';

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-10 w-10 rounded-full shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading || isBatchUploading}
        title={replyTarget ? `Attach media as ${replyTarget.mode === 'thread' ? 'thread reply' : 'reply'}` : 'Attach media'}
      >
        {isBatchUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
        {replyTarget ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" /> : null}
      </Button>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*"
        multiple
      />

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            dismissModal();
          }
        }}
      >
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
                  <DialogTitle className="text-sm font-semibold sm:text-base">Send media</DialogTitle>
                  <DialogDescription className="mt-1 text-xs text-muted-foreground">
                    Preview the batch, add a caption, then send it as one flow.
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs sm:text-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBatchUploading || !canAddMore}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {canAddMore ? 'Add more' : 'Max reached'}
                  </Button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 sm:h-9 sm:w-9"
                    onClick={dismissModal}
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
                  <div className="mt-1 text-xs text-muted-foreground">{replyTarget.senderLabel}</div>
                  <div className="truncate text-sm text-foreground">{replyTarget.previewText}</div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden bg-muted/10">
              <div className="scrollbar-hidden h-full overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
                <div className="rounded-[18px] border border-border/60 bg-muted/20 p-2 sm:rounded-[22px] sm:p-3 md:p-4">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-foreground">
                      {items.length === 1 ? 'Selected item' : `${items.length} selected items`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      The preview stays scrollable while the caption and send controls remain fixed.
                    </div>
                  </div>

                  <div className={cn('grid gap-2 sm:gap-2.5', previewGridClassName)}>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="overflow-hidden rounded-[18px] border border-border/60 bg-background/80"
                      >
                        <div className={cn('relative overflow-hidden bg-muted', previewAspectClass)}>
                          {item.type === 'image' ? (
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
                            onClick={() => removeItem(item.id)}
                            aria-label={item.status === 'uploading' ? 'Cancel upload' : 'Remove selected media'}
                            title={item.status === 'uploading' ? 'Cancel upload' : 'Remove'}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="space-y-1.5 px-2.5 py-2 sm:px-3 sm:py-2.5">
                          <div className="truncate text-[11px] font-medium text-foreground sm:text-xs">{item.file.name}</div>
                          <div className="space-y-1">
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-[width] duration-200',
                                  item.status === 'failed' ? 'bg-destructive' : 'bg-primary'
                                )}
                                style={{ width: `${item.status === 'failed' ? 100 : item.progress}%` }}
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
                                <span>{item.status === 'pending' ? 'Ready' : `${item.progress}%`}</span>
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
                onChange={(event) => setCaptionText(event.target.value)}
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
                    onClick={dismissModal}
                    disabled={isBatchUploading}
                  >
                    Discard
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full px-4 sm:px-5"
                    onClick={() => void handleSendBatch()}
                    disabled={!canSend || isUploading || isBatchUploading}
                  >
                    {isBatchUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {sendButtonLabel}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}
