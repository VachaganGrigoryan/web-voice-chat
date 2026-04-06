import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callsApi } from '@/api/endpoints';
import { DeleteCallHistoryResponse, MessageDoc } from '@/api/types';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';

interface UseCallHistoryOptions {
  peerUserId?: string | null;
  enabled?: boolean;
}

const createEmptyInfiniteData = () => ({
  pages: [{ data: [], meta: { next_cursor: null, limit: 20, total: 0 }, success: true }],
  pageParams: [undefined],
});

const clearCallHistoryCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  peerUserId?: string
) => {
  queryClient.setQueriesData({ queryKey: ['calls', 'history'] }, (old: any) => {
    if (!old?.pages) return old;

    if (!peerUserId) {
      return createEmptyInfiniteData();
    }

    let changed = false;
    const pages = old.pages.map((page: any) => {
      const existingData = page.data || [];
      const data = existingData.filter((item: any) => {
        const shouldRemove = item?.peer_user?.id === peerUserId;
        if (shouldRemove) {
          changed = true;
        }
        return !shouldRemove;
      });

      if (!changed) {
        return page;
      }

      const total =
        typeof page.meta?.total === 'number'
          ? Math.max(0, page.meta.total - (existingData.length - data.length))
          : page.meta?.total;

      return {
        ...page,
        data,
        meta: {
          ...page.meta,
          total,
        },
      };
    });

    return changed ? { ...old, pages } : old;
  });
};

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

  const deleteHistoryMutation = useMutation({
    mutationFn: (peer_user_id?: string) => callsApi.deleteHistory(peer_user_id),
    onSuccess: (_result, peer_user_id) => {
      clearCallHistoryCaches(queryClient, peer_user_id);
      queryClient.invalidateQueries({ queryKey: ['calls', 'history'] });
    },
  });

  return {
    history,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    deleteHistory: deleteHistoryMutation.mutateAsync as (peer_user_id?: string) => Promise<DeleteCallHistoryResponse>,
    isDeletingHistory: deleteHistoryMutation.isPending,
  };
}
