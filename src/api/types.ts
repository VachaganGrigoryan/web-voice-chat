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

export type MessageType = 'voice' | 'text' | 'image' | 'emoji' | 'sticker' | 'video';
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
  last_thread_reply_at: string | null;
  reactions: MessageReactionGroup[];
  status: 'sent' | 'delivered' | 'read';
  edited_at: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageReactionsUpdate {
  message_id: string;
  conversation_id: string;
  reactions: MessageReactionGroup[];
  updated_at: string;
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
