import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationsApi, messagesApi, spacesApi } from '@/api/endpoints';
import type { ChannelInboxRow, Conversation } from '@/api/types';
import { resetContainerUnreadCount } from '@/container';
import { useConversations } from '@/hooks/useConversationList';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';
import { useChannelInbox } from '../../hooks/useChannelInbox';
import { sortConversationsByRecency } from '../../utils/chatLayoutUtils';

export type InboxRowData =
  | { readonly kind: 'conversation'; readonly id: string; readonly pinned: boolean; readonly unreadCount: number; readonly conversation: Conversation }
  | { readonly kind: 'channel'; readonly id: string; readonly pinned: boolean; readonly unreadCount: number; readonly channelRow: ChannelInboxRow };

export interface InboxSections {
  readonly pinned: InboxRowData[];
  readonly channels: InboxRowData[];
  readonly groups: InboxRowData[];
  readonly direct: InboxRowData[];
}

const toConversationRow = (conversation: Conversation): InboxRowData => ({
  kind: 'conversation',
  id: conversation.conversation_id,
  pinned: conversation.pinned,
  unreadCount: conversation.unread_count ?? 0,
  conversation,
});

const toChannelRow = (channelRow: ChannelInboxRow): InboxRowData => ({
  kind: 'channel',
  id: channelRow.channel.id,
  pinned: channelRow.state.pinned,
  unreadCount: channelRow.unread_count,
  channelRow,
});

/**
 * Every currently-inline inbox query, normalized into one row list so a single
 * component can render both container types. The inbox never requests
 * capabilities — only the opened container does; fifty rows requesting
 * capabilities would defeat the point of the batch endpoint.
 */
export function useInboxData({
  selectedSpaceId,
  showArchived,
}: {
  selectedSpaceId: string | null;
  showArchived: boolean;
}) {
  const { data: conversationsData } = useConversations(selectedSpaceId);
  const conversations = useMemo(
    () =>
      sortConversationsByRecency(
        conversationsData?.pages.flatMap((page) => page.data || []).filter(Boolean) || []
      ),
    [conversationsData]
  );

  const archivedQuery = useQuery({
    queryKey: ['conversations', 'archived', selectedSpaceId],
    queryFn: () =>
      conversationsApi.getConversations(50, undefined, {
        archived: true,
        space_id: selectedSpaceId || undefined,
      }),
    enabled: showArchived,
  });
  const archivedConversations = archivedQuery.data?.data ?? [];

  // Fetch user spaces to identify the default Vogi space vs. a custom workspace space.
  const spacesQuery = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });
  const userSpaces = spacesQuery.data ?? [];
  const activeSpace = userSpaces.find((space) => space.id === selectedSpaceId);
  const isCustomWorkspaceSpace =
    !!selectedSpaceId && !(activeSpace?.is_default || activeSpace?.slug === 'vogi');

  const spaceChannelsQuery = useQuery({
    queryKey: ['space-channels', selectedSpaceId],
    queryFn: () =>
      selectedSpaceId && isCustomWorkspaceSpace ? spacesApi.listChannels(selectedSpaceId) : Promise.resolve([]),
    enabled: !showArchived && isCustomWorkspaceSpace,
  });
  const spaceChannels = spaceChannelsQuery.data ?? [];

  const queryClient = useQueryClient();
  const socket = useSocketStore((state) => state.socket);
  const markConversationRead = useMutation({
    mutationFn: (conversationId: string) => messagesApi.markConversationRead(conversationId),
    onSuccess: (_result, conversationId) => {
      resetContainerUnreadCount(queryClient, { container_type: 'conversation', container_id: conversationId });
      socket?.emit(EVENTS.CONVERSATION_READ, { conversation_id: conversationId });
    },
  });

  const channelInbox = useChannelInbox(!showArchived);
  const channelRows = useMemo(() => {
    const rows = channelInbox.rows;

    if (isCustomWorkspaceSpace && selectedSpaceId) {
      const inboxSpaceRows = rows.filter((row) => row.channel.space_id === selectedSpaceId);
      const inboxChannelIds = new Set(inboxSpaceRows.map((row) => row.channel.id));

      const extraSpaceRows: ChannelInboxRow[] = spaceChannels
        .filter((channel) => !inboxChannelIds.has(channel.id))
        .map((channel) => ({
          channel: {
            id: channel.id,
            owner: { type: 'space', id: selectedSpaceId },
            space_id: selectedSpaceId,
            kind: channel.kind,
            slug: channel.slug,
            name: channel.name,
            description: channel.description,
            avatar: null,
            banner: null,
            visibility: channel.visibility,
            join_policy: 'open',
            posting_policy: channel.posting_policy,
            comment_policy: 'everyone',
            tags: [],
            message_count: 0,
            follower_count: 0,
            last_message_id: null,
            pinned_message_ids: [],
            last_activity_at: null,
            legacy_conversation_id: null,
            created_by: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          state: {
            channel_id: channel.id,
            pinned: false,
            archived: false,
            folder: null,
            muted_until: null,
            notification_level: 'all',
            last_read_message_id: null,
          },
          unread_count: 0,
          joined: channel.joined,
        }));

      return [...inboxSpaceRows, ...extraSpaceRows];
    }

    return rows;
  }, [channelInbox.rows, isCustomWorkspaceSpace, selectedSpaceId, spaceChannels]);

  const sections: InboxSections = useMemo(() => {
    const visibleConversations = showArchived ? archivedConversations : conversations;
    const pinnedConversations = visibleConversations.filter((c) => c.pinned);
    const restConversations = visibleConversations.filter((c) => !c.pinned);
    const pinnedChannelRows = showArchived ? [] : channelRows.filter((row) => row.state.pinned);
    const unpinnedChannelRows = showArchived ? [] : channelRows.filter((row) => !row.state.pinned);

    return {
      pinned: [...pinnedChannelRows.map(toChannelRow), ...pinnedConversations.map(toConversationRow)],
      channels: unpinnedChannelRows.map(toChannelRow),
      groups: restConversations.filter((c) => c.type === 'group').map(toConversationRow),
      direct: restConversations.filter((c) => c.type === 'dm').map(toConversationRow),
    };
  }, [archivedConversations, channelRows, conversations, showArchived]);

  const unreadIn = (rows: InboxRowData[]) => rows.reduce((total, row) => total + row.unreadCount, 0);

  return {
    sections,
    unreadIn,
    conversations,
    channelRows,
    isLoadingArchived: archivedQuery.isLoading,
    channelInbox,
    markConversationRead,
    isEmpty: !showArchived && conversations.length === 0 && channelRows.length === 0,
    isArchivedEmpty: showArchived && !archivedQuery.isLoading && archivedConversations.length === 0,
  };
}
