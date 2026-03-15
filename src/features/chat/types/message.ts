import { MediaMeta } from '@/api/types';

export type MessageKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'system'
  | 'emoji'
  | 'sticker'
  | 'unknown';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface BaseMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  updatedAt?: string;
  editedAt?: string;
  deliveredAt?: string;
  readAt?: string;
  kind: MessageKind;
  status: MessageStatus;
  isOwn: boolean;
}

export interface TextMessage extends BaseMessage {
  kind: 'text';
  text: string;
}

export interface ImageMessage extends BaseMessage {
  kind: 'image';
  media: MediaMeta;
  text?: string;
}

export interface VideoMessage extends BaseMessage {
  kind: 'video';
  media: MediaMeta;
  text?: string;
}

export interface AudioMessage extends BaseMessage {
  kind: 'audio';
  media: MediaMeta;
}

export interface EmojiMessage extends BaseMessage {
  kind: 'emoji';
  text: string;
}

export interface StickerMessage extends BaseMessage {
  kind: 'sticker';
  media: MediaMeta;
}

export interface SystemMessage extends BaseMessage {
  kind: 'system';
  text: string;
  level?: 'info' | 'warning' | 'success';
}

export interface UnknownMessage extends BaseMessage {
  kind: 'unknown';
  originalType: string;
}

export type ChatMessage =
  | TextMessage
  | ImageMessage
  | VideoMessage
  | AudioMessage
  | EmojiMessage
  | StickerMessage
  | SystemMessage
  | UnknownMessage;
