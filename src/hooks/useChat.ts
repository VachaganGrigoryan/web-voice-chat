import { useState, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { messagesApi, realtimeApi } from '@/api/endpoints';
import { useSocket, usePresence, useRealtimeMessages } from '@/socket/socket';

export const useChat = () => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Initialize socket and subscriptions
  useSocket();
  useRealtimeMessages(selectedUser);
  const { onlineUsers, setOnlineUsers } = usePresence();

  // Initial fetch of online users (fallback/initial population)
  useQuery({
    queryKey: ['onlineUsers'],
    queryFn: async () => {
      const response = await realtimeApi.getOnlineUsers();
      setOnlineUsers(response.data.data);
      return response.data.data;
    },
    // We rely on socket events for updates, but this fetches initial state
    staleTime: Infinity, 
  });

  const {
    data: messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['messages', selectedUser],
    queryFn: async ({ pageParam }) => {
      if (!selectedUser) return { data: [], meta: { next_cursor: null } };
      const response = await messagesApi.getHistory(selectedUser, 20, pageParam as string | undefined);
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor,
    enabled: !!selectedUser,
    initialPageParam: undefined,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await messagesApi.uploadVoice(formData);
      return response.data.data;
    },
    onSuccess: (newMessage) => {
      if (selectedUser) {
        queryClient.setQueryData(['messages', selectedUser], (old: any) => {
          if (!old) return { pages: [{ data: [newMessage], meta: { next_cursor: null } }], pageParams: [undefined] };
          
          const newPages = [...old.pages];
          newPages[0] = {
            ...newPages[0],
            data: [newMessage, ...newPages[0].data],
          };
          
          return {
            ...old,
            pages: newPages,
          };
        });
      }
    },
  });

  return {
    selectedUser,
    setSelectedUser,
    onlineUsers,
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,
  };
};
