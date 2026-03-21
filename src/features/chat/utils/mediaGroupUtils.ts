import { isSameLocalDay } from '@/utils/dateUtils';
import { ChatMessage, ImageMessage, VideoMessage } from '../types/message';

export type MediaCollageMessage = ImageMessage | VideoMessage;

export interface SingleMessageRenderItem {
  id: string;
  type: 'single';
  isOwn: boolean;
  message: ChatMessage;
  messages: [ChatMessage];
  firstMessage: ChatMessage;
  lastMessage: ChatMessage;
  earliestMessage: ChatMessage;
  latestMessage: ChatMessage;
}

export interface MediaGroupRenderItem {
  id: string;
  type: 'media-group';
  isOwn: boolean;
  messages: MediaCollageMessage[];
  firstMessage: MediaCollageMessage;
  lastMessage: MediaCollageMessage;
  earliestMessage: MediaCollageMessage;
  latestMessage: MediaCollageMessage;
  caption?: string;
  captionMessageId?: string;
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

const getMessageTime = (message: ChatMessage) => new Date(message.createdAt).getTime();

const getEarliestMessage = <T extends ChatMessage>(messages: T[]) =>
  messages.reduce((earliest, message) =>
    getMessageTime(message) < getMessageTime(earliest) ? message : earliest
  );

const getLatestMessage = <T extends ChatMessage>(messages: T[]) =>
  messages.reduce((latest, message) =>
    getMessageTime(message) > getMessageTime(latest) ? message : latest
  );

const getGroupCaptionMeta = (messages: MediaCollageMessage[]) => {
  const captionMessages = messages.filter((message) => !!message.caption?.trim());
  if (captionMessages.length !== 1) {
    return { caption: undefined, captionMessageId: undefined };
  }

  const captionMessage = captionMessages[0];
  return {
    caption: captionMessage.caption?.trim(),
    captionMessageId: captionMessage.id,
  };
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
        firstMessage: current,
        lastMessage: current,
        earliestMessage: current,
        latestMessage: current,
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
        firstMessage: current,
        lastMessage: current,
        earliestMessage: current,
        latestMessage: current,
      });
    } else {
      const { caption, captionMessageId } = getGroupCaptionMeta(group);
      renderItems.push({
        id: group.map((message) => message.id).join(':'),
        type: 'media-group',
        isOwn: current.isOwn,
        messages: group,
        firstMessage: group[0],
        lastMessage: group[group.length - 1],
        earliestMessage: getEarliestMessage(group),
        latestMessage: getLatestMessage(group),
        caption,
        captionMessageId,
      });
    }

    index = nextIndex;
  }

  return renderItems;
};
