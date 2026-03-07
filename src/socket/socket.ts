import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import { useAuthStore } from '@/store/authStore';
import { EVENTS, SOCKET_URL } from './events';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageDoc } from '@/api/types';

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

let socketInstance: Socket | null = null;

export const initializeSocket = () => {
  const token = useAuthStore.getState().accessToken;

  if (!token) {
    console.warn('Cannot connect socket: No token');
    return null;
  }

  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.auth = { token };
    socketInstance.connect();
    return socketInstance;
  }

  socketInstance = io(SOCKET_URL, {
    path: '/socket.io',
    auth: {
      token,
    },
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
  });

  const { setIsConnected, setOnlineUsers, setTypingUser } = useSocketStore.getState();

  socketInstance.on(EVENTS.CONNECT, () => {
    console.log('Socket connected:', socketInstance?.id);
    setIsConnected(true);
  });

  socketInstance.on(EVENTS.DISCONNECT, () => {
    console.log('Socket disconnected');
    setIsConnected(false);
  });

  socketInstance.on(EVENTS.CONNECT_ERROR, (err) => {
    console.error('Socket connection error:', err);
    setIsConnected(false);
  });

  // Presence events
  socketInstance.on(EVENTS.USER_ONLINE, ({ user_id }: { user_id: string }) => {
    const currentUsers = useSocketStore.getState().onlineUsers;
    if (!currentUsers.includes(user_id)) {
      setOnlineUsers([...currentUsers, user_id]);
    }
  });

  socketInstance.on(EVENTS.USER_OFFLINE, ({ user_id }: { user_id: string }) => {
    const currentUsers = useSocketStore.getState().onlineUsers;
    setOnlineUsers(currentUsers.filter((id) => id !== user_id));
  });

  // Typing events
  socketInstance.on(EVENTS.SERVER_TYPING_START, ({ user_id }: { user_id: string }) => {
    setTypingUser(user_id, true);
  });

  socketInstance.on(EVENTS.SERVER_TYPING_STOP, ({ user_id }: { user_id: string }) => {
    setTypingUser(user_id, false);
  });

  useSocketStore.getState().setSocket(socketInstance);
  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    useSocketStore.getState().setSocket(null);
    useSocketStore.getState().setIsConnected(false);
  }
};

export const getSocket = () => socketInstance;

// Hooks

export const useSocket = () => {
  const { socket, isConnected } = useSocketStore();
  
  useEffect(() => {
    if (!socket) {
      initializeSocket();
    }
  }, [socket]);

  return { socket, isConnected };
};

export const usePresence = () => {
  const onlineUsers = useSocketStore((state) => state.onlineUsers);
  const setOnlineUsers = useSocketStore((state) => state.setOnlineUsers);
  return { onlineUsers, setOnlineUsers };
};

export const useTypingIndicator = (userId?: string) => {
  const typingUsers = useSocketStore((state) => state.typingUsers);
  
  const isTyping = userId ? !!typingUsers[userId] : false;
  
  const startTyping = (receiverId: string) => {
    socketInstance?.emit(EVENTS.CLIENT_TYPING_START, { receiver_id: receiverId });
  };

  const stopTyping = (receiverId: string) => {
    socketInstance?.emit(EVENTS.CLIENT_TYPING_STOP, { receiver_id: receiverId });
  };

  return { isTyping, typingUsers, startTyping, stopTyping };
};

// Helper for notifications
const showNotification = (message: MessageDoc) => {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification('New Voice Message', {
      body: `New message from ${message.sender_id}`,
      // You might want to add an icon here
      // icon: '/icon.png'
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('New Voice Message', {
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

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: MessageDoc) => {
      // Determine conversation partner ID
      const conversationPartnerId = message.sender_id === currentUserId 
        ? message.receiver_id 
        : message.sender_id;

      // Update React Query cache
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

      // Emit delivery receipt if we are the receiver
      if (message.receiver_id === currentUserId) {
        socket.emit(EVENTS.VOICE_MESSAGE_DELIVERED, { message_id: message.id });
        
        // Show notification if:
        // 1. The app is in background (document.hidden)
        // OR
        // 2. The message is NOT from the currently selected user
        if (document.hidden || message.sender_id !== selectedUser) {
          showNotification(message);
        }
      }
    };

    const handleMessageStatus = ({ message_id, status }: { message_id: string, status: 'delivered' | 'read' }) => {
      // We need to find the message in the cache and update it
      // This is tricky because we don't know which conversation it belongs to easily
      // So we might need to invalidate queries or iterate through active conversations
      
      // For simplicity, we'll invalidate all message queries for now, or try to update if we can find it
      // A better approach would be to have a normalized cache or know the conversation ID
      
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    };

    socket.on(EVENTS.RECEIVE_VOICE_MESSAGE, handleReceiveMessage);
    socket.on(EVENTS.VOICE_MESSAGE_STATUS, handleMessageStatus);

    return () => {
      socket.off(EVENTS.RECEIVE_VOICE_MESSAGE, handleReceiveMessage);
      socket.off(EVENTS.VOICE_MESSAGE_STATUS, handleMessageStatus);
    };
  }, [queryClient, currentUserId, socket, selectedUser]);
};
