import {
  CallDirection,
  CallMeta,
  MediaMeta,
  MessageDoc,
  MessageReactionGroup,
  ReplyMode,
  ReplyPreview,
} from '@/api/types';

export type MessageKind =
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'audio'
  | 'call'
  | 'system'
  | 'emoji'
  | 'sticker'
  | 'poll'
  | 'location'
  | 'contact'
  | 'link_preview'
  | 'attachments'
  | 'unknown';

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'sending' | 'failed';

export interface BaseMessage {
  id: string;
  /**
   * The source document, when the message came from one.
   *
   * Optional because a feed post is projected, not fetched as a `MessageDoc` —
   * making this required is what kept the actions menu chat-only. Nothing in
   * the renderer tree reads it; only the actions dialog's Details panel does,
   * and that degrades when it is absent.
   */
  raw?: MessageDoc;
  chatId: string;
  senderId: string;
  createdAt: string;
  updatedAt?: string;
  editedAt?: string;
  deletedAt?: string;
  kind: MessageKind;
  status: MessageStatus;
  isOwn: boolean;
  isDeleted: boolean;
  replyMode: ReplyMode | null;
  replyToMessageId?: string;
  threadRootId?: string;
  replyPreview?: ReplyPreview;
  replyPreviewIsOwn?: boolean;
  isThreadRoot: boolean;
  threadReplyCount: number;
  unreadThreadReplyCount: number;
  lastThreadReplyAt?: string;
  reactions: MessageReactionGroup[];
  attachments: MediaMeta[];
  clientBatchId?: string;
}

export interface TextMessage extends BaseMessage {
  kind: 'text';
  text: string;
  /**
   * Lifted off `raw` by the parser so the renderer needs no access to the
   * source document — that was the last `raw` read in the renderer tree, and
   * removing it is what lets a feed post use the same content component.
   */
  mentionCount: number;
  mentionScope?: 'here' | 'all' | null;
}

export interface ImageMessage extends BaseMessage {
  kind: 'image';
  imageUrl: string;
  media?: MediaMeta;
  fileName?: string;
  width?: number;
  height?: number;
  caption?: string;
}

export interface VideoMessage extends BaseMessage {
  kind: 'video';
  videoUrl: string;
  media?: MediaMeta;
  fileName?: string;
  thumbnailUrl?: string;
  caption?: string;
}

export interface AudioMessage extends BaseMessage {
  kind: 'audio';
  audioUrl: string;
  media?: MediaMeta;
  fileName?: string;
  durationSec?: number;
  waveform?: number[];
  caption?: string;
}

export interface FileMessage extends BaseMessage {
  kind: 'file';
  fileUrl: string;
  media?: MediaMeta;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  caption?: string;
}

export interface CallMessage extends BaseMessage {
  kind: 'call';
  call: CallMeta;
  callDirection: CallDirection;
}

export interface SystemMessage extends BaseMessage {
  kind: 'system';
  text: string;
  level?: 'info' | 'warning' | 'success';
}

export interface EmojiMessage extends BaseMessage {
  kind: 'emoji';
  text: string;
}

export interface StickerMessage extends BaseMessage {
  kind: 'sticker';
  stickerUrl: string;
  media?: MediaMeta;
  emoji?: string;
  label?: string;
}

export interface PollMessage extends BaseMessage {
  kind: 'poll';
  /** Links to the first-class poll entity; tallies are fetched via usePoll. */
  pollId: string;
  /** Denormalized question for immediate render / fallback. */
  question: string;
}

export interface LocationMessage extends BaseMessage {
  kind: 'location';
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactMessage extends BaseMessage {
  kind: 'contact';
  displayName: string;
  userId?: string;
  phone?: string;
  email?: string;
}

export interface LinkPreviewMessage extends BaseMessage {
  kind: 'link_preview';
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
}

export interface AttachmentStackMessage extends BaseMessage {
  kind: 'attachments';
  text?: string;
}

export interface UnknownMessage extends BaseMessage {
  kind: 'unknown';
  originalType: string;
  text?: string;
  media?: MediaMeta;
}

export type ChatMessage =
  | TextMessage
  | ImageMessage
  | VideoMessage
  | FileMessage
  | AudioMessage
  | CallMessage
  | SystemMessage
  | EmojiMessage
  | StickerMessage
  | PollMessage
  | LocationMessage
  | ContactMessage
  | LinkPreviewMessage
  | AttachmentStackMessage
  | UnknownMessage;

export interface ComposerReplyTarget {
  messageId: string;
  mode: 'quote' | 'thread';
  previewText: string;
  senderLabel: string;
}

export interface MediaClickPayload {
  type: 'image' | 'video';
  messageId: string;
  url: string;
  downloadName?: string;
}
