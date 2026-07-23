import React from 'react';
import { Download, ExternalLink, FileText, Link2, MapPin, Paperclip, UserRound } from 'lucide-react';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageMarkdown } from '../components/MessageMarkdown';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import {
  AttachmentStackMessage,
  ContactMessage,
  LinkPreviewMessage,
  LocationMessage,
  UnknownMessage,
} from '../types/message';
import { downloadFile } from '@/utils/download';
import { MediaMeta } from '@/api/types';

type RichContentMessage =
  | LocationMessage
  | ContactMessage
  | LinkPreviewMessage
  | AttachmentStackMessage
  | UnknownMessage;

interface RichContentMessageRendererProps {
  message: RichContentMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  bubbleFooter?: React.ReactNode;
}

const fileNameFor = (media: MediaMeta) => media.key.split('/').pop() || 'Attachment';

const formatBytes = (value?: number) => {
  if (!value || value <= 0) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const AttachmentList: React.FC<{ attachments: MediaMeta[] }> = ({ attachments }) => {
  if (!attachments.length) return null;

  return (
    <div className="space-y-2 px-2 pb-2">
      {attachments.map((attachment, index) => {
        const name = fileNameFor(attachment);
        const meta = [attachment.mime, formatBytes(attachment.size_bytes)].filter(Boolean).join(' • ');

        return (
          <button
            key={`${attachment.key}-${index}`}
            type="button"
            className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-left transition-colors hover:bg-accent/40"
            onClick={() => void downloadFile(attachment.url, name)}
          >
            {attachment.kind === 'image' ? (
              <img
                src={attachment.url}
                alt=""
                className="h-11 w-11 shrink-0 rounded-md object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileText className="h-5 w-5" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{name}</span>
              {meta ? <span className="block truncate text-xs text-muted-foreground">{meta}</span> : null}
            </span>
            <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
};

export const RichContentMessageRenderer: React.FC<RichContentMessageRendererProps> = ({
  message,
  highlighted = false,
  groupedWithAbove = false,
  groupedWithBelow = false,
  bubbleFooter,
}) => {
  let body: React.ReactNode;

  switch (message.kind) {
    case 'location':
      body = (
        <MessageContent>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">{message.name || 'Location'}</div>
              {message.address ? <div className="text-sm text-current/70">{message.address}</div> : null}
              <a
                href={`https://maps.google.com/?q=${message.latitude},${message.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm underline underline-offset-2"
              >
                {message.latitude.toFixed(5)}, {message.longitude.toFixed(5)}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </MessageContent>
      );
      break;
    case 'contact':
      body = (
        <MessageContent>
          <div className="flex items-start gap-3">
            <UserRound className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">{message.displayName}</div>
              {message.phone ? <div className="text-sm text-current/70">{message.phone}</div> : null}
              {message.email ? <div className="truncate text-sm text-current/70">{message.email}</div> : null}
            </div>
          </div>
        </MessageContent>
      );
      break;
    case 'link_preview':
      body = (
        <MessageContent>
          <a href={message.url} target="_blank" rel="noreferrer" className="block min-w-0">
            {message.imageUrl ? (
              <img
                src={message.imageUrl}
                alt=""
                className="mb-2 max-h-36 w-full rounded-lg object-cover"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <span className="flex items-center gap-2 font-medium">
              <Link2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{message.title || message.url}</span>
            </span>
            {message.description ? (
              <span className="mt-1 block text-sm text-current/70">{message.description}</span>
            ) : null}
          </a>
        </MessageContent>
      );
      break;
    case 'attachments':
      body = (
        <>
          {message.text ? (
            <MessageContent>
              <MessageMarkdown text={message.text} isOwn={message.isOwn} />
            </MessageContent>
          ) : null}
          <AttachmentList attachments={message.attachments} />
        </>
      );
      break;
    default:
      body = (
        <MessageContent>
          <div className="flex items-start gap-3 text-sm">
            <Paperclip className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">Unsupported message</div>
              <div className="truncate text-current/65">{message.originalType}</div>
              {message.text ? <div className="mt-1 text-current/80">{message.text}</div> : null}
            </div>
          </div>
        </MessageContent>
      );
  }

  return (
    <MessageBubble
      isOwn={message.isOwn}
      highlighted={highlighted}
      groupedWithAbove={groupedWithAbove}
      groupedWithBelow={groupedWithBelow}
      className="max-w-full min-w-0"
    >
      <MessageReplyPreview message={message} />
      {body}
      {message.kind !== 'attachments' ? <AttachmentList attachments={message.attachments} /> : null}
      {bubbleFooter}
    </MessageBubble>
  );
};
