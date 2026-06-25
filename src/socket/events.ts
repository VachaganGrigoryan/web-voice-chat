export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://voice-chat.vachagan.dev';

export const EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  ERROR: 'error',

  // Client -> Server
  SEND_MESSAGE: 'send_message',
  MESSAGE_DELIVERED: 'message_delivered',
  MESSAGE_READ: 'message_read',
  CONVERSATION_READ: 'conversation_read',
  CLIENT_TYPING_START: 'typing_start',
  CLIENT_TYPING_STOP: 'typing_stop',
  CALL_JOIN: 'call.join',
  CALL_MEDIA_STATE: 'call.media_state',
  CALL_OFFER: 'call.offer',
  CALL_ANSWER: 'call.answer',
  CALL_ICE_CANDIDATE: 'call.ice_candidate',
  CALL_CONNECTED: 'call.connected',
  CALL_HANGUP: 'call.hangup',
  CALL_REJECT: 'call.reject',
  CALL_RESUME: 'call.resume',

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
  CALL_INCOMING: 'call.incoming',
  CALL_ACCEPTED: 'call.accepted',
  CALL_PARTICIPANT_UPDATED: 'call.participant_updated',
  CALL_REJECTED: 'call.rejected',
  CALL_RECOVERY_AVAILABLE: 'call.recovery_available',
  CALL_RECONNECTING: 'call.reconnecting',
  CALL_RESUMED: 'call.resumed',
  CALL_ENDED: 'call.ended',
} as const;
