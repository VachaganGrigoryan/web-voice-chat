import type { MediaKind, MessageType } from '@/api/types';

export type PresentedMessageKind =
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'file'
  | 'call'
  | 'unknown';

export const getPresentedMessageKind = (
  type: MessageType,
  mediaKind?: MediaKind | null
): PresentedMessageKind => {
  if (type === 'text') {
    return 'text';
  }

  if (type === 'call') {
    return 'call';
  }

  if (type === 'file' || mediaKind === 'file') {
    return 'file';
  }

  if (type !== 'media') {
    return 'unknown';
  }

  switch (mediaKind) {
    case 'voice':
    case 'audio':
      return 'audio';
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    default:
      return 'unknown';
  }
};

export const getMessageTypeLabel = (
  type: MessageType,
  mediaKind?: MediaKind | null
) => {
  if (type === 'text') {
    return 'Message';
  }

  if (type === 'call') {
    return 'Call';
  }

  if (type === 'file' || mediaKind === 'file') {
    return 'File';
  }

  switch (mediaKind) {
    case 'voice':
      return 'Voice message';
    case 'audio':
      return 'Audio';
    case 'image':
      return 'Photo';
    case 'video':
      return 'Video';
    default:
      return 'Message';
  }
};
