import { useMemo } from 'react';
import { Conversation, Ping, PingItem } from '@/api/types';

function createAcceptedPingConversation(
  conversationId: string,
  peerUser: Conversation['peer_user'],
  lastMessageAt: string | null
): Conversation {
  return {
    conversation_id: conversationId,
    peer_user: peerUser,
    last_message: null,
    unread_count: 0,
    last_message_at: lastMessageAt,
  };
}

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
    const list: Conversation[] = [...conversations];
    const conversationUserIds = new Set(conversations.map((conversation) => conversation?.peer_user?.id).filter(Boolean));

    incoming.filter(Boolean).forEach((item) => {
      if (item.ping?.status === 'accepted' && item.peer?.id && !conversationUserIds.has(item.peer.id)) {
        list.push(createAcceptedPingConversation(`ping-${item.ping.id}`, item.peer, item.ping.updated_at));
        conversationUserIds.add(item.peer.id);
      }
    });

    outgoing.filter(Boolean).forEach((item) => {
      if (item.ping?.status === 'accepted' && item.peer?.id && !conversationUserIds.has(item.peer.id)) {
        list.push(createAcceptedPingConversation(`ping-${item.ping.id}`, item.peer, item.ping.updated_at));
        conversationUserIds.add(item.peer.id);
      }
    });

    return list.filter(Boolean).sort((left, right) => {
      const leftTime = new Date(left.last_message_at || 0).getTime();
      const rightTime = new Date(right.last_message_at || 0).getTime();
      return rightTime - leftTime;
    });
  }, [conversations, incoming, outgoing]);

  const selectedUserSummary = useMemo(() => {
    if (!selectedUser) {
      return null;
    }

    return conversations.find((conversation) => conversation?.peer_user?.id === selectedUser)?.peer_user || null;
  }, [selectedUser, conversations]);

  const incomingPing = useMemo<Ping | null>(
    () => (selectedUser ? incoming.find((item) => item?.peer?.id === selectedUser)?.ping || null : null),
    [selectedUser, incoming]
  );

  const pingStatus = useMemo(() => {
    if (!selectedUser) return 'none';
    if (selectedUserSummary) return selectedUserSummary.ping_status;
    if (incomingPing?.status === 'pending') return 'incoming_pending';
    if (outgoing.find((item) => item?.peer?.id === selectedUser)?.ping.status === 'pending') return 'outgoing_pending';
    return 'none';
  }, [selectedUser, selectedUserSummary, incomingPing, outgoing]);

  const isPingAccepted = useMemo(() => {
    if (!selectedUser) return false;

    if (selectedUserSummary) {
      return selectedUserSummary.chat_allowed || selectedUserSummary.ping_status === 'accepted';
    }

    return (
      incoming.some((item) => item?.peer?.id === selectedUser && item?.ping?.status === 'accepted') ||
      outgoing.some((item) => item?.peer?.id === selectedUser && item?.ping?.status === 'accepted')
    );
  }, [selectedUser, selectedUserSummary, incoming, outgoing]);

  const selectedConversationUser = useMemo(
    () => contacts.find((conversation) => conversation.peer_user.id === selectedUser)?.peer_user || null,
    [contacts, selectedUser]
  );

  const displaySelectedUser = getPeerDisplayName(selectedConversationUser) || selectedUser;
  const isSelectedConversationGhost = !!selectedConversationUser?.is_ghost;

  return {
    pendingIncomingCount,
    contacts,
    selectedUserSummary,
    incomingPing,
    pingStatus,
    isPingAccepted,
    selectedConversationUser,
    displaySelectedUser,
    isSelectedConversationGhost,
  };
}
