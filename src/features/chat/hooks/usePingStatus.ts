import { useMemo } from 'react';

export function usePingStatus(
  selectedUser: string | null,
  conversations: any[],
  incoming: any[],
  outgoing: any[]
) {
  const selectedUserSummary = useMemo(() => {
    if (!selectedUser) return null;
    return conversations.find(c => c?.peer_user?.id === selectedUser)?.peer_user || null;
  }, [selectedUser, conversations]);

  const incomingPing = useMemo(() => 
    selectedUser ? incoming.find(item => item?.peer?.id === selectedUser)?.ping : null,
    [selectedUser, incoming]
  );

  const pingStatus = useMemo(() => {
    if (!selectedUser) return 'none';
    if (selectedUserSummary) return selectedUserSummary.ping_status;
    if (incomingPing?.status === 'pending') return 'incoming_pending';
    if (outgoing.find(item => item?.peer?.id === selectedUser)?.ping.status === 'pending') return 'outgoing_pending';
    return 'none';
  }, [selectedUser, selectedUserSummary, incomingPing, outgoing]);

  const isPingAccepted = useMemo(() => {
    if (!selectedUser) return false;
    
    if (selectedUserSummary) {
      return selectedUserSummary.chat_allowed || selectedUserSummary.ping_status === 'accepted';
    }

    return incoming.some(item => item?.peer?.id === selectedUser && item?.ping?.status === 'accepted') ||
           outgoing.some(item => item?.peer?.id === selectedUser && item?.ping?.status === 'accepted');
  }, [selectedUser, selectedUserSummary, incoming, outgoing]);

  return {
    selectedUserSummary,
    pingStatus,
    isPingAccepted,
    incomingPing
  };
}
