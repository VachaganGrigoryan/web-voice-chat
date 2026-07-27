import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/api/endpoints';
import type {
  SendMediaInput,
  SendRichContentInput,
  SendTextInput,
  ToggleReactionInput,
} from '@/hooks/useChat';
import { triggerHaptic } from '@/utils/haptics';
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
  selectedThreadConversationId: string | null;
  isSelectedThreadLocked?: boolean;
  displaySelectedUser?: string | null;
  isMobileViewport: boolean;
  mainImageGallery: MediaViewerImageItem[];
  threadImageGallery: MediaViewerImageItem[];
  navigateToConversation: (conversationId: string, threadRootId?: string | null) => void;
  openThreadPanelInFullMode: () => void;
  sendText: (data: SendTextInput) => Promise<unknown>;
  sendRichContent: (data: SendRichContentInput) => Promise<unknown>;
  sendVoice: (data: SendMediaInput) => Promise<unknown>;
  editMessage: (data: { conversationId?: string; messageId: string; text: string }) => Promise<unknown>;
  deleteMessage: (data: { conversationId?: string; messageId: string }) => Promise<unknown>;
  toggleReaction: (data: ToggleReactionInput) => Promise<unknown>;
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
  if (message.kind === 'poll') return message.question;
  if (message.kind === 'location') return message.name || 'Location';
  if (message.kind === 'contact') return message.displayName;
  if (message.kind === 'link_preview') return message.title || message.url;
  if (message.kind === 'system') return message.text;
  return 'Message';
};

export function useChatInteractionState({
  selectedUser,
  selectedThreadRootId,
  selectedThreadConversationId,
  isSelectedThreadLocked = false,
  displaySelectedUser,
  isMobileViewport,
  mainImageGallery,
  threadImageGallery,
  navigateToConversation,
  openThreadPanelInFullMode,
  sendText,
  sendRichContent,
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
  const queryClient = useQueryClient();

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

  const handleSwipeReply = (message: ChatMessage, surface: ActiveMessageSurface) => {
    if (surface === 'thread') {
      setThreadReplyTarget(createReplyTarget(message, 'thread'));
      return;
    }

    setReplyTarget(createReplyTarget(message, 'quote'));
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

    // Materialize the thread as an addressable sub-conversation (independent
    // read state + inbox presence). Additive to the inline thread panel above.
    void conversationsApi
      .openThreadConversation(selectedUser, rootMessageId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['threads'] });
        queryClient.invalidateQueries({ queryKey: ['threadConversationByRoot'] });
      })
      .catch(() => undefined);
  };

  const handleSendText = async (data: SendTextInput) => {
    await sendText({
      ...data,
      reply_mode: replyTarget?.mode,
      reply_to_message_id: replyTarget?.messageId,
    });
    triggerHaptic('send');
    setReplyTarget(null);
  };

  const handleSendRichContent = async (data: SendRichContentInput) => {
    await sendRichContent({
      ...data,
      reply_mode: data.reply_mode ?? replyTarget?.mode,
      reply_to_message_id: data.reply_to_message_id ?? replyTarget?.messageId,
    });
    triggerHaptic('send');
    setReplyTarget(null);
  };

  const handleSendThreadText = async (data: SendTextInput) => {
    if (!selectedThreadConversationId || isSelectedThreadLocked) return;
    await sendText({
      ...data,
      container_type: 'conversation',
      container_id: selectedThreadConversationId,
      reply_mode: null,
      reply_to_message_id: threadReplyTarget?.messageId,
    });
    triggerHaptic('send');
    setThreadReplyTarget(null);
  };

  const handleSendThreadRichContent = async (data: SendRichContentInput) => {
    if (!selectedThreadConversationId || isSelectedThreadLocked) return;
    await sendRichContent({
      ...data,
      container_type: 'conversation',
      container_id: selectedThreadConversationId,
      reply_mode: null,
      reply_to_message_id: data.reply_to_message_id ?? threadReplyTarget?.messageId,
    });
    triggerHaptic('send');
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
    if (!selectedThreadConversationId || isSelectedThreadLocked) return;
    await sendVoice({
      ...data,
      container_type: 'conversation',
      container_id: selectedThreadConversationId,
      reply_mode: null,
      reply_to_message_id: data.reply_to_message_id ?? threadReplyTarget?.messageId,
    });
  };

  const handleEditMessage = async (text: string) => {
    if (!activeMessage) return;
    await editMessage({ conversationId: activeMessage.chatId, messageId: activeMessage.id, text });
    closeMessageMenu();
  };

  const handleDeleteMessage = async () => {
    if (!activeMessage) return;
    await deleteMessage({ conversationId: activeMessage.chatId, messageId: activeMessage.id });
    closeMessageMenu();
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    const targetMessage =
      activeMessage?.id === messageId ? activeMessage : null;
    if (!targetMessage) return;
    await toggleReaction({
      container_type: targetMessage.raw.container_type,
      container_id: targetMessage.raw.container_id,
      messageId,
      emoji,
    });
    triggerHaptic('reaction');
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

  // Coordinate-based opener used by the mobile touch long-press gesture, where
  // no synthetic mouse event is available.
  const openConversationMenuAtCoordinates = (
    point: { x: number; y: number },
    peerUserId: string,
    unreadCount: number
  ) => {
    setConversationMenu({
      peerUserId,
      unreadCount,
      rect: {
        top: point.y,
        right: point.x,
        bottom: point.y,
        left: point.x,
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
    handleSwipeReply,
    openThreadForMessage,
    handleSendText,
    handleSendRichContent,
    handleSendThreadText,
    handleSendThreadRichContent,
    handleSendMedia,
    handleSendThreadMedia,
    handleEditMessage,
    handleDeleteMessage,
    handleToggleReaction,
    handleMainMediaClick,
    handleThreadMediaClick,
    openConversationMenu,
    openConversationMenuAtPoint,
    openConversationMenuAtCoordinates,
  };
}
