import { useEffect, useState } from 'react';
import { useContainerCompose, useMessageActions, type ContainerDescriptor } from '@/container';
import { triggerHaptic } from '@/utils/haptics';
import { useChatDialogs, type MediaViewerImageItem } from '../ChatDialogsProvider';
import { getCallSummaryText } from '../utils/callPresentation';
import { ChatMessage, ComposerReplyTarget, MediaClickPayload } from '../types/message';
import type { SendMediaInput, SendRichContentInput, SendTextInput } from '../types/sendInputs';

interface UseMessageInteractionsParams {
  descriptor: ContainerDescriptor | null;
  currentUserId: string | null;
  selectedUser: string | null;
  selectedThreadRootId: string | null;
  displaySelectedUser?: string | null;
  isMobileViewport: boolean;
  mainImageGallery: MediaViewerImageItem[];
  threadImageGallery: MediaViewerImageItem[];
  navigateToConversation: (conversationId: string, threadRootId?: string | null) => void;
  openThreadPanelInFullMode: () => void;
}

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

/**
 * The message-interaction half of the old god-hook: reply targets, send/edit/
 * delete/react handlers, thread opening, and media-click routing. The overlay
 * state it used to own (media viewer, active message menu) now lives in
 * `ChatDialogsProvider`; this hook dispatches into it rather than tracking its
 * own copy. Sending, editing and reacting are resolved from the descriptor
 * directly instead of twelve hand-threaded props.
 */
export function useChatInteractionState({
  descriptor,
  currentUserId,
  selectedUser,
  selectedThreadRootId,
  displaySelectedUser,
  isMobileViewport,
  mainImageGallery,
  threadImageGallery,
  navigateToConversation,
  openThreadPanelInFullMode,
}: UseMessageInteractionsParams) {
  const dialogs = useChatDialogs();
  const { activeMessage, activeMessageAnchor, activeMessageSurface } = dialogs.state;
  const [replyTarget, setReplyTarget] = useState<ComposerReplyTarget | null>(null);
  const [threadReplyTarget, setThreadReplyTarget] = useState<ComposerReplyTarget | null>(null);

  const { sendText, sendMedia: sendVoice, sendRichContent, createPoll, isSending } = useContainerCompose(descriptor);
  const {
    editMessage: editMessageAction,
    deleteMessage: deleteMessageAction,
    toggleReaction: toggleReactionAction,
    isEditing: isEditingMessage,
    isDeleting: isDeletingMessage,
    isTogglingReaction,
  } = useMessageActions(descriptor, currentUserId);

  useEffect(() => {
    dialogs.closeMessageMenu();
    setReplyTarget(null);
    setThreadReplyTarget(null);
  }, [selectedUser]);

  useEffect(() => {
    setThreadReplyTarget(null);
  }, [selectedThreadRootId]);

  const createReplyTarget = (message: ChatMessage, mode: ComposerReplyTarget['mode']): ComposerReplyTarget => ({
    messageId: message.id,
    mode,
    previewText: getMessagePreviewText(message),
    senderLabel: message.isOwn ? 'You' : displaySelectedUser || 'Contact',
  });

  const openMessageMenu = dialogs.openMessageMenu;
  const closeMessageMenu = dialogs.closeMessageMenu;

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

  const handleSwipeReply = (message: ChatMessage, surface: 'main' | 'thread') => {
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
    if (!selectedThreadRootId) return;
    await sendText({
      text: data.text,
      reply_mode: 'thread',
      reply_to_message_id: threadReplyTarget?.messageId ?? selectedThreadRootId,
    });
    triggerHaptic('send');
    setThreadReplyTarget(null);
  };

  const handleSendThreadRichContent = async (data: SendRichContentInput) => {
    if (!selectedThreadRootId) return;
    await sendRichContent({
      ...data,
      reply_mode: 'thread',
      reply_to_message_id: data.reply_to_message_id ?? threadReplyTarget?.messageId ?? selectedThreadRootId,
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
    if (!selectedThreadRootId) return;
    const { container_type: _containerType, container_id: _containerId, ...mediaInput } = data;
    await sendVoice({
      ...mediaInput,
      reply_mode: 'thread',
      reply_to_message_id: data.reply_to_message_id ?? threadReplyTarget?.messageId ?? selectedThreadRootId,
    });
  };

  const handleEditMessage = async (text: string) => {
    if (!activeMessage) return;
    await editMessageAction({ messageId: activeMessage.id, text });
    closeMessageMenu();
  };

  const handleDeleteMessage = async () => {
    if (!activeMessage) return;
    await deleteMessageAction({ messageId: activeMessage.id });
    closeMessageMenu();
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    const targetMessage = activeMessage?.id === messageId ? activeMessage : null;
    if (!targetMessage) return;
    await toggleReactionAction({ messageId, emoji });
    triggerHaptic('reaction');
  };

  const openImageViewer = (items: MediaViewerImageItem[], initialItemId: string) => {
    dialogs.setMediaViewer({ open: true, type: 'image', url: '', items, initialItemId });
  };

  const handleMainMediaClick = (payload: MediaClickPayload) => {
    if (payload.type === 'image') {
      openImageViewer(mainImageGallery, payload.messageId);
      return;
    }

    dialogs.setMediaViewer({
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

    dialogs.setMediaViewer({
      open: true,
      type: 'video',
      url: payload.url,
      items: [],
      initialItemId: null,
      downloadName: payload.downloadName,
    });
  };

  return {
    replyTarget,
    threadReplyTarget,
    setReplyTarget,
    setThreadReplyTarget,
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
    isSending,
    isEditingMessage,
    isDeletingMessage,
    isTogglingReaction,
    createPoll,
  };
}
