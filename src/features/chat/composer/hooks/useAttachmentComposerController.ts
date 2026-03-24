import { useEffect, useRef, useState } from 'react';
import type { SendMediaInput } from '@/hooks/useChat';
import {
  AttachmentMode,
  AttachmentUploadKind,
  getAttachmentMessageType,
  validateAttachmentFile,
} from '@/utils/fileUtils';
import { ComposerReplyTarget } from '../../types/message';

type PendingMediaStatus = 'pending' | 'uploading' | 'failed';
const MAX_MEDIA_ITEMS = 10;

export interface PendingMediaItem {
  id: string;
  file: File;
  type: AttachmentUploadKind;
  previewUrl?: string;
  progress: number;
  status: PendingMediaStatus;
  error?: string;
  abortController?: AbortController;
}

interface UseAttachmentComposerControllerParams {
  receiverId: string;
  onSendMedia: (data: SendMediaInput) => Promise<unknown>;
  replyTarget?: ComposerReplyTarget | null;
  onClearReplyTarget?: () => void;
}

const createItemId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createBatchId = () => `media-batch-${createItemId()}`;

export function useAttachmentComposerController({
  receiverId,
  onSendMedia,
  replyTarget,
  onClearReplyTarget,
}: UseAttachmentComposerControllerParams) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<PendingMediaItem[]>([]);
  const [items, setItems] = useState<PendingMediaItem[]>([]);
  const [attachMode, setAttachMode] = useState<AttachmentMode>('media');
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
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (items.length === 0 && !isBatchUploading) {
      setCaptionText('');
      setHasSentCaption(false);
    }
  }, [items.length, isBatchUploading]);

  const revokePreviewUrl = (previewUrl?: string) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const dismissBatchDialog = () => {
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

  const openPickerForMode = (mode: AttachmentMode) => {
    setAttachMode(mode);
    if (mode === 'media') {
      mediaInputRef.current?.click();
      return;
    }

    fileInputRef.current?.click();
  };

  const handleInputFiles = (files: File[], mode: AttachmentMode) => {
    if (!files.length) {
      return;
    }

    setAttachMode(mode);
    const nextSelections: Array<{
      file: File;
      type: AttachmentUploadKind;
      previewUrl?: string;
    }> = [];
    const errors: string[] = [];

    files.forEach((file) => {
      const validationError = validateAttachmentFile(file, mode);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
        return;
      }

      const type = getAttachmentMessageType(file, mode);
      if (!type) {
        errors.push(
          `${file.name}: ${
            mode === 'media'
              ? 'only images and videos can be attached here'
              : 'unsupported file'
          }`
        );
        return;
      }

      nextSelections.push({
        file,
        type,
        previewUrl:
          type === 'image' || type === 'video' ? URL.createObjectURL(file) : undefined,
      });
    });

    const availableSlots = Math.max(0, MAX_MEDIA_ITEMS - itemsRef.current.length);
    if (availableSlots <= 0 && nextSelections.length > 0) {
      errors.push(`You can attach up to ${MAX_MEDIA_ITEMS} media files in one send flow.`);
    }

    const acceptedSelections = nextSelections.slice(0, availableSlots);
    if (nextSelections.length > acceptedSelections.length) {
      errors.push(
        `Only ${MAX_MEDIA_ITEMS} media files can be sent at once. ${
          nextSelections.length - acceptedSelections.length
        } file(s) were not added.`
      );
    }

    const nextItems: PendingMediaItem[] = acceptedSelections.map(
      ({ file, type, previewUrl }) => ({
        id: createItemId(),
        file,
        type,
        previewUrl,
        progress: 0,
        status: 'pending',
      })
    );

    if (nextItems.length > 0) {
      commitItems((current) => [...current, ...nextItems]);
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }
  };

  const handleSendBatch = async () => {
    const queuedItems = itemsRef.current.filter(
      (item) => item.status === 'pending' || item.status === 'failed'
    );
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

        const attachCaptionToThisItem =
          !captionAttached && currentItem.id === captionTargetId;
        const basePayload = {
          receiver_id: receiverId,
          file: currentItem.file,
          text: attachCaptionToThisItem ? trimmedCaption : undefined,
          reply_mode: capturedReplyTarget?.mode,
          reply_to_message_id: capturedReplyTarget?.messageId,
          client_batch_id: batchId,
          signal: abortController.signal,
          onUploadProgress: (progress: number) => {
            updateItem(currentItem.id, (item) => ({
              ...item,
              progress,
            }));
          },
        };

        try {
          const payload: SendMediaInput =
            currentItem.type === 'file'
              ? {
                  type: 'file' as const,
                  ...basePayload,
                }
              : {
                  type: 'media' as const,
                  media_kind: currentItem.type,
                  ...basePayload,
                };

          await onSendMedia(payload);

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
          const cancelled =
            error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
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

  return {
    items,
    attachMode,
    setAttachMode,
    captionText,
    setCaptionText,
    isBatchUploading,
    hasSentCaption,
    mediaInputRef,
    fileInputRef,
    isBatchDialogOpen: items.length > 0,
    canAddMore: items.length < MAX_MEDIA_ITEMS,
    dismissBatchDialog,
    removeItem,
    openPickerForMode,
    onMediaInputChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      handleInputFiles(Array.from(event.target.files || []), 'media');
      event.target.value = '';
    },
    onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      handleInputFiles(Array.from(event.target.files || []), 'file');
      event.target.value = '';
    },
    handleSendBatch,
  };
}
