import type { ChannelInboxRow, Conversation } from '@/api/types';
import { getCallDirectionFromMeta, getCallSummaryText } from '../../utils/callPresentation';
import { getPresentedMessageKind } from '../../utils/messagePresentation';
import { formatMessageDay, formatMessageTime, isSameLocalDay } from '@/utils/dateUtils';

/** Icon kinds a preview can resolve to; the row component owns the icon mapping. */
export type PreviewIconKind =
  | 'audio'
  | 'voice'
  | 'file'
  | 'poll'
  | 'location'
  | 'contact'
  | 'link'
  | 'image'
  | 'video';

export type RowPreview = { kind: 'text'; text: string } | { kind: 'icon'; icon: PreviewIconKind; label: string };

// The column is 20rem wide, so a 20-character cap clipped almost every preview
// mid-word. CSS `truncate` handles the real overflow; this only bounds the string.
export function shortenMessageText(text: string | null | undefined, limit = 48): string {
  if (!text) return 'Click to chat';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > limit ? cleaned.slice(0, limit) + '…' : cleaned;
}

export function formatConversationTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return isSameLocalDay(value, new Date()) ? formatMessageTime(value) : formatMessageDay(value);
}

export function getConversationLabel(conversation: Conversation): string {
  if (conversation.type === 'group') {
    return conversation.title || 'Group chat';
  }

  const peer = conversation.peer_user;
  if (!peer) {
    return 'Conversation';
  }

  if (peer.is_ghost) {
    return 'Ghost chat';
  }

  return peer.display_name || peer.username || peer.id;
}

export function resolveConversationPreview(
  conversation: Pick<Conversation, 'last_message' | 'peer_user'>,
  currentUserId: string | null
): RowPreview {
  const lastMessage = conversation.last_message;
  if (!lastMessage) {
    return {
      kind: 'text',
      text: conversation.peer_user?.is_ghost ? 'Send a ping to reconnect' : 'Click to chat',
    };
  }

  if (lastMessage.type === 'call' && lastMessage.call) {
    return {
      kind: 'text',
      text: getCallSummaryText({
        direction: getCallDirectionFromMeta(lastMessage.call, currentUserId),
        type: lastMessage.call.type,
        status: lastMessage.call.status,
        durationMs: lastMessage.call.duration_ms,
      }),
    };
  }

  if (lastMessage.type === 'system') {
    return { kind: 'text', text: shortenMessageText(lastMessage.text) };
  }

  const trimmedText = lastMessage.text?.trim();

  switch (getPresentedMessageKind(lastMessage.type, lastMessage.media?.kind)) {
    case 'audio':
      return lastMessage.media?.kind === 'audio'
        ? { kind: 'icon', icon: 'audio', label: 'Audio' }
        : { kind: 'icon', icon: 'voice', label: 'Voice message' };
    case 'file':
      return { kind: 'icon', icon: 'file', label: 'File' };
    case 'poll':
      return trimmedText ? { kind: 'text', text: trimmedText } : { kind: 'icon', icon: 'poll', label: 'Poll' };
    case 'location':
      return trimmedText
        ? { kind: 'text', text: trimmedText }
        : { kind: 'icon', icon: 'location', label: 'Location' };
    case 'contact':
      return trimmedText ? { kind: 'text', text: trimmedText } : { kind: 'icon', icon: 'contact', label: 'Contact' };
    case 'link':
      return trimmedText ? { kind: 'text', text: trimmedText } : { kind: 'icon', icon: 'link', label: 'Link' };
    case 'image':
      return trimmedText ? { kind: 'text', text: trimmedText } : { kind: 'icon', icon: 'image', label: 'Photo' };
    case 'video':
      return trimmedText ? { kind: 'text', text: trimmedText } : { kind: 'icon', icon: 'video', label: 'Video' };
    default:
      return { kind: 'text', text: shortenMessageText(lastMessage.text) };
  }
}

export function isChannelRowMuted(row: Pick<ChannelInboxRow, 'state'>): boolean {
  return (
    row.state.notification_level === 'none' ||
    (!!row.state.muted_until && new Date(row.state.muted_until).getTime() > Date.now())
  );
}
