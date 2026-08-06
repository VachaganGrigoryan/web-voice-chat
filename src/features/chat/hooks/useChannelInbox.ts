import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { channelsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type { ChannelInboxRow, NotificationLevel } from '@/api/types';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';

const CHANNEL_INBOX_KEY = ['channels', 'me'] as const;

/**
 * The channel side of the inbox: rows carrying the viewer's own pin/mute/unread
 * state, plus the mutations the row menu needs. Mirrors useConversationActions
 * so both halves of the sidebar behave the same way.
 */
export function useChannelInbox(enabled = true) {
  const queryClient = useQueryClient();
  const { socket } = useSocketStore();

  const query = useQuery({
    queryKey: CHANNEL_INBOX_KEY,
    queryFn: () => channelsApi.listMine(),
    enabled,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: CHANNEL_INBOX_KEY });

  // A channel message changes unread counts and ordering, so the rows must
  // refresh on the same event that feeds the timeline.
  useEffect(() => {
    if (!socket || !enabled) return;

    const handleMessage = (message: { container_type?: string }) => {
      if (message?.container_type === 'channel') invalidate();
    };

    socket.on(EVENTS.RECEIVE_MESSAGE, handleMessage);
    return () => {
      socket.off(EVENTS.RECEIVE_MESSAGE, handleMessage);
    };
  }, [socket, enabled, queryClient]);

  const withError = (fallback: string) => (error: unknown) =>
    toast.error(extractApiError(error, fallback));

  const setInboxState = useMutation({
    mutationFn: ({
      channelId,
      updates,
    }: {
      channelId: string;
      updates: { pinned?: boolean; archived?: boolean; folder?: string | null };
    }) => channelsApi.setInboxState(channelId, updates),
    onSuccess: invalidate,
    onError: withError('Could not update this channel'),
  });

  const setNotifications = useMutation({
    mutationFn: ({
      channelId,
      level,
    }: {
      channelId: string;
      level: NotificationLevel;
    }) => channelsApi.setNotifications(channelId, { notification_level: level }),
    onSuccess: invalidate,
    onError: withError('Could not update notifications'),
  });

  const markRead = useMutation({
    mutationFn: (channelId: string) => channelsApi.markRead(channelId),
    onSuccess: invalidate,
    onError: withError('Could not mark this channel read'),
  });

  const leave = useMutation({
    mutationFn: (channelId: string) => channelsApi.leave(channelId),
    onSuccess: () => {
      void invalidate();
      toast.success('Left channel');
    },
    onError: withError('Could not leave this channel'),
  });

  const rows: ChannelInboxRow[] = query.data ?? [];

  return {
    rows,
    isLoading: query.isLoading,
    setInboxState,
    setNotifications,
    markRead,
    leave,
  };
}
