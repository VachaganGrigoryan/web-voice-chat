import { MessageDoc } from '@/api/types';
import { ChatMessage, MessageStatus } from '../types/message';

export function parseMessage(doc: MessageDoc, currentUserId: string): ChatMessage {
  const isOwn = doc.sender_id === currentUserId;
  const status: MessageStatus = doc.status as MessageStatus;

  const base = {
    id: doc.id,
    conversationId: doc.conversation_id,
    senderId: doc.sender_id,
    receiverId: doc.receiver_id,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at || undefined,
    editedAt: doc.edited_at || undefined,
    deliveredAt: doc.delivered_at || undefined,
    readAt: doc.read_at || undefined,
    status,
    isOwn,
  };

  switch (doc.type) {
    case 'text':
      return {
        ...base,
        kind: 'text',
        text: doc.text || '',
      };
    case 'image':
      return {
        ...base,
        kind: 'image',
        media: doc.media!,
        text: doc.text || undefined,
      };
    case 'video':
      return {
        ...base,
        kind: 'video',
        media: doc.media!,
        text: doc.text || undefined,
      };
    case 'voice':
      return {
        ...base,
        kind: 'audio',
        media: doc.media!,
      };
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
        media: doc.media!,
      };
    default:
      return {
        ...base,
        kind: 'unknown',
        originalType: doc.type,
      };
  }
}
