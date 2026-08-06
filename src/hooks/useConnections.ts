import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { blocksApi, connectionsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';

export function useConnections() {
  const queryClient = useQueryClient();
  const { socket } = useSocketStore();

  const invalidateConnections = () => {
    queryClient.invalidateQueries({ queryKey: ['connections'] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  useEffect(() => {
    if (!socket) return;

    socket.on(EVENTS.RELATIONSHIP_REQUESTED, invalidateConnections);
    socket.on(EVENTS.RELATIONSHIP_ACTIVATED, invalidateConnections);
    socket.on(EVENTS.RELATIONSHIP_REVOKED, invalidateConnections);
    socket.on(EVENTS.BLOCK_CREATED, invalidateConnections);
    socket.on(EVENTS.BLOCK_REMOVED, invalidateConnections);

    return () => {
      socket.off(EVENTS.RELATIONSHIP_REQUESTED, invalidateConnections);
      socket.off(EVENTS.RELATIONSHIP_ACTIVATED, invalidateConnections);
      socket.off(EVENTS.RELATIONSHIP_REVOKED, invalidateConnections);
      socket.off(EVENTS.BLOCK_CREATED, invalidateConnections);
      socket.off(EVENTS.BLOCK_REMOVED, invalidateConnections);
    };
  }, [socket, queryClient]);

  const incomingQuery = useQuery({
    queryKey: ['connections', 'pending', 'incoming'],
    queryFn: () => connectionsApi.getPending('incoming').then((response) => response.data),
  });

  const outgoingQuery = useQuery({
    queryKey: ['connections', 'pending', 'outgoing'],
    queryFn: () => connectionsApi.getPending('outgoing').then((response) => response.data),
  });

  const requestMutation = useMutation({
    mutationFn: (userId: string) => connectionsApi.request(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending', 'outgoing'] });
      toast.success('Ping sent successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractApiError(error, 'Failed to send ping'));
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (relationshipId: string) => connectionsApi.accept(relationshipId),
    onSuccess: () => {
      invalidateConnections();
      toast.success('Ping accepted');
    },
    onError: (error: unknown) => {
      toast.error(extractApiError(error, 'Failed to accept ping'));
    },
  });

  const declineMutation = useMutation({
    mutationFn: (relationshipId: string) => connectionsApi.decline(relationshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      toast.success('Ping declined');
    },
    onError: (error: unknown) => {
      toast.error(extractApiError(error, 'Failed to decline ping'));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (relationshipId: string) => connectionsApi.revoke(relationshipId),
    onSuccess: () => {
      invalidateConnections();
      toast.success('Connection removed');
    },
    onError: (error: unknown) => {
      toast.error(extractApiError(error, 'Failed to remove connection'));
    },
  });

  const blockMutation = useMutation({
    mutationFn: (userId: string) => blocksApi.block(userId),
    onSuccess: () => {
      invalidateConnections();
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      toast.success('User blocked');
    },
    onError: (error: unknown) => {
      toast.error(extractApiError(error, 'Failed to block user'));
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => blocksApi.unblock(userId),
    onSuccess: () => {
      invalidateConnections();
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      toast.success('User unblocked');
    },
    onError: (error: unknown) => {
      toast.error(extractApiError(error, 'Failed to unblock user'));
    },
  });

  return {
    incoming: incomingQuery.data ?? [],
    outgoing: outgoingQuery.data ?? [],
    isLoading: incomingQuery.isLoading || outgoingQuery.isLoading,
    sendPing: requestMutation.mutateAsync,
    acceptPing: acceptMutation.mutateAsync,
    declinePing: declineMutation.mutateAsync,
    cancelPing: revokeMutation.mutateAsync,
    blockUser: blockMutation.mutateAsync,
    unblockUser: unblockMutation.mutateAsync,
    isSending: requestMutation.isPending,
    isAccepting: acceptMutation.isPending,
    isDeclining: declineMutation.isPending,
    isCancelling: revokeMutation.isPending,
    isBlocking: blockMutation.isPending,
    isUnblocking: unblockMutation.isPending,
  };
}
