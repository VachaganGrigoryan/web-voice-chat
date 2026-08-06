import { useMemo } from 'react';
import { NavBadgeCounts } from '@/app/navigation/navConfig';
import { useConversations } from '@/hooks/useConversationList';
import { useConnections } from '@/hooks/useConnections';
import { useNotifications } from '@/hooks/useNotifications';
import { useActiveSpace } from './useActiveSpace';

/**
 * Single place the rail and the mobile tab bar read their badge counts from, so
 * the two surfaces can never disagree.
 */
export function useNavBadges(): NavBadgeCounts {
  const activeSpaceId = useActiveSpace((state) => state.activeSpaceId);
  const { data: conversations } = useConversations(activeSpaceId);
  const { incoming } = useConnections();
  const { unreadCount } = useNotifications();

  return useMemo(() => {
    // useConversations is an infinite query, so the pages must be flattened the
    // same way ChatLayout does before any count can be derived.
    const list = conversations?.pages.flatMap((page) => page.data || []).filter(Boolean) ?? [];

    const unreadConversations = list.reduce(
      (total, conversation) => total + (conversation.unread_count ?? 0),
      0
    );

    const pendingRequests = incoming.filter(
      (item) => item.relationship.status === 'pending'
    ).length;

    return {
      unreadConversations,
      activity: pendingRequests + unreadCount,
    };
  }, [conversations, incoming, unreadCount]);
}
