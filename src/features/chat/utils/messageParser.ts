import { MessageDoc } from '@/api/types';
import { resolveMessageContent } from '@/api/messageContent';
import {
  AudioMessage,
  CallMessage,
  ChatMessage,
  ContactMessage,
  FileMessage,
  ImageMessage,
  LinkPreviewMessage,
  LocationMessage,
  MessageStatus,
  PollMessage,
  StickerMessage,
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
    attachments: doc.content?.attachments ?? [],
    clientBatchId: doc.client_batch_id || undefined,
  };
}

function readString(value: Record<string, unknown> | null, key: string): string | undefined {
  const candidate = value?.[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate : undefined;
}

function readNumber(value: Record<string, unknown> | null, key: string): number | undefined {
  const candidate = value?.[key];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined;
}

export function parseMessage(doc: MessageDoc, currentUserId?: string | null): ChatMessage {
  const base = createBaseMessage(doc, currentUserId);
  // Read the displayable body through the single decrypt/normalize boundary so
  // bubbles never touch `content`/flat fields directly (E2EE-ready).
  const { text, media, call, attachments, poll, pollRef, sticker, location, contact, linkPreview } =
    resolveMessageContent(doc);
  const contentType = doc.content?.type ?? doc.type;
  const primaryAttachment = attachments[0] ?? media;
  const presentedKind = getPresentedMessageKind(contentType, primaryAttachment?.kind);

  if (contentType === 'poll') {
    return {
      ...base,
      kind: 'poll',
      pollId: pollRef?.poll_id ?? '',
      question: pollRef?.question || readString(poll, 'question') || text || 'Poll',
    } satisfies PollMessage;
  }

  if (contentType === 'sticker') {
    return {
      ...base,
      kind: 'sticker',
      stickerUrl: readString(sticker, 'url') || primaryAttachment?.url || '',
      media: primaryAttachment || undefined,
      emoji: readString(sticker, 'emoji'),
      label: readString(sticker, 'label'),
    } satisfies StickerMessage;
  }

  if (contentType === 'location') {
    return {
      ...base,
      kind: 'location',
      latitude: readNumber(location, 'latitude') ?? 0,
      longitude: readNumber(location, 'longitude') ?? 0,
      name: readString(location, 'name'),
      address: readString(location, 'address'),
    } satisfies LocationMessage;
  }

  if (contentType === 'contact') {
    return {
      ...base,
      kind: 'contact',
      displayName: readString(contact, 'display_name') || 'Contact',
      userId: readString(contact, 'user_id'),
      phone: readString(contact, 'phone'),
      email: readString(contact, 'email'),
    } satisfies ContactMessage;
  }

  if (contentType === 'link_preview') {
    return {
      ...base,
      kind: 'link_preview',
      url: readString(linkPreview, 'url') || text || '#',
      title: readString(linkPreview, 'title'),
      description: readString(linkPreview, 'description'),
      imageUrl: readString(linkPreview, 'image_url'),
    } satisfies LinkPreviewMessage;
  }

  if (attachments.length > 1) {
    return {
      ...base,
      kind: 'attachments',
      text: text || undefined,
    };
  }

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
        imageUrl: primaryAttachment?.url || '',
        media: primaryAttachment || undefined,
        fileName: primaryAttachment?.key?.split('/').pop(),
        caption: text || undefined,
      } satisfies ImageMessage;
    case 'video':
      return {
        ...base,
        kind: 'video',
        videoUrl: primaryAttachment?.url || '',
        media: primaryAttachment || undefined,
        fileName: primaryAttachment?.key?.split('/').pop(),
        caption: text || undefined,
      } satisfies VideoMessage;
    case 'audio':
      return {
        ...base,
        kind: 'audio',
        audioUrl: primaryAttachment?.url || '',
        media: primaryAttachment || undefined,
        fileName: primaryAttachment?.key?.split('/').pop(),
        durationSec: primaryAttachment?.duration_ms ? primaryAttachment.duration_ms / 1000 : undefined,
        caption: text || undefined,
      } satisfies AudioMessage;
    case 'file':
      return {
        ...base,
        kind: 'file',
        fileUrl: primaryAttachment?.url || '',
        media: primaryAttachment || undefined,
        fileName: primaryAttachment?.key?.split('/').pop(),
        fileSizeBytes: primaryAttachment?.size_bytes,
        mimeType: primaryAttachment?.mime,
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
        originalType: primaryAttachment?.kind ? `${contentType}:${primaryAttachment.kind}` : contentType,
        text: text || undefined,
        media: primaryAttachment || undefined,
      };
  }
}

export function parseMessages(messages: MessageDoc[], currentUserId?: string | null): ChatMessage[] {
  return messages.map((message) => parseMessage(message, currentUserId));
}
