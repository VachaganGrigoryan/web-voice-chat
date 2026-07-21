import { MessageDoc } from '@/api/types';
import { resolveMessageContent } from '@/api/messageContent';
import {
  AudioMessage,
  CallMessage,
  ChatMessage,
  FileMessage,
  ImageMessage,
  MessageStatus,
  TextMessage,
  VideoMessage,
} from '../types/message';
import { getCallDirectionFromMeta } from './callPresentation';
import { getPresentedMessageKind } from './messagePresentation';

function getReceiptStatus(doc: MessageDoc): MessageStatus {
  const summary = doc.receipt_summary;
  if (!summary || summary.recipient_count === 0) return 'sent';
  if (summary.read_count >= summary.recipient_count) return 'read';
  if (summary.delivered_count >= summary.recipient_count) return 'delivered';
  return 'sent';
}

function createBaseMessage(doc: MessageDoc, currentUserId?: string | null) {
  return {
    id: doc.id,
    raw: doc,
    chatId: doc.conversation_id,
    senderId: doc.sender_id,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at || undefined,
    editedAt: doc.edited_at || undefined,
    deletedAt: doc.deleted_at || undefined,
    status: getReceiptStatus(doc),
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
  // Read the displayable body through the single decrypt/normalize boundary so
  // bubbles never touch `content`/flat fields directly (E2EE-ready).
  const { text, media, call } = resolveMessageContent(doc);
  const presentedKind = getPresentedMessageKind(doc.type, media?.kind);

  switch (presentedKind) {
    case 'text':
      return {
        ...base,
        kind: 'text',
        text: text || '',
      } satisfies TextMessage;
    case 'image':
      return {
        ...base,
        kind: 'image',
        imageUrl: media?.url || '',
        media: media || undefined,
        fileName: media?.key?.split('/').pop(),
        caption: text || undefined,
      } satisfies ImageMessage;
    case 'video':
      return {
        ...base,
        kind: 'video',
        videoUrl: media?.url || '',
        media: media || undefined,
        fileName: media?.key?.split('/').pop(),
        caption: text || undefined,
      } satisfies VideoMessage;
    case 'audio':
      return {
        ...base,
        kind: 'audio',
        audioUrl: media?.url || '',
        media: media || undefined,
        fileName: media?.key?.split('/').pop(),
        durationSec: media?.duration_ms ? media.duration_ms / 1000 : undefined,
        caption: text || undefined,
      } satisfies AudioMessage;
    case 'file':
      return {
        ...base,
        kind: 'file',
        fileUrl: media?.url || '',
        media: media || undefined,
        fileName: media?.key?.split('/').pop(),
        fileSizeBytes: media?.size_bytes,
        mimeType: media?.mime,
        caption: text || undefined,
      } satisfies FileMessage;
    case 'call':
      if (!call) {
        return {
          ...base,
          kind: 'unknown',
          originalType: doc.type,
          text: text || undefined,
        };
      }

      return {
        ...base,
        kind: 'call',
        call,
        callDirection: getCallDirectionFromMeta(call, currentUserId),
      } satisfies CallMessage;
    default:
      return {
        ...base,
        kind: 'unknown',
        originalType: media?.kind ? `${doc.type}:${media.kind}` : doc.type,
        text: text || undefined,
        media: media || undefined,
      };
  }
}

export function parseMessages(messages: MessageDoc[], currentUserId?: string | null): ChatMessage[] {
  return messages.map((message) => parseMessage(message, currentUserId));
}
