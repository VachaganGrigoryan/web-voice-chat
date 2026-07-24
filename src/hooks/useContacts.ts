import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { pingsApi } from '@/api/endpoints';
import { useSocketStore } from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { toast } from 'sonner';
import { extractApiError } from '@/api/errors';

export function useContacts() {
  const queryClient = useQueryClient();
  const { socket } = useSocketStore();

  useEffect(() => {
    if (!socket) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['pings', 'contacts'] });
    };

    socket.on(EVENTS.PING_ACCEPTED, invalidate);
    socket.on(EVENTS.USER_BLOCKED, invalidate);
    socket.on(EVENTS.CHAT_PERMISSION_UPDATED, invalidate);

    return () => {
      socket.off(EVENTS.PING_ACCEPTED, invalidate);
      socket.off(EVENTS.USER_BLOCKED, invalidate);
      socket.off(EVENTS.CHAT_PERMISSION_UPDATED, invalidate);
    };
  }, [socket, queryClient]);

  const contactsQuery = useQuery({
    queryKey: ['pings', 'contacts'],
    queryFn: () => pingsApi.getContacts().then((res) => res.data),
  });

  const removeContactMutation = useMutation({
    mutationFn: (peerUserId: string) => pingsApi.removeContact(peerUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pings', 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Contact removed');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to remove contact'));
    },
  });

  return {
    contacts: Array.isArray(contactsQuery.data) ? contactsQuery.data : [],
    isLoadingContacts: contactsQuery.isLoading,
    removeContact: removeContactMutation.mutateAsync,
    isRemoving: removeContactMutation.isPending,
  };
}
