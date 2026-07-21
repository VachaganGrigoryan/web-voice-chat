import { useMemo } from 'react';
import { Conversation, Ping, PingItem } from '@/api/types';

function getPeerDisplayName(peerUser?: Conversation['peer_user'] | null) {
  if (!peerUser) {
    return null;
  }

  if (peerUser.is_ghost) {
    return 'Ghost chat';
  }

  return peerUser.display_name || peerUser.username || peerUser.id;
}

interface UseChatLayoutDerivedDataParams {
  conversations: Conversation[];
  incoming: PingItem[];
  outgoing: PingItem[];
  selectedUser: string | null;
}

export function useChatLayoutDerivedData({
  conversations,
  incoming,
  outgoing,
  selectedUser,
}: UseChatLayoutDerivedDataParams) {
  const pendingIncomingCount = useMemo(
    () => incoming.filter((item) => item.ping.status === 'pending').length,
    [incoming]
  );

  const contacts = useMemo(() => {
    return conversations.filter(Boolean).sort((left, right) => {
      const leftTime = new Date(left.last_message_at || 0).getTime();
      const rightTime = new Date(right.last_message_at || 0).getTime();
      return rightTime - leftTime;
    });
  }, [conversations]);

  const selectedConversation = contacts.find((conversation) => conversation.conversation_id === selectedUser);
  const selectedConversationUser = selectedConversation?.peer_user || null;
  const selectedPeerUserId =
    selectedConversation?.type === 'dm' ? selectedConversationUser?.id || null : null;
  const selectedUserSummary = selectedConversationUser;

  const incomingPing = useMemo<Ping | null>(
    () => (selectedPeerUserId ? incoming.find((item) => item?.peer?.id === selectedPeerUserId)?.ping || null : null),
    [selectedPeerUserId, incoming]
  );

  const pingStatus = useMemo(() => {
    if (!selectedPeerUserId) return 'none';
    if (selectedUserSummary?.ping_status) return selectedUserSummary.ping_status;
    if (incomingPing?.status === 'pending') return 'incoming_pending';
    if (outgoing.find((item) => item?.peer?.id === selectedPeerUserId)?.ping.status === 'pending') return 'outgoing_pending';
    return 'none';
  }, [selectedPeerUserId, selectedUserSummary, incomingPing, outgoing]);

  const isPingAccepted = useMemo(() => {
    if (!selectedUser) return false;

    if (contacts.some((conversation) => conversation.conversation_id === selectedUser)) {
      return true;
    }

    if (selectedUserSummary) {
      return selectedUserSummary.chat_allowed || selectedUserSummary.ping_status === 'accepted';
    }

    return (
      !!selectedPeerUserId &&
      (incoming.some((item) => item?.peer?.id === selectedPeerUserId && item?.ping?.status === 'accepted') ||
        outgoing.some((item) => item?.peer?.id === selectedPeerUserId && item?.ping?.status === 'accepted'))
    );
  }, [selectedUser, selectedPeerUserId, selectedUserSummary, incoming, outgoing, contacts]);
  const displaySelectedUser =
    selectedConversation?.type === 'group'
      ? selectedConversation.title || 'Group chat'
      : getPeerDisplayName(selectedConversationUser) || selectedUser;
  const isSelectedConversationGhost = !!selectedConversationUser?.is_ghost;

  return {
    pendingIncomingCount,
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
