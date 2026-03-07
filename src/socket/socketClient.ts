import { io, Socket } from 'socket.io-client';
import { tokenStore } from '@/auth/tokenStore';
import { EVENTS, SOCKET_URL } from '@/socket/events';

class SocketClient {
  private socket: Socket | null = null;
  private isConnecting = false;

  connect() {
    const token = tokenStore.getAccessToken();
    if (!token) {
      console.warn('SocketClient: No token available, cannot connect');
      return;
    }

    if (this.socket?.connected) {
      return;
    }

    if (this.socket) {
      this.socket.auth = { token };
      this.socket.connect();
      return;
    }

    this.socket = io(SOCKET_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
    });

    this.setupListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  reconnect() {
    this.disconnect();
    this.connect();
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  private onConnectCallback: ((socket: Socket) => void) | null = null;

  onConnect(callback: (socket: Socket) => void) {
    this.onConnectCallback = callback;
    if (this.socket?.connected) {
      callback(this.socket);
    }
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on(EVENTS.CONNECT, () => {
      console.log('Socket connected:', this.socket?.id);
      if (this.onConnectCallback && this.socket) {
        this.onConnectCallback(this.socket);
      }
    });

    this.socket.on(EVENTS.DISCONNECT, () => {
      console.log('Socket disconnected');
    });

    this.socket.on(EVENTS.CONNECT_ERROR, (err) => {
      console.error('Socket connection error:', err);
    });
  }
}

export const socketClient = new SocketClient();
