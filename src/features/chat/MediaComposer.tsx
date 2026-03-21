import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Paperclip, Send, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getMessageType, validateFile } from '@/utils/fileUtils';
import { ComposerReplyTarget } from './types/message';

type MediaUploadType = 'image' | 'video';
type PendingMediaStatus = 'pending' | 'uploading' | 'failed';

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
  const [isBatchUploading, setIsBatchUploading] = useState(false);

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

  const revokePreviewUrl = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
  };

  const removeItem = (itemId: string) => {
    setItems((current) => {
      const item = current.find((entry) => entry.id === itemId);
      item?.abortController?.abort();
      if (item) {
        revokePreviewUrl(item.previewUrl);
      }
      return current.filter((entry) => entry.id !== itemId);
    });
  };

  const updateItem = (itemId: string, updater: (item: PendingMediaItem) => PendingMediaItem) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? updater(item) : item))
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    const nextItems: PendingMediaItem[] = [];
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

      nextItems.push({
        id: createItemId(),
        file,
        type,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: 'pending',
      });
    });

    if (nextItems.length > 0) {
      setItems((current) => [...current, ...nextItems]);
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

    setIsBatchUploading(true);
    const batchId = createBatchId();
    const capturedReplyTarget = replyTarget;
    let sentCount = 0;

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

        try {
          await onSendMedia({
            type: currentItem.type,
            receiver_id: receiverId,
            file: currentItem.file,
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

          sentCount += 1;
          setItems((current) => {
            const item = current.find((entry) => entry.id === currentItem.id);
            if (item) {
              revokePreviewUrl(item.previewUrl);
            }
            return current.filter((entry) => entry.id !== currentItem.id);
          });
        } catch (error: any) {
          const cancelled = error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
          if (cancelled) {
            setItems((current) => {
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
      if (sentCount > 0) {
        onClearReplyTarget?.();
      }
    }
  };

  const canSend = items.some((item) => item.status === 'pending' || item.status === 'failed');

  return (
    <div className="relative">
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
        {items.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {items.length}
          </span>
        ) : null}
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*"
        multiple
      />

      {items.length > 0 ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Selected media</div>
              <div className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? 'item' : 'items'} ready for upload
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3"
              onClick={() => {
                items.forEach((item) => {
                  item.abortController?.abort();
                  revokePreviewUrl(item.previewUrl);
                });
                setItems([]);
              }}
              disabled={isBatchUploading}
            >
              Clear
            </Button>
          </div>

          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-border/70 bg-muted/30"
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
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
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <div className="rounded-full bg-black/55 p-2 text-white">
                          <Video className="h-4 w-4" />
                        </div>
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70"
                    onClick={() => removeItem(item.id)}
                    aria-label={item.status === 'uploading' ? 'Cancel upload' : 'Remove selected media'}
                    title={item.status === 'uploading' ? 'Cancel upload' : 'Remove'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2 px-3 py-2">
                  <div className="truncate text-xs font-medium text-foreground">{item.file.name}</div>
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
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
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

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {replyTarget ? `Will send as ${replyTarget.mode === 'thread' ? 'thread reply' : 'reply'}` : 'Images and videos upload one by one'}
            </div>
            <Button
              size="sm"
              className="rounded-full px-4"
              onClick={() => void handleSendBatch()}
              disabled={!canSend || isUploading || isBatchUploading}
            >
              {isBatchUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
