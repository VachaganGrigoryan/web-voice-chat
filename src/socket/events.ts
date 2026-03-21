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
  CONVERSATION_READ: 'conversation_read',
  CLIENT_TYPING_START: 'typing_start',
  CLIENT_TYPING_STOP: 'typing_stop',

  // Server -> Client
  RECEIVE_MESSAGE: 'receive_message',
  MESSAGE_STATUS: 'message_status',
  MESSAGE_ACK: 'message_ack',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_REACTED: 'message_reacted',
  THREAD_REPLY_CREATED: 'thread_reply_created',
  THREAD_SUMMARY_UPDATED: 'thread_summary_updated',
  PRESENCE_UPDATE: 'presence_update',
  USER_ONLINE: 'user_online', // Keeping these if they are part of presence_update or separate
  USER_OFFLINE: 'user_offline',
  SERVER_TYPING_START: 'typing_start',
  SERVER_TYPING_STOP: 'typing_stop',
  // Pings
  PING_RECEIVED: 'ping_received',
  PING_ACCEPTED: 'ping_accepted',
  PING_DECLINED: 'ping_declined',
  PING_CANCELLED: 'ping_cancelled',
  USER_BLOCKED: 'user_blocked',
  CHAT_PERMISSION_UPDATED: 'chat_permission_updated',
} as const;
