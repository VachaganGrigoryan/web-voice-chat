import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { callsApi } from '@/api/endpoints';
import { MessageDoc } from '@/api/types';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';

interface UseCallHistoryOptions {
  peerUserId?: string | null;
  enabled?: boolean;
}

export function useCallHistory({
  peerUserId = null,
  enabled = true,
}: UseCallHistoryOptions = {}) {
  const queryClient = useQueryClient();
  const socket = useSocketStore((state) => state.socket);

  useEffect(() => {
    if (!socket || !enabled) {
      return;
    }

    const invalidateHistory = () => {
      queryClient.invalidateQueries({ queryKey: ['calls', 'history'] });
    };

    const handleReceiveMessage = (message: MessageDoc) => {
      if (message.type === 'call') {
        invalidateHistory();
      }
    };

    socket.on(EVENTS.CALL_ENDED, invalidateHistory);
    socket.on(EVENTS.CALL_REJECTED, invalidateHistory);
    socket.on(EVENTS.RECEIVE_MESSAGE, handleReceiveMessage);

    return () => {
      socket.off(EVENTS.CALL_ENDED, invalidateHistory);
      socket.off(EVENTS.CALL_REJECTED, invalidateHistory);
      socket.off(EVENTS.RECEIVE_MESSAGE, handleReceiveMessage);
    };
  }, [enabled, queryClient, socket]);

  const query = useInfiniteQuery({
    queryKey: ['calls', 'history', peerUserId],
    queryFn: ({ pageParam }) =>
      callsApi.getHistory(20, pageParam as string | undefined, peerUserId || undefined),
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    enabled,
    initialPageParam: undefined,
  });

  const history = useMemo(
    () => query.data?.pages.flatMap((page) => page.data || []).filter(Boolean) || [],
    [query.data]
  );

  return {
    history,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
  };
}
