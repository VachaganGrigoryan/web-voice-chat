import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pingsApi } from '@/api/endpoints';
import { useEffect } from 'react';
import { useSocketStore } from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { toast } from 'sonner';

export function usePings() {
  const queryClient = useQueryClient();
  const { socket } = useSocketStore();

  useEffect(() => {
    if (!socket) return;

    const handlePingUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['pings', 'incoming'] });
      queryClient.invalidateQueries({ queryKey: ['pings', 'outgoing'] });
    };

    const handleChatPermission = () => {
      queryClient.invalidateQueries({ queryKey: ['pings', 'incoming'] });
      queryClient.invalidateQueries({ queryKey: ['pings', 'outgoing'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    socket.on(EVENTS.PING_RECEIVED, handlePingUpdate);
    socket.on(EVENTS.PING_ACCEPTED, handleChatPermission);
    socket.on(EVENTS.PING_DECLINED, handlePingUpdate);
    socket.on(EVENTS.PING_CANCELLED, handlePingUpdate);
    socket.on(EVENTS.USER_BLOCKED, handleChatPermission);
    socket.on(EVENTS.CHAT_PERMISSION_UPDATED, handleChatPermission);

    return () => {
      socket.off(EVENTS.PING_RECEIVED, handlePingUpdate);
      socket.off(EVENTS.PING_ACCEPTED, handleChatPermission);
      socket.off(EVENTS.PING_DECLINED, handlePingUpdate);
      socket.off(EVENTS.PING_CANCELLED, handlePingUpdate);
      socket.off(EVENTS.USER_BLOCKED, handleChatPermission);
      socket.off(EVENTS.CHAT_PERMISSION_UPDATED, handleChatPermission);
    };
  }, [socket, queryClient]);

  const incomingQuery = useQuery({
    queryKey: ['pings', 'incoming'],
    queryFn: () => pingsApi.getIncoming().then(res => res.data.data),
  });

  const outgoingQuery = useQuery({
    queryKey: ['pings', 'outgoing'],
    queryFn: () => pingsApi.getOutgoing().then(res => res.data.data),
  });

  const getErrorMessage = (error: any, fallback: string) => {
    const errorData = error.response?.data?.error;
    if (typeof errorData === 'string') return errorData;
    if (errorData?.message) return errorData.message;
    return fallback;
  };

  const sendPingMutation = useMutation({
    mutationFn: (userId: string) => pingsApi.sendPing(userId).then(res => res.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pings', 'outgoing'] });
      toast.success('Ping sent successfully');
    },
    onError: (error: any) => {
      if (error.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['pings', 'outgoing'] });
        toast.info('Ping already sent or relationship exists');
        return;
      }
      toast.error(getErrorMessage(error, 'Failed to send ping'));
    }
  });

  const acceptPingMutation = useMutation({
    mutationFn: (pingId: string) => pingsApi.acceptPing(pingId).then(res => res.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pings', 'incoming'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Ping accepted');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to accept ping'));
    }
  });

  const declinePingMutation = useMutation({
    mutationFn: (pingId: string) => pingsApi.declinePing(pingId).then(res => res.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pings', 'incoming'] });
      queryClient.invalidateQueries({ queryKey: ['pings', 'outgoing'] });
      toast.success('Ping declined');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to decline ping'));
    }
  });

  const cancelPingMutation = useMutation({
    mutationFn: (pingId: string) => pingsApi.cancelPing(pingId).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pings', 'incoming'] });
      queryClient.invalidateQueries({ queryKey: ['pings', 'outgoing'] });
      toast.success('Ping cancelled');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to cancel ping'));
    }
  });

  const blockUserMutation = useMutation({
    mutationFn: (peerUserId: string) => pingsApi.blockUser(peerUserId).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pings', 'incoming'] });
      queryClient.invalidateQueries({ queryKey: ['pings', 'outgoing'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('User blocked');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to block user'));
    }
  });

  return {
    incoming: Array.isArray(incomingQuery.data) ? incomingQuery.data : [],
    outgoing: Array.isArray(outgoingQuery.data) ? outgoingQuery.data : [],
    isLoading: incomingQuery.isLoading || outgoingQuery.isLoading,
    sendPing: sendPingMutation.mutateAsync,
    acceptPing: acceptPingMutation.mutateAsync,
    declinePing: declinePingMutation.mutateAsync,
    cancelPing: cancelPingMutation.mutateAsync,
    blockUser: blockUserMutation.mutateAsync,
    isSending: sendPingMutation.isPending,
    isAccepting: acceptPingMutation.isPending,
    isDeclining: declinePingMutation.isPending,
    isCancelling: cancelPingMutation.isPending,
    isBlocking: blockUserMutation.isPending,
  };
}
