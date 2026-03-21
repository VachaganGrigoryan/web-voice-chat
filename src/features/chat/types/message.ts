import { MediaMeta, MessageDoc, MessageReactionGroup, ReplyMode, ReplyPreview } from '@/api/types';

export type MessageKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'system'
  | 'emoji'
  | 'sticker'
  | 'unknown';

export type MessageStatus = MessageDoc['status'] | 'sending' | 'failed';

export interface BaseMessage {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  updatedAt?: string;
  editedAt?: string;
  deletedAt?: string;
  deliveredAt?: string;
  readAt?: string;
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
  lastThreadReplyAt?: string;
  reactions: MessageReactionGroup[];
}

export interface TextMessage extends BaseMessage {
  kind: 'text';
  text: string;
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
  durationSec?: number;
  waveform?: number[];
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
  | AudioMessage
  | SystemMessage
  | EmojiMessage
  | StickerMessage
  | UnknownMessage;

export interface ComposerReplyTarget {
  messageId: string;
  mode: 'quote' | 'thread';
  previewText: string;
  senderLabel: string;
}
