import React from 'react';
import { cn } from '@/lib/utils';
import { ChatMessage } from '../types/message';
import { getMessageTypeLabel } from '../utils/messagePresentation';

interface MessageReplyPreviewProps {
  message: ChatMessage;
}

const shouldRenderReplyPreview = (message: ChatMessage) => {
  if (!message.replyPreview) {
    return false;
  }

  if (message.replyMode === 'quote') {
    return true;
  }

  return (
    message.replyMode === 'thread' &&
    !!message.threadRootId &&
    message.replyPreview.message_id !== message.threadRootId
  );
};

const getReplyText = (message: ChatMessage) => {
  const preview = message.replyPreview;
  if (!preview || !shouldRenderReplyPreview(message)) return null;
  if (preview.is_deleted) return 'Deleted message';

  const trimmed = preview.text?.trim();
  if (trimmed) return trimmed;

  return getMessageTypeLabel(preview.type, preview.media_kind);
};

export function MessageReplyPreview({ message }: MessageReplyPreviewProps) {
  if (!shouldRenderReplyPreview(message)) {
    return null;
  }

  const previewText = getReplyText(message);
  const senderLabel = message.replyPreviewIsOwn ? 'You' : 'Contact';

  return (
    <div
      className={cn(
        'mx-2 mt-2 rounded-xl border-l-2 px-3 py-2',
        message.isOwn
          ? 'border-primary-foreground/70 bg-primary-foreground/10 text-primary-foreground/90'
          : 'border-primary/70 bg-background/70 text-foreground'
      )}
    >
      <div
        className={cn(
          'text-[11px] font-semibold tracking-wide',
          message.isOwn ? 'text-primary-foreground/80' : 'text-primary'
        )}
      >
        {senderLabel}
      </div>
      <div
        className={cn(
          'line-clamp-2 text-xs leading-4',
          message.isOwn ? 'text-primary-foreground/75' : 'text-muted-foreground'
        )}
      >
        {previewText}
      </div>
    </div>
  );
}
