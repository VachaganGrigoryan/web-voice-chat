export interface AvatarMeta {
  storage: string;
  key: string;
  url: string;
  mime: string;
  size_bytes: number;
}

export interface User {
  id: string;
  email: string;
  is_verified: boolean;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar: AvatarMeta | null;
  is_private: boolean;
  default_discovery_enabled: boolean;
  last_seen_at: string | null;
  username_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MediaMeta {
  storage: string;
  key: string;
  url: string;
  mime: string;
  size_bytes: number;
  duration_ms?: number | null;
}

export type MessageType = 'voice' | 'text' | 'image' | 'emoji' | 'sticker' | 'video' | 'file';
export type ReplyMode = 'quote' | 'thread';

export interface ReplyPreview {
  message_id: string;
  sender_id: string;
  type: MessageType;
  text: string | null;
  is_deleted: boolean;
}

export interface MessageReactionGroup {
  emoji: string;
  user_ids: string[];
  count: number;
  updated_at: string;
}

export interface ThreadSummary {
  thread_root_id: string;
  thread_reply_count: number;
  last_thread_reply_at: string | null;
}

export interface MessageDoc {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  type: MessageType;
  text: string | null;
  media: MediaMeta | null;
  reply_mode: ReplyMode | null;
  reply_to_message_id: string | null;
  thread_root_id: string | null;
  reply_preview: ReplyPreview | null;
  is_thread_root: boolean;
  thread_reply_count: number;
  thread_unread_count?: number;
  last_thread_reply_at: string | null;
  reactions: MessageReactionGroup[];
  status: 'sent' | 'delivered' | 'read';
  edited_at: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  delivered_at: string | null;
  read_at: string | null;
  client_batch_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageReactionsUpdate {
  message_id: string;
  conversation_id: string;
  reactions: MessageReactionGroup[];
  updated_at: string;
}

export interface MessageDeletedEvent {
  message_id: string;
  conversation_id: string;
  actor_user_id: string;
  deleted_for_everyone: boolean;
  hidden_for_me: boolean;
  deleted_media: boolean;
  updated_at?: string | null;
}

export interface ConversationReadUpdate {
  updated_count: number;
}

export type PingStatus =
  | 'none'
  | 'incoming_pending'
  | 'outgoing_pending'
  | 'accepted'
  | 'declined'
  | 'blocked';

export interface UserSummary {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar: AvatarMeta | null;
  is_online: boolean;
  can_ping: boolean;
  chat_allowed: boolean;
  ping_status: PingStatus;
}

export interface Conversation {
  conversation_id: string;
  peer_user: UserSummary;
  last_message: {
    id: string;
    type: string;
    text: string | null;
    media: MediaMeta | null;
    status: string;
    created_at: string;
  } | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface DiscoveredUser extends UserSummary {
  discovered_via: string;
}

export interface Ping {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'blocked';
  created_at: string;
  updated_at: string;
  responded_at: string | null;
}

export interface PingItem {
  ping: Ping;
  peer: UserSummary;
}

export type PingResponse = PingItem;

export type CallType = 'audio' | 'video';
export type CallStatus =
  | 'ringing'
  | 'accepted'
  | 'connecting'
  | 'active'
  | 'reconnecting'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'ended';

export interface CallPeerUserSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar: Record<string, any> | null;
  is_online: boolean;
}

export interface IceServer {
  urls: string | string[];
  username: string | null;
  credential: string | null;
}

export interface CallDoc {
  id: string;
  caller_user_id: string;
  callee_user_id: string;
  participant_user_ids: [string, string] | string[];
  type: CallType;
  status: CallStatus;
  room_id: string;
  created_at: string;
  updated_at: string;
  answered_at: string | null;
  ended_at: string | null;
  expires_at: string | null;
  reconnect_deadline_at: string | null;
  disconnected_user_ids: string[];
  is_live: boolean;
}

export interface CreateCallRequest {
  callee_user_id: string;
  type: CallType;
}

export interface AcceptCallRequest {
  socket_id: string;
}

export interface CallSession {
  call: CallDoc;
  peer_user: CallPeerUserSummary;
  ice_servers: IceServer[];
}

export interface CallActionPayload {
  call_id: string;
}

export interface CallOfferPayload extends CallActionPayload {
  sdp: any;
}

export interface CallAnswerPayload extends CallActionPayload {
  sdp: any;
}

export interface CallIceCandidatePayload extends CallActionPayload {
  candidate: any;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    next_cursor: string | null;
    limit: number;
    total: number | null;
  };
  request_id?: string;
}

export interface SuccessResponse<T> {
  success: boolean;
  data: T;
}

export interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details: any;
  };
}
