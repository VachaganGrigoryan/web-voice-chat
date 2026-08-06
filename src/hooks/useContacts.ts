import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { connectionsApi } from '@/api/endpoints';
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
      queryClient.invalidateQueries({ queryKey: ['connections', 'contacts'] });
    };

    socket.on(EVENTS.RELATIONSHIP_ACTIVATED, invalidate);
    socket.on(EVENTS.RELATIONSHIP_REVOKED, invalidate);
    socket.on(EVENTS.BLOCK_CREATED, invalidate);

    return () => {
      socket.off(EVENTS.RELATIONSHIP_ACTIVATED, invalidate);
      socket.off(EVENTS.RELATIONSHIP_REVOKED, invalidate);
      socket.off(EVENTS.BLOCK_CREATED, invalidate);
    };
  }, [socket, queryClient]);

  const contactsQuery = useQuery({
    queryKey: ['connections', 'contacts'],
    queryFn: () => connectionsApi.getContacts().then((res) => res.data),
  });

  const removeContactMutation = useMutation({
    mutationFn: (relationshipId: string) => connectionsApi.revoke(relationshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'contacts'] });
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
