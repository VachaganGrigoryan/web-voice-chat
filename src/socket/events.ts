export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://voice-chat.vachagan.dev';

export const EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',

  // Client -> Server
  VOICE_MESSAGE_DELIVERED: 'voice_message_delivered',
  VOICE_MESSAGE_READ: 'voice_message_read',
  CLIENT_TYPING_START: 'typing_start',
  CLIENT_TYPING_STOP: 'typing_stop',

  // Server -> Client
  RECEIVE_VOICE_MESSAGE: 'receive_voice_message',
  VOICE_MESSAGE_STATUS: 'voice_message_status',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  SERVER_TYPING_START: 'typing_start',
  SERVER_TYPING_STOP: 'typing_stop',
} as const;
