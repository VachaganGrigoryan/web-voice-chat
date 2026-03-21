import { isSameLocalDay } from '@/utils/dateUtils';
import { ChatMessage, ImageMessage, VideoMessage } from '../types/message';

export type MediaCollageMessage = ImageMessage | VideoMessage;

export interface SingleMessageRenderItem {
  id: string;
  type: 'single';
  isOwn: boolean;
  message: ChatMessage;
  messages: [ChatMessage];
  newestMessage: ChatMessage;
  oldestMessage: ChatMessage;
}

export interface MediaGroupRenderItem {
  id: string;
  type: 'media-group';
  isOwn: boolean;
  messages: MediaCollageMessage[];
  newestMessage: MediaCollageMessage;
  oldestMessage: MediaCollageMessage;
}

export type ChatRenderItem = SingleMessageRenderItem | MediaGroupRenderItem;

export const isMediaCollageMessage = (message: ChatMessage): message is MediaCollageMessage =>
  message.kind === 'image' || message.kind === 'video';

export const shouldGroupMessages = (current: ChatMessage, adjacent?: ChatMessage) => {
  if (!adjacent) return false;
  if (current.kind === 'system' || adjacent.kind === 'system') return false;
  if (current.senderId !== adjacent.senderId) return false;
  if (!isSameLocalDay(current.createdAt, adjacent.createdAt)) return false;

  const currentTime = new Date(current.createdAt).getTime();
  const adjacentTime = new Date(adjacent.createdAt).getTime();
  return Math.abs(currentTime - adjacentTime) <= 60 * 1000;
};

const isEligibleForMediaCollage = (message: ChatMessage): message is MediaCollageMessage =>
  isMediaCollageMessage(message) &&
  !message.isDeleted &&
  !message.caption &&
  !message.replyPreview &&
  !message.isThreadRoot &&
  message.threadReplyCount === 0 &&
  (message.reactions?.length ?? 0) === 0;

const shouldGroupMediaMessages = (
  current: MediaCollageMessage,
  adjacent: ChatMessage
): adjacent is MediaCollageMessage => {
  if (!isEligibleForMediaCollage(adjacent)) return false;
  if (current.senderId !== adjacent.senderId) return false;
  if (!isSameLocalDay(current.createdAt, adjacent.createdAt)) return false;

  if (current.clientBatchId && adjacent.clientBatchId) {
    return current.clientBatchId === adjacent.clientBatchId;
  }

  if (current.clientBatchId || adjacent.clientBatchId) {
    return false;
  }

  const currentTime = new Date(current.createdAt).getTime();
  const adjacentTime = new Date(adjacent.createdAt).getTime();
  return Math.abs(currentTime - adjacentTime) <= 60 * 1000;
};

export const buildChatRenderItems = (messages: ChatMessage[]): ChatRenderItem[] => {
  const renderItems: ChatRenderItem[] = [];
  let index = 0;

  while (index < messages.length) {
    const current = messages[index];

    if (!isEligibleForMediaCollage(current)) {
      renderItems.push({
        id: current.id,
        type: 'single',
        isOwn: current.isOwn,
        message: current,
        messages: [current],
        newestMessage: current,
        oldestMessage: current,
      });
      index += 1;
      continue;
    }

    const group: MediaCollageMessage[] = [current];
    let nextIndex = index + 1;

    while (nextIndex < messages.length) {
      const candidate = messages[nextIndex];
      if (!shouldGroupMediaMessages(group[group.length - 1], candidate)) {
        break;
      }

      group.push(candidate);
      nextIndex += 1;
    }

    if (group.length === 1) {
      renderItems.push({
        id: current.id,
        type: 'single',
        isOwn: current.isOwn,
        message: current,
        messages: [current],
        newestMessage: current,
        oldestMessage: current,
      });
    } else {
      renderItems.push({
        id: group.map((message) => message.id).join(':'),
        type: 'media-group',
        isOwn: current.isOwn,
        messages: group,
        newestMessage: group[0],
        oldestMessage: group[group.length - 1],
      });
    }

    index = nextIndex;
  }

  return renderItems;
};
