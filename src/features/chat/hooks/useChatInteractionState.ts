import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { SendMediaInput, SendTextInput } from '@/hooks/useChat';
import { ConversationMenuState } from '../components/ConversationActionsMenu';
import { MessageMenuAnchor } from '../components/MessageShell';
import { getCallSummaryText } from '../utils/callPresentation';
import {
  ChatMessage,
  ComposerReplyTarget,
  MediaClickPayload,
} from '../types/message';

type ActiveMessageSurface = 'main' | 'thread';

type MediaViewerImageItem = {
  id: string;
  url: string;
  downloadName?: string;
};

export type MediaViewerState =
  | {
      open: false;
      type: 'image' | 'video';
      url: '';
      items: MediaViewerImageItem[];
      initialItemId: null;
      downloadName?: string;
    }
  | {
      open: true;
      type: 'image';
      url: '';
      items: MediaViewerImageItem[];
      initialItemId: string;
      downloadName?: string;
    }
  | {
      open: true;
      type: 'video';
      url: string;
      items: [];
      initialItemId: null;
      downloadName?: string;
    };

interface UseChatInteractionStateParams {
  selectedUser: string | null;
  selectedThreadRootId: string | null;
  displaySelectedUser?: string | null;
  isMobileViewport: boolean;
  mainImageGallery: MediaViewerImageItem[];
  threadImageGallery: MediaViewerImageItem[];
  navigateToConversation: (peerId: string, threadRootId?: string | null) => void;
  openThreadPanelInFullMode: () => void;
  sendText: (data: {
    receiver_id: string;
    text: string;
    reply_mode?: ComposerReplyTarget['mode'] | null;
    reply_to_message_id?: string;
  }) => Promise<unknown>;
  sendVoice: (data: SendMediaInput) => Promise<unknown>;
  editMessage: (data: { messageId: string; text: string }) => Promise<unknown>;
  deleteMessage: (messageId: string) => Promise<unknown>;
  toggleReaction: (data: { messageId: string; emoji: string }) => Promise<unknown>;
}

export const closedMediaViewerState: MediaViewerState = {
  open: false,
  type: 'image',
  url: '',
  items: [],
  initialItemId: null,
};

const getMessagePreviewText = (message: ChatMessage) => {
  if (message.isDeleted) return 'Message deleted';
  if (message.kind === 'text' || message.kind === 'emoji') return message.text;
  if (message.kind === 'image' || message.kind === 'video') {
    return message.caption || `${message.kind} message`;
  }
  if (message.kind === 'file') return message.caption || message.fileName || 'File';
  if (message.kind === 'audio') {
    return message.media?.kind === 'audio' ? 'Audio' : 'Voice message';
  }
  if (message.kind === 'call') {
    return getCallSummaryText({
      direction: message.callDirection,
      type: message.call.type,
      status: message.call.status,
      durationMs: message.call.duration_ms,
    });
  }
  if (message.kind === 'sticker') return 'Sticker';
  if (message.kind === 'system') return message.text;
  return 'Message';
};

