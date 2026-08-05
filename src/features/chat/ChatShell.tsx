import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { APP_ROUTES } from '@/app/routes';
import { useActiveSpace } from '@/app/shell/useActiveSpace';
import { useCreateIntent } from '@/app/shell/useCreateIntent';
import { useAuthStore } from '@/store/authStore';
import { useCallHistory } from '@/hooks/useCallHistory';
import { useConversations } from '@/hooks/useConversationList';
import type { MessageDoc } from '@/api/types';
import { conversationsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { toast } from 'sonner';
import { triggerHaptic } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { usePresence, useTypingIndicator } from '@/socket/socket';
import { InboxPanel } from './InboxPanel';
import { ChatDialogsProvider, useChatDialogs } from './ChatDialogsProvider';
import { useChatRouteParams } from './hooks/useChatRouteParams';
import { useConversationLifecycle } from './hooks/useConversationLifecycle';
import { sortConversationsByRecency } from './utils/chatLayoutUtils';
import { ConfirmDestructiveActionDialog } from './components/ConfirmDestructiveActionDialog';
import { CreateGroupDialog } from './components/CreateGroupDialog';
import { CreateChannelDialog } from './components/CreateChannelDialog';

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function ChatShellContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const dialogs = useChatDialogs();
  const { conversationId, channelId, spaceId: routeSpaceId } = useChatRouteParams();
  const selectedContainerId = channelId ?? conversationId;

  // Only the bare `/chat` route needs the inbox to take the full mobile
  // screen; every other chat-mode destination has its own main content, so the
  // outlet takes over instead.
  const isBareChatRoute = location.pathname === APP_ROUTES.chat;

  const { userId } = useAuthStore();
  const { presenceByUserId } = usePresence();
  const { typingUsers } = useTypingIndicator();
  const activeSpaceId = useActiveSpace((state) => state.activeSpaceId);
  const setActiveSpaceId = useActiveSpace((state) => state.setActiveSpaceId);
  const selectedSpaceId = routeSpaceId ?? activeSpaceId;
  const pendingIntent = useCreateIntent((state) => state.pendingIntent);
  const clearIntent = useCreateIntent((state) => state.clearIntent);

  const { data: conversationsData } = useConversations(selectedSpaceId);
  const contacts = sortConversationsByRecency(
    conversationsData?.pages.flatMap((page) => page.data || []).filter(Boolean) || []
  );

  useEffect(() => {
    if (routeSpaceId) setActiveSpaceId(routeSpaceId);
  }, [routeSpaceId, setActiveSpaceId]);

  const { clearConversation, deleteConversation, isClearingConversation, isDeletingConversation } =
    useConversationLifecycle();
  const { deleteHistory, isDeletingHistory } = useCallHistory({ enabled: false });

  // The rail raises creation intents; this shell owns the dialogs that fulfil
  // them since they're relevant regardless of which chat-mode page is active.
  useEffect(() => {
    if (!pendingIntent) return;

    if (pendingIntent === 'new-group') {
      dialogs.setGroupDialogOpen(true);
    } else if (pendingIntent === 'new-channel') {
      dialogs.setChannelDialogOpen(true);
    } else {
      return;
    }

    clearIntent();
  }, [pendingIntent, clearIntent]);

  const pendingDestructiveAction = dialogs.state.pendingDestructiveAction;
  const isPendingDestructiveActionRunning =
    pendingDestructiveAction?.kind === 'clearConversation'
      ? isClearingConversation
      : pendingDestructiveAction?.kind === 'deleteConversation'
        ? isDeletingConversation
        : pendingDestructiveAction?.kind === 'clearCallHistoryPeer' ||
            pendingDestructiveAction?.kind === 'clearCallHistoryAll'
          ? isDeletingHistory
          : false;

  const destructiveDialogTitle =
    pendingDestructiveAction?.kind === 'clearConversation'
      ? `Clear chat with ${pendingDestructiveAction.label}`
      : pendingDestructiveAction?.kind === 'deleteConversation'
        ? `Delete chat with ${pendingDestructiveAction.label}`
        : pendingDestructiveAction?.kind === 'clearCallHistoryPeer'
          ? `Clear call history with ${pendingDestructiveAction.label}`
          : pendingDestructiveAction?.kind === 'clearCallHistoryAll'
            ? 'Clear all call history'
            : '';

  const destructiveDialogDescription =
    pendingDestructiveAction?.kind === 'clearConversation'
      ? 'This removes your messages from this chat, but keeps the conversation available.'
      : pendingDestructiveAction?.kind === 'deleteConversation'
        ? 'This removes the chat, clears its messages, and deletes the ping between both users.'
        : pendingDestructiveAction?.kind === 'clearCallHistoryPeer'
          ? 'This removes call history entries for this contact from your sidebar.'
          : pendingDestructiveAction?.kind === 'clearCallHistoryAll'
            ? 'This removes all call history entries from your sidebar.'
            : '';

  const destructiveDialogActionLabel =
    pendingDestructiveAction?.kind === 'deleteConversation'
      ? 'Delete chat'
      : pendingDestructiveAction?.kind === 'clearConversation'
        ? 'Clear chat'
        : 'Clear history';

  const handleConfirmDestructiveAction = async () => {
    if (!pendingDestructiveAction) return;

    try {
      switch (pendingDestructiveAction.kind) {
        case 'clearConversation': {
          const result = await clearConversation(pendingDestructiveAction.peerUserId);
          if (selectedContainerId === pendingDestructiveAction.peerUserId) {
            navigate(APP_ROUTES.chatConversation(pendingDestructiveAction.peerUserId));
          }
          toast.success(
            result.cleared_count > 0
              ? `Cleared ${formatCount(result.cleared_count, 'message')} from ${pendingDestructiveAction.label}.`
              : `Chat history with ${pendingDestructiveAction.label} is already empty.`
          );
          break;
        }
        case 'deleteConversation': {
          const result = await deleteConversation(pendingDestructiveAction.peerUserId);
          if (selectedContainerId === pendingDestructiveAction.peerUserId) {
            navigate(APP_ROUTES.chat);
          }
          toast.success(
            result.cleared_count > 0
              ? `Deleted chat with ${pendingDestructiveAction.label}. ${formatCount(result.cleared_count, 'message')} cleared.`
              : `Deleted chat with ${pendingDestructiveAction.label}.`
          );
          break;
        }
        case 'clearCallHistoryPeer': {
          const result = await deleteHistory(pendingDestructiveAction.peerUserId);
          const clearedCount = result.deleted_count + result.hidden_count;
          toast.success(
            clearedCount > 0
              ? `Cleared ${formatCount(clearedCount, 'call entry')} with ${pendingDestructiveAction.label}.`
              : `Call history with ${pendingDestructiveAction.label} is already empty.`
          );
          break;
        }
        case 'clearCallHistoryAll': {
          const result = await deleteHistory();
          const clearedCount = result.deleted_count + result.hidden_count;
          toast.success(
            clearedCount > 0
              ? `Cleared ${formatCount(clearedCount, 'call entry')} from call history.`
              : 'Call history is already empty.'
          );
          break;
        }
      }

      triggerHaptic('destructive');
      dialogs.requestDestructiveAction(null);
    } catch (error) {
      const fallback =
        pendingDestructiveAction.kind === 'deleteConversation'
          ? 'Failed to delete chat'
          : pendingDestructiveAction.kind === 'clearConversation'
            ? 'Failed to clear chat'
            : 'Failed to clear call history';
      toast.error(extractApiError(error, fallback));
    }
  };

  const handleSelectMessageSearchResult = (message: MessageDoc) => {
    if (message.container_type === 'channel') {
      navigate(APP_ROUTES.chatChannel(message.container_id));
      return;
    }

    const conversationId = message.conversation_id || message.container_id;
    const conversation = contacts.find(
      (item) => item.id === conversationId || item.conversation_id === conversationId
    );

    if (conversation?.type === 'dm') {
      navigate(APP_ROUTES.dm(conversation.id));
      return;
    }

    if (conversation?.type === 'group') {
      navigate(
        conversation.space_id
          ? APP_ROUTES.spaceGroupChat(conversation.space_id, conversation.id)
          : APP_ROUTES.group(conversation.id)
      );
      return;
    }

    navigate(APP_ROUTES.chatConversation(conversationId));
  };

  return (
    <div className="flex h-full min-h-0 w-full bg-background overflow-hidden">
      <ConfirmDestructiveActionDialog
        open={!!pendingDestructiveAction}
        title={destructiveDialogTitle}
        description={destructiveDialogDescription}
        actionLabel={destructiveDialogActionLabel}
        isPending={isPendingDestructiveActionRunning}
        onOpenChange={(open) => {
          if (!open && !isPendingDestructiveActionRunning) {
            dialogs.requestDestructiveAction(null);
          }
        }}
        onConfirm={handleConfirmDestructiveAction}
      />

      <CreateGroupDialog
        open={dialogs.state.groupDialogOpen}
        onOpenChange={dialogs.setGroupDialogOpen}
        contacts={contacts}
        currentUserId={userId}
        onCreateGroup={async (data) => {
          try {
            const conversation = await conversationsApi.createGroup({
              title: data.title,
              participant_ids: data.participantIds,
              space_id: selectedSpaceId || undefined,
            });
            await queryClient.invalidateQueries({ queryKey: ['conversations'] });
            navigate(
              conversation.space_id
                ? APP_ROUTES.spaceGroupChat(conversation.space_id, conversation.id)
                : APP_ROUTES.group(conversation.id)
            );
          } catch (error) {
            toast.error(extractApiError(error, 'Failed to create group'));
            throw error;
          }
        }}
      />
      <CreateChannelDialog
        open={dialogs.state.channelDialogOpen}
        onOpenChange={dialogs.setChannelDialogOpen}
        selectedSpaceId={selectedSpaceId}
        onCreated={(newChannelId) => navigate(APP_ROUTES.channel(newChannelId))}
      />

      <InboxPanel
        isClearingConversation={isClearingConversation}
        isDeletingConversation={isDeletingConversation}
        className={cn(isBareChatRoute ? 'flex' : 'hidden md:flex')}
        currentUserId={userId}
        typingUsers={typingUsers}
        presenceByUserId={presenceByUserId}
        selectedContainerId={selectedContainerId}
        selectedSpaceId={selectedSpaceId}
        onOpenSpaces={() => navigate(APP_ROUTES.spaces)}
        onNewGroup={() => dialogs.setGroupDialogOpen(true)}
        onNewChannel={() => dialogs.setChannelDialogOpen(true)}
        onSelectMessageSearchResult={handleSelectMessageSearchResult}
        onSelectConversation={(row) => {
          const conversation = row.conversation;
          if (conversation.type === 'dm') {
            navigate(APP_ROUTES.dm(conversation.id));
            return;
          }
          navigate(
            conversation.space_id
              ? APP_ROUTES.spaceGroupChat(conversation.space_id, conversation.id)
              : APP_ROUTES.group(conversation.id)
          );
        }}
        onSelectChannel={(row) => {
          const channel = row.channelRow.channel;
          navigate(
            channel.space_id
              ? APP_ROUTES.spaceChannel(channel.space_id, channel.id, 'chat')
              : APP_ROUTES.chatChannel(channel.id)
          );
        }}
      />

      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 bg-background h-full relative',
          isBareChatRoute ? 'hidden md:flex' : 'flex'
        )}
      >
        <Outlet />
      </div>
    </div>
  );
}

/** Layout route for chat mode: the responsive column frame, an outlet, and
 * the dialogs shared across whichever chat-mode page is active. */
export default function ChatShell() {
  return (
    <ChatDialogsProvider>
      <ChatShellContent />
    </ChatDialogsProvider>
  );
}
