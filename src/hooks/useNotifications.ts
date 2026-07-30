import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notificationsApi } from '@/api/endpoints';
import { notificationKeys } from '@/api/queryKeys';
import type { NotificationView } from '@/api/types';
import { useSocketStore } from '@/socket/socket';
import { EVENTS } from '@/socket/events';

export function useNotifications(limit = 50) {
  const queryClient = useQueryClient();
  const { socket } = useSocketStore();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount });
  };

  useEffect(() => {
    if (!socket) return;

    const invalidateSpaces = () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    };

    socket.on(EVENTS.RELATIONSHIP_REQUESTED, invalidate);
    socket.on(EVENTS.RELATIONSHIP_ACTIVATED, invalidate);
    socket.on(EVENTS.SPACE_INVITE, invalidateSpaces);

    return () => {
      socket.off(EVENTS.RELATIONSHIP_REQUESTED, invalidate);
      socket.off(EVENTS.RELATIONSHIP_ACTIVATED, invalidate);
      socket.off(EVENTS.SPACE_INVITE, invalidateSpaces);
    };
  }, [socket, queryClient]);

  const query = useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsApi.list(limit),
  });

  const unreadCountQuery = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => notificationsApi.unreadCount(),
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markRead(notificationId),
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationView[]>(notificationKeys.all, (old) =>
        old?.map((item) => (item.id === updated.id ? updated : item))
      );
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });

  return {
    notifications: Array.isArray(query.data) ? query.data : [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    unreadCount: unreadCountQuery.data ?? 0,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
    isMarkingAllRead: markAllRead.isPending,
  };
}
