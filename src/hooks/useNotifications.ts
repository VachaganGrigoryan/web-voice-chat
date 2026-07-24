import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notificationsApi } from '@/api/endpoints';
import { useSocketStore } from '@/socket/socket';
import { EVENTS } from '@/socket/events';

export function useNotifications(limit = 50) {
  const queryClient = useQueryClient();
  const { socket } = useSocketStore();

  useEffect(() => {
    if (!socket) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on(EVENTS.PING_RECEIVED, invalidate);
    socket.on(EVENTS.PING_ACCEPTED, invalidate);
    socket.on(EVENTS.PING_DECLINED, invalidate);
    socket.on(EVENTS.PING_CANCELLED, invalidate);

    return () => {
      socket.off(EVENTS.PING_RECEIVED, invalidate);
      socket.off(EVENTS.PING_ACCEPTED, invalidate);
      socket.off(EVENTS.PING_DECLINED, invalidate);
      socket.off(EVENTS.PING_CANCELLED, invalidate);
    };
  }, [socket, queryClient]);

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(limit),
  });

  return {
    notifications: Array.isArray(query.data) ? query.data : [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
