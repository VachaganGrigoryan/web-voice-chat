import { useMemo } from 'react';

export function useContacts(conversations: any[], incoming: any[], outgoing: any[]) {
  return useMemo(() => {
    const list = [...conversations];
    const conversationUserIds = new Set(conversations.map(c => c?.peer_user?.id).filter(Boolean));
    
    // Add accepted incoming pings
    incoming.filter(Boolean).forEach(item => {
      if (item.ping?.status === 'accepted' && item.peer?.id && !conversationUserIds.has(item.peer.id)) {
        list.push({
          conversation_id: `ping-${item.ping.id}`,
          peer_user: item.peer,
          last_message: null,
          unread_count: 0,
          last_message_at: item.ping.updated_at
        } as any);
        conversationUserIds.add(item.peer.id);
      }
    });

    // Add accepted outgoing pings
    outgoing.filter(Boolean).forEach(item => {
      if (item.ping?.status === 'accepted' && item.peer?.id && !conversationUserIds.has(item.peer.id)) {
        list.push({
          conversation_id: `ping-${item.ping.id}`,
          peer_user: item.peer,
          last_message: null,
          unread_count: 0,
          last_message_at: item.ping.updated_at
        } as any);
        conversationUserIds.add(item.peer.id);
      }
    });

    // Sort by last_message_at descending
    return list.filter(Boolean).sort((a, b) => {
      const timeA = new Date(a.last_message_at || 0).getTime();
      const timeB = new Date(b.last_message_at || 0).getTime();
      return timeB - timeA;
    });
  }, [conversations, incoming, outgoing]);
}
