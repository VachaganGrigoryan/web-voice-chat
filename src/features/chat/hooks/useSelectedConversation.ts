import { useMemo } from 'react';
import { ConnectionListItem, Conversation, Relationship } from '@/api/types';

function getPeerDisplayName(peerUser?: Conversation['peer_user'] | null) {
  if (!peerUser) {
    return null;
  }

  if (peerUser.is_ghost) {
    return 'Ghost chat';
  }

  return peerUser.display_name || peerUser.username || peerUser.id;
}

interface UseSelectedConversationParams {
  conversations: Conversation[];
  incoming: ConnectionListItem[];
  outgoing: ConnectionListItem[];
  selectedUser: string | null;
}

/**
 * Derives everything about the currently-open conversation (ping status,
 * display name, ghost state) from the inbox list plus the connection queues.
 * Channels don't use this — a channel has no ping/connection gate, so it opens
 * as soon as it's selected.
 */
export function useSelectedConversation({
  conversations,
  incoming,
  outgoing,
  selectedUser,
}: UseSelectedConversationParams) {
  const contacts = useMemo(() => conversations.filter(Boolean), [conversations]);

  const selectedConversation = contacts.find((conversation) => conversation.conversation_id === selectedUser);
  const selectedConversationUser = selectedConversation?.peer_user || null;
  const selectedPeerUserId =
    selectedConversation?.type === 'dm' ? selectedConversationUser?.id || null : null;
  const selectedUserSummary = selectedConversationUser;

  const incomingPing = useMemo<Relationship | null>(
    () =>
      selectedPeerUserId
        ? incoming.find((item) => item.peer.id === selectedPeerUserId)?.relationship ?? null
        : null,
    [selectedPeerUserId, incoming]
  );

  const pingStatus = useMemo(() => {
    if (!selectedPeerUserId) return 'none';
    if (selectedUserSummary?.connection_status === 'active') return 'active';
    if (incomingPing?.status === 'pending') return 'incoming_pending';
    if (outgoing.some((item) => item.peer.id === selectedPeerUserId)) {
      return 'outgoing_pending';
    }
    if (selectedUserSummary?.connection_status) {
      return selectedUserSummary.connection_status;
    }
    return 'none';
  }, [selectedPeerUserId, selectedUserSummary, incomingPing, outgoing]);

  const isPingAccepted = useMemo(() => {
    if (!selectedUser) return false;

    if (contacts.some((conversation) => conversation.conversation_id === selectedUser)) {
      return true;
    }

    if (selectedUserSummary) {
      return (
        selectedUserSummary.chat_allowed ||
        selectedUserSummary.connection_status === 'active'
      );
    }

    return false;
  }, [selectedUser, selectedPeerUserId, selectedUserSummary, incoming, outgoing, contacts]);
  const displaySelectedUser =
    selectedConversation?.type === 'group'
      ? selectedConversation.title || 'Group chat'
      : getPeerDisplayName(selectedConversationUser) || selectedUser;
  const isSelectedConversationGhost = !!selectedConversationUser?.is_ghost;

  return {
    contacts,
    selectedUserSummary,
    incomingPing,
    pingStatus,
    isPingAccepted,
    selectedConversation,
    selectedPeerUserId,
    selectedConversationUser,
    displaySelectedUser,
    isSelectedConversationGhost,
  };
}
