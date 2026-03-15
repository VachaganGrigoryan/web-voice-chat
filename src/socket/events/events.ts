export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://voice-chat.vachagan.dev';

export const EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',

  // Client -> Server
  SEND_MESSAGE: 'send_message',
  MESSAGE_DELIVERED: 'message_delivered',
  MESSAGE_READ: 'message_read',
  CLIENT_TYPING_START: 'typing_start',
  CLIENT_TYPING_STOP: 'typing_stop',

  // Server -> Client
  RECEIVE_MESSAGE: 'receive_message',
  MESSAGE_STATUS: 'message_status',
  MESSAGE_ACK: 'message_ack',
  PRESENCE_UPDATE: 'presence_update',
  USER_ONLINE: 'user_online', // Keeping these if they are part of presence_update or separate
  USER_OFFLINE: 'user_offline',
  SERVER_TYPING_START: 'typing_start',
  SERVER_TYPING_STOP: 'typing_stop',
  // Pings
  PING_RECEIVED: 'ping_received',
  PING_ACCEPTED: 'ping_accepted',
  PING_DECLINED: 'ping_declined',
  CHAT_PERMISSION_UPDATED: 'chat_permission_updated',
} as const;
