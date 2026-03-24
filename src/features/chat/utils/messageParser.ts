import { MessageDoc } from '@/api/types';
import {
  AudioMessage,
  ChatMessage,
  FileMessage,
  ImageMessage,
  MessageStatus,
  TextMessage,
  VideoMessage,
} from '../types/message';
import { getPresentedMessageKind } from './messagePresentation';

function createBaseMessage(doc: MessageDoc, currentUserId?: string | null) {
  return {
    id: doc.id,
    chatId: doc.conversation_id,
    senderId: doc.sender_id,
    receiverId: doc.receiver_id,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at || undefined,
    editedAt: doc.edited_at || undefined,
    deletedAt: doc.deleted_at || undefined,
    deliveredAt: doc.delivered_at || undefined,
    readAt: doc.read_at || undefined,
    status: doc.status as MessageStatus,
    isOwn: !!currentUserId && doc.sender_id === currentUserId,
    isDeleted: !!doc.is_deleted,
    replyMode: doc.reply_mode,
    replyToMessageId: doc.reply_to_message_id || undefined,
    threadRootId: doc.thread_root_id || undefined,
    replyPreview: doc.reply_preview || undefined,
    replyPreviewIsOwn:
      currentUserId && doc.reply_preview
        ? doc.reply_preview.sender_id === currentUserId
        : undefined,
    isThreadRoot: doc.is_thread_root,
    threadReplyCount: doc.thread_reply_count,
    unreadThreadReplyCount: doc.thread_unread_count ?? 0,
    lastThreadReplyAt: doc.last_thread_reply_at || undefined,
    reactions: doc.reactions || [],
    clientBatchId: doc.client_batch_id || undefined,
  };
}

export function parseMessage(doc: MessageDoc, currentUserId?: string | null): ChatMessage {
  const base = createBaseMessage(doc, currentUserId);
  const presentedKind = getPresentedMessageKind(doc.type, doc.media?.kind);

  switch (presentedKind) {
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
    case 'audio':
      return {
        ...base,
        kind: 'audio',
        audioUrl: doc.media?.url || '',
        media: doc.media || undefined,
        durationSec: doc.media?.duration_ms ? doc.media.duration_ms / 1000 : undefined,
      } satisfies AudioMessage;
    case 'file':
      return {
        ...base,
        kind: 'file',
        fileUrl: doc.media?.url || '',
        media: doc.media || undefined,
        fileName: doc.media?.key?.split('/').pop(),
        fileSizeBytes: doc.media?.size_bytes,
        mimeType: doc.media?.mime,
        caption: doc.text || undefined,
      } satisfies FileMessage;
    default:
      return {
        ...base,
        kind: 'unknown',
        originalType: doc.media?.kind ? `${doc.type}:${doc.media.kind}` : doc.type,
        text: doc.text || undefined,
        media: doc.media || undefined,
      };
  }
}

export function parseMessages(messages: MessageDoc[], currentUserId?: string | null): ChatMessage[] {
  return messages.map((message) => parseMessage(message, currentUserId));
}
