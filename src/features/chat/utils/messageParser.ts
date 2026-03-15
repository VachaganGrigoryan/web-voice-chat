import { MessageDoc } from '@/api/types';
import {
  AudioMessage,
  ChatMessage,
  ImageMessage,
  MessageStatus,
  StickerMessage,
  TextMessage,
  VideoMessage,
} from '../types/message';

function createBaseMessage(doc: MessageDoc, currentUserId?: string | null) {
  return {
    id: doc.id,
    chatId: doc.conversation_id,
    senderId: doc.sender_id,
    receiverId: doc.receiver_id,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at || undefined,
    editedAt: doc.edited_at || undefined,
    deliveredAt: doc.delivered_at || undefined,
    readAt: doc.read_at || undefined,
    status: doc.status as MessageStatus,
    isOwn: !!currentUserId && doc.sender_id === currentUserId,
  };
}

export function parseMessage(doc: MessageDoc, currentUserId?: string | null): ChatMessage {
  const base = createBaseMessage(doc, currentUserId);

  switch (doc.type) {
    case 'text':
      return {
        ...base,
        kind: 'text',
        text: doc.text || '',
      } satisfies TextMessage;
    case 'image':
      return {
        ...base,
        kind: 'image',
        imageUrl: doc.media?.url || '',
        media: doc.media || undefined,
        fileName: doc.media?.key?.split('/').pop(),
        caption: doc.text || undefined,
      } satisfies ImageMessage;
    case 'video':
      return {
        ...base,
        kind: 'video',
        videoUrl: doc.media?.url || '',
        media: doc.media || undefined,
        fileName: doc.media?.key?.split('/').pop(),
        caption: doc.text || undefined,
      } satisfies VideoMessage;
    case 'voice':
      return {
        ...base,
        kind: 'audio',
        audioUrl: doc.media?.url || '',
        media: doc.media || undefined,
        durationSec: doc.media?.duration_ms ? doc.media.duration_ms / 1000 : undefined,
      } satisfies AudioMessage;
    case 'emoji':
      return {
        ...base,
        kind: 'emoji',
        text: doc.text || '',
      };
    case 'sticker':
      return {
        ...base,
        kind: 'sticker',
        stickerUrl: doc.media?.url || '',
        media: doc.media || undefined,
      } satisfies StickerMessage;
    default:
      return {
        ...base,
        kind: 'unknown',
        originalType: doc.type,
        text: doc.text || undefined,
        media: doc.media || undefined,
      };
  }
}

export function parseMessages(messages: MessageDoc[], currentUserId?: string | null): ChatMessage[] {
  return messages.map((message) => parseMessage(message, currentUserId));
}
