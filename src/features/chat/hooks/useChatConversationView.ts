import { useMemo } from 'react';
import { MessageDoc } from '@/api/types';
import { AudioMessage, ChatMessage, ImageMessage } from '../types/message';
import { parseMessages } from '../utils/messageParser';
import { buildChatRenderItems } from '../utils/mediaGroupUtils';

interface MessagesPageData<T> {
  pages?: Array<{
    data?: T[];
  }>;
}

interface UseChatConversationViewParams {
  messages: MessagesPageData<MessageDoc> | undefined;
  threadMessagesPages: MessagesPageData<MessageDoc> | undefined;
  userId?: string | null;
  selectedUser: string | null;
  selectedThreadRootId: string | null;
}

const byCreatedAtAscending = (left: ChatMessage, right: ChatMessage) =>
  new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

const getAudioMediaKind = (message: AudioMessage): 'voice' | 'audio' =>
  message.media?.kind === 'audio' ? 'audio' : 'voice';

export function useChatConversationView({
  messages,
  threadMessagesPages,
  userId,
  selectedUser,
  selectedThreadRootId,
}: UseChatConversationViewParams) {
  const allMessages = useMemo(
    () => messages?.pages?.flatMap((page) => page.data || []).filter(Boolean) || [],
    [messages]
  );

  const chatMessages = useMemo(
    () => parseMessages(allMessages, userId),
    [allMessages, userId]
  );

  const mainChatMessages = useMemo(
    () => chatMessages.filter((message) => message.replyMode !== 'thread'),
    [chatMessages]
  );

  const mainChatRenderItems = useMemo(
    () => buildChatRenderItems(mainChatMessages),
    [mainChatMessages]
  );

  const selectedThreadRootMessage = useMemo(
    () => chatMessages.find((message) => message.id === selectedThreadRootId) || null,
    [chatMessages, selectedThreadRootId]
  );

  const allThreadMessages = useMemo(
    () => threadMessagesPages?.pages?.flatMap((page) => page.data || []).filter(Boolean) || [],
    [threadMessagesPages]
  );

  const threadMessages = useMemo(
    () => parseMessages(allThreadMessages, userId),
    [allThreadMessages, userId]
  );

  const orderedThreadMessages = useMemo(
    () => [...threadMessages].sort(byCreatedAtAscending),
    [threadMessages]
  );

  const threadReplyMessages = useMemo(
    () => orderedThreadMessages.filter((message) => message.id !== selectedThreadRootMessage?.id),
    [orderedThreadMessages, selectedThreadRootMessage?.id]
  );

  const threadRenderItems = useMemo(
    () => buildChatRenderItems(threadReplyMessages),
    [threadReplyMessages]
  );

  const mainAudioQueueKey = selectedUser ? `main:${selectedUser}` : null;
  const mainAudioQueue = useMemo(
    () =>
      mainChatMessages
        .filter((message): message is AudioMessage => message.kind === 'audio')
        .reverse()
        .map((message) => ({
          id: message.id,
          src: message.audioUrl,
          mediaKind: getAudioMediaKind(message),
          title:
            getAudioMediaKind(message) === 'audio'
              ? message.fileName || 'Audio file'
              : 'Voice message',
          durationMs: message.durationSec ? message.durationSec * 1000 : 0,
          createdAt: message.createdAt,
          isRead: message.status === 'read',
          isMe: message.isOwn,
        })),
    [mainChatMessages]
  );

  const threadAudioQueueKey = selectedThreadRootId ? `thread:${selectedThreadRootId}` : null;
  const threadAudioQueue = useMemo(() => {
    if (!selectedThreadRootMessage) {
      return [];
    }

    return [selectedThreadRootMessage, ...orderedThreadMessages]
      .filter((message): message is AudioMessage => message.kind === 'audio')
      .sort(byCreatedAtAscending)
      .map((message) => ({
        id: message.id,
        src: message.audioUrl,
        mediaKind: getAudioMediaKind(message),
        title:
          getAudioMediaKind(message) === 'audio'
            ? message.fileName || 'Audio file'
            : 'Voice message',
        durationMs: message.durationSec ? message.durationSec * 1000 : 0,
        createdAt: message.createdAt,
        isRead: message.status === 'read',
        isMe: message.isOwn,
      }));
  }, [orderedThreadMessages, selectedThreadRootId, selectedThreadRootMessage]);

  const mainImageGallery = useMemo(
    () =>
      [...mainChatMessages]
        .reverse()
        .filter((message): message is ImageMessage => message.kind === 'image' && !!message.imageUrl)
        .map((message) => ({
          id: message.id,
          url: message.imageUrl,
          downloadName: message.fileName,
        })),
    [mainChatMessages]
  );

  const threadImageGallery = useMemo(
    () =>
      [selectedThreadRootMessage, ...orderedThreadMessages]
        .filter((message): message is ImageMessage => !!message && message.kind === 'image' && !!message.imageUrl)
        .sort(byCreatedAtAscending)
        .map((message) => ({
          id: message.id,
          url: message.imageUrl,
          downloadName: message.fileName,
        })),
    [orderedThreadMessages, selectedThreadRootMessage]
  );

  return {
    mainChatMessages,
    mainChatRenderItems,
    selectedThreadRootMessage,
    threadReplyMessages,
    threadRenderItems,
    mainAudioQueueKey,
    mainAudioQueue,
    threadAudioQueueKey,
    threadAudioQueue,
    mainImageGallery,
    threadImageGallery,
  };
}
