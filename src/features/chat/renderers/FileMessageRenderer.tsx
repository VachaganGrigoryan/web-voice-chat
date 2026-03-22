import React from 'react';
import { Download, FileText } from 'lucide-react';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';
import { FileMessage } from '../types/message';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import { downloadFile } from '@/utils/download';

interface FileMessageRendererProps {
  message: FileMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  bubbleFooter?: React.ReactNode;
}

const formatBytes = (value?: number) => {
  if (!value || value <= 0) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export const FileMessageRenderer: React.FC<FileMessageRendererProps> = ({
  message,
  highlighted = false,
  groupedWithAbove = false,
  groupedWithBelow = false,
  bubbleFooter,
}) => {
  const sizeLabel = formatBytes(message.fileSizeBytes);
  const metaLabel = [message.mimeType, sizeLabel].filter(Boolean).join(' • ');

  return (
    <MessageBubble
      isOwn={message.isOwn}
      highlighted={highlighted}
      groupedWithAbove={groupedWithAbove}
      groupedWithBelow={groupedWithBelow}
      className="max-w-full min-w-0"
    >
      <MessageReplyPreview message={message} />
      <div className="px-2 pb-2 pt-2">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-3 text-left transition-colors hover:bg-accent/40"
          onClick={() => void downloadFile(message.fileUrl, message.fileName)}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {message.fileName || 'Attachment'}
            </div>
            {metaLabel ? (
              <div className="truncate text-xs text-muted-foreground">{metaLabel}</div>
            ) : null}
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Download className="h-4 w-4" />
          </div>
        </button>
      </div>
      {message.caption ? (
        <MessageContent className="px-3 pb-2 pt-0 text-sm">
          <MessageMarkdown text={message.caption} isOwn={message.isOwn} />
        </MessageContent>
      ) : null}
      {bubbleFooter}
    </MessageBubble>
  );
};