export function useChatInteractionState({
  selectedUser,
  selectedThreadRootId,
  displaySelectedUser,
  isMobileViewport,
  mainImageGallery,
  threadImageGallery,
  navigateToConversation,
  openThreadPanelInFullMode,
  sendText,
  sendVoice,
  editMessage,
  deleteMessage,
  toggleReaction,
}: UseChatInteractionStateParams) {
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState>(closedMediaViewerState);
  const [activeMessage, setActiveMessage] = useState<ChatMessage | null>(null);
  const [activeMessageAnchor, setActiveMessageAnchor] = useState<MessageMenuAnchor | null>(null);
  const [activeMessageSurface, setActiveMessageSurface] = useState<ActiveMessageSurface>('main');
  const [replyTarget, setReplyTarget] = useState<ComposerReplyTarget | null>(null);
  const [threadReplyTarget, setThreadReplyTarget] = useState<ComposerReplyTarget | null>(null);
  const [conversationMenu, setConversationMenu] = useState<ConversationMenuState | null>(null);

  useEffect(() => {
    setActiveMessage(null);
    setActiveMessageAnchor(null);
    setActiveMessageSurface('main');
    setReplyTarget(null);
    setThreadReplyTarget(null);
    setConversationMenu(null);
  }, [selectedUser]);

  useEffect(() => {
    setThreadReplyTarget(null);
  }, [selectedThreadRootId]);

  const createReplyTarget = (
    message: ChatMessage,
    mode: ComposerReplyTarget['mode']
  ): ComposerReplyTarget => ({
    messageId: message.id,
    mode,
    previewText: getMessagePreviewText(message),
    senderLabel: message.isOwn ? 'You' : displaySelectedUser || 'Contact',
  });

  const closeMessageMenu = () => {
    setActiveMessage(null);
    setActiveMessageAnchor(null);
    setActiveMessageSurface('main');
  };

  const openMessageMenu = (
    message: ChatMessage,
    anchor: MessageMenuAnchor,
    surface: ActiveMessageSurface
  ) => {
    setActiveMessage(message);
    setActiveMessageAnchor(anchor);
    setActiveMessageSurface(surface);
  };

  const handleSelectReplyMode = () => {
    if (!activeMessage) return;

    if (activeMessageSurface === 'thread') {
      setThreadReplyTarget(createReplyTarget(activeMessage, 'thread'));
      closeMessageMenu();
      return;
    }

    setReplyTarget(createReplyTarget(activeMessage, 'quote'));
    closeMessageMenu();
  };

  const openThreadForMessage = (message: ChatMessage) => {
    if (!selectedUser) {
      return;
    }

    const rootMessageId = message.isThreadRoot ? message.id : message.threadRootId || message.id;
    if (isMobileViewport) {
      openThreadPanelInFullMode();
    }
    navigateToConversation(selectedUser, rootMessageId);
    closeMessageMenu();
  };

  const handleSendText = async (data: SendTextInput) => {
    await sendText({
      ...data,
      reply_mode: replyTarget?.mode,
      reply_to_message_id: replyTarget?.messageId,
    });
    setReplyTarget(null);
  };

  const handleSendThreadText = async (data: SendTextInput) => {
    if (!selectedThreadRootId) return;
    await sendText({
      ...data,
      reply_mode: 'thread',
      reply_to_message_id: threadReplyTarget?.messageId || selectedThreadRootId,
    });
    setThreadReplyTarget(null);
  };

  const handleSendMedia = async (data: SendMediaInput) => {
    await sendVoice({
      ...data,
      reply_mode: data.reply_mode ?? replyTarget?.mode,
      reply_to_message_id: data.reply_to_message_id ?? replyTarget?.messageId,
    });
  };

  const handleSendThreadMedia = async (data: SendMediaInput) => {
    if (!selectedThreadRootId) return;
    await sendVoice({
      ...data,
      reply_mode: data.reply_mode ?? 'thread',
      reply_to_message_id:
        data.reply_to_message_id ?? threadReplyTarget?.messageId ?? selectedThreadRootId,
    });
  };

  const handleEditMessage = async (text: string) => {
    if (!activeMessage) return;
    await editMessage({ messageId: activeMessage.id, text });
    closeMessageMenu();
  };

  const handleDeleteMessage = async () => {
    if (!activeMessage) return;
    await deleteMessage(activeMessage.id);
    closeMessageMenu();
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    await toggleReaction({ messageId, emoji });
  };

  const openImageViewer = (items: MediaViewerImageItem[], initialItemId: string) => {
    setMediaViewer({
      open: true,
      type: 'image',
      url: '',
      items,
      initialItemId,
    });
  };

  const handleMainMediaClick = (payload: MediaClickPayload) => {
    if (payload.type === 'image') {
      openImageViewer(mainImageGallery, payload.messageId);
      return;
    }

    setMediaViewer({
      open: true,
      type: 'video',
      url: payload.url,
      items: [],
      initialItemId: null,
      downloadName: payload.downloadName,
    });
  };

  const handleThreadMediaClick = (payload: MediaClickPayload) => {
    if (payload.type === 'image') {
      openImageViewer(threadImageGallery, payload.messageId);
      return;
    }

    setMediaViewer({
      open: true,
      type: 'video',
      url: payload.url,
      items: [],
      initialItemId: null,
      downloadName: payload.downloadName,
    });
  };

  const openConversationMenu = (
    event: ReactMouseEvent<HTMLElement>,
    peerUserId: string,
    unreadCount: number
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setConversationMenu({
      peerUserId,
      unreadCount,
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      },
    });
  };

  const openConversationMenuAtPoint = (
    event: ReactMouseEvent<HTMLElement>,
    peerUserId: string,
    unreadCount: number
  ) => {
    setConversationMenu({
      peerUserId,
      unreadCount,
      rect: {
        top: event.clientY,
        right: event.clientX,
        bottom: event.clientY,
        left: event.clientX,
      },
    });
  };

  return {
    mediaViewer,
    setMediaViewer,
    activeMessage,
    activeMessageAnchor,
    conversationMenu,
    replyTarget,
    threadReplyTarget,
    setReplyTarget,
    setThreadReplyTarget,
    setConversationMenu,
    closeMessageMenu,
    openMessageMenu,
    handleSelectReplyMode,
    openThreadForMessage,
    handleSendText,
    handleSendThreadText,
    handleSendMedia,
    handleSendThreadMedia,
    handleEditMessage,
    handleDeleteMessage,
    handleToggleReaction,
    handleMainMediaClick,
    handleThreadMediaClick,
    openConversationMenu,
    openConversationMenuAtPoint,
  };
}
