import { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { EVENTS } from './events';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageDoc } from '@/api/types';
import { socketClient } from './socketClient';
import { useAuthStore } from '@/store/authStore';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: string[];
  typingUsers: Record<string, boolean>; // userId -> isTyping
  setSocket: (socket: Socket | null) => void;
  setIsConnected: (isConnected: boolean) => void;
  setOnlineUsers: (users: string[]) => void;
  setTypingUser: (userId: string, isTyping: boolean) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  isConnected: false,
  onlineUsers: [],
  typingUsers: {},
  setSocket: (socket) => set({ socket }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
  setTypingUser: (userId, isTyping) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [userId]: isTyping },
    })),
}));

// Sync socket events to store
const setupSocketSync = () => {
  socketClient.onConnect((socket) => {
    const { setIsConnected, setOnlineUsers, setTypingUser, setSocket } = useSocketStore.getState();
    
    setSocket(socket);
    setIsConnected(true);

    socket.on(EVENTS.DISCONNECT, () => {
      setIsConnected(false);
    });

    socket.on(EVENTS.PRESENCE_UPDATE, (payload: any) => {
      // Assuming payload is { user_id: string, status: 'online' | 'offline' } or similar
      // The prompt says "existing presence payload shape"
      if (payload.status === 'online') {
        const currentUsers = useSocketStore.getState().onlineUsers;
        if (!currentUsers.includes(payload.user_id)) {
          setOnlineUsers([...currentUsers, payload.user_id]);
        }
      } else if (payload.status === 'offline') {
        const currentUsers = useSocketStore.getState().onlineUsers;
        setOnlineUsers(currentUsers.filter((id) => id !== payload.user_id));
      }
    });

    // Keep these if the backend still sends them separately, otherwise presence_update covers it
    socket.on(EVENTS.USER_ONLINE, ({ user_id }: { user_id: string }) => {
      const currentUsers = useSocketStore.getState().onlineUsers;
      if (!currentUsers.includes(user_id)) {
        setOnlineUsers([...currentUsers, user_id]);
      }
    });

    socket.on(EVENTS.USER_OFFLINE, ({ user_id }: { user_id: string }) => {
      const currentUsers = useSocketStore.getState().onlineUsers;
      setOnlineUsers(currentUsers.filter((id) => id !== user_id));
    });

    socket.on(EVENTS.SERVER_TYPING_START, ({ from }: { from: string }) => {
      setTypingUser(from, true);
    });

    socket.on(EVENTS.SERVER_TYPING_STOP, ({ from }: { from: string }) => {
      setTypingUser(from, false);
    });
  });
};

// Initialize sync
setupSocketSync();

// Export getSocket for legacy compatibility if needed
export const getSocket = () => socketClient.getSocket();

// Hooks
export const useSocket = () => {
  const { socket, isConnected } = useSocketStore();
  return { socket, isConnected };
};

export const usePresence = () => {
  const onlineUsers = useSocketStore((state) => state.onlineUsers);
  const setOnlineUsers = useSocketStore((state) => state.setOnlineUsers);
  return { onlineUsers, setOnlineUsers };
};

export const useTypingIndicator = (userId?: string) => {
  const typingUsers = useSocketStore((state) => state.typingUsers);
  const socket = useSocketStore((state) => state.socket);
  
  const isTyping = userId ? !!typingUsers[userId] : false;
  
  const startTyping = (receiverId: string) => {
    socket?.emit(EVENTS.CLIENT_TYPING_START, { to: receiverId });
  };

  const stopTyping = (receiverId: string) => {
    socket?.emit(EVENTS.CLIENT_TYPING_STOP, { to: receiverId });
  };

  return { isTyping, typingUsers, startTyping, stopTyping };
};

// Helper for notifications
const showNotification = (message: MessageDoc) => {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification('New Message', {
      body: `New message from ${message.sender_id}`,
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('New Message', {
          body: `New message from ${message.sender_id}`,
        });
      }
    });
  }
};

export const useRealtimeMessages = (selectedUser: string | null) => {
  const queryClient = useQueryClient();
  const { userId: currentUserId } = useAuthStore();
  const { socket } = useSocketStore();

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: MessageDoc) => {
      const conversationPartnerId = message.sender_id === currentUserId 
        ? message.receiver_id 
        : message.sender_id;

      queryClient.setQueryData(['messages', conversationPartnerId], (old: any) => {
        if (!old) return { pages: [{ data: [message], meta: { next_cursor: null } }], pageParams: [undefined] };
        
        const newPages = [...old.pages];
        newPages[0] = {
          ...newPages[0],
          data: [message, ...newPages[0].data],
        };
        
        return {
          ...old,
          pages: newPages,
        };
      });

      if (message.receiver_id === currentUserId) {
        socket.emit(EVENTS.MESSAGE_DELIVERED, { message_id: message.id });
        
        if (document.hidden || message.sender_id !== selectedUser) {
          showNotification(message);
        }
      }
    };

    const handleMessageStatus = ({ message_id, status }: { message_id: string, status: 'delivered' | 'read' }) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    };

    socket.on(EVENTS.RECEIVE_MESSAGE, handleReceiveMessage);
    socket.on(EVENTS.MESSAGE_STATUS, handleMessageStatus);

    return () => {
      socket.off(EVENTS.RECEIVE_MESSAGE, handleReceiveMessage);
      socket.off(EVENTS.MESSAGE_STATUS, handleMessageStatus);
    };
  }, [queryClient, currentUserId, socket, selectedUser]);
};
