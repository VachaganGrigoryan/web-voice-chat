import type {
  OpenApiCallStatus,
  OpenApiCallType,
  OpenApiDiscoveryVia,
  OpenApiMediaKind,
  OpenApiMediaUploadType,
  OpenApiMessageType,
  OpenApiPingStatus,
  OpenApiPreviewMediaKind,
  OpenApiReplyMode,
} from './openapi-contract';

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
  username: string;
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

export interface SelectedUserProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar: AvatarMeta | null;
  is_online: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthChallengeResponse {
  method: 'email';
  identifier: string;
  message: string;
}

export interface MessageResponse {
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown | null;
}

export interface ErrorResponse {
  success: false;
  error: ApiError;
  request_id?: string | null;
}

export interface SocketErrorPayload {
  code: string;
  message: string;
}

export interface RegenerateCodeResponse {
  code: string;
  token_preview: string;
  expires_at: string | null;
}

export interface CreateInviteLinkResponse {
  token: string;
  url: string;
  expires_at: string | null;
  max_uses: number | null;
}

export interface PasskeyDeleteResult {
  deleted: boolean;
}

export interface PasskeyResponse {
  credential_id: string;
  nickname: string | null;
  transports: string[] | null;
  device_type: string | null;
  backed_up: boolean | null;
  aaguid: string | null;
  created_at: string;
  last_used_at: string | null;
}

export type PasskeyAuthenticationOptionsPayload = Record<string, unknown>;
export type PasskeyRegistrationOptionsPayload = Record<string, unknown> & {
  nickname?: string | null;
};

export interface MediaMeta {
  kind: OpenApiMediaKind;
  storage: string;
  key: string;
  url: string;
  mime: string;
  size_bytes: number;
  duration_ms?: number | null;
}

export type MessageType = OpenApiMessageType;
export type MediaKind = OpenApiMediaKind;
export type MediaUploadType = OpenApiMediaUploadType;
export type PreviewMediaKind = OpenApiPreviewMediaKind;
export type ReplyMode = OpenApiReplyMode;
export type CallDirection = 'incoming' | 'outgoing';

export interface CallMeta {
  call_id: string;
  type: OpenApiCallType;
  status: Extract<OpenApiCallStatus, 'rejected' | 'cancelled' | 'expired' | 'ended'>;
  caller_user_id: string;
  callee_user_id: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_ms: number;
}

export interface ReplyPreview {
  message_id: string;
  sender_id: string;
  type: MessageType;
  media_kind?: MediaKind | null;
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
  conversation_id: string;
  is_thread_root: boolean;
  thread_reply_count: number;
  last_thread_reply_at: string | null;
}

export type EncryptionMode = 'none' | 'e2ee';
export type ContentType = MessageType | 'system';

export interface MessagePlaintext {
  text: string | null;
  media: MediaMeta | null;
  call: CallMeta | null;
}

/**
 * Encryption-ready message body envelope. When `encryption === 'none'` the body
 * lives in `plaintext`; `ciphertext`/`envelope` are reserved for future E2EE.
 */
export interface MessageContent {
  encryption: EncryptionMode;
  type: ContentType;
  plaintext: MessagePlaintext | null;
  ciphertext: string | null;
  envelope: Record<string, unknown> | null;
}

export interface MessageDoc {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  content?: MessageContent | null;
  receipt_summary: {
    recipient_count: number;
    delivered_count: number;
    read_count: number;
  };
  reply_mode: ReplyMode | null;
  reply_to_message_id: string | null;
  thread_root_id: string | null;
  reply_preview: ReplyPreview | null;
  is_thread_root: boolean;
  thread_reply_count: number;
  thread_unread_count?: number;
  last_thread_reply_at: string | null;
  reactions: MessageReactionGroup[];
  edited_at: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
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

export interface DeleteMessageResponse {
  message_id: string;
  conversation_id: string;
  actor_user_id: string;
  deleted_for_everyone: boolean;
  hidden_for_me: boolean;
  deleted_media: boolean;
}

export interface MessageDeletedEvent extends DeleteMessageResponse {
  updated_at?: string | null;
}

export interface ConversationReadUpdate {
  updated_count?: number;
  [key: string]: unknown;
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
  is_online: boolean | null;
  can_ping?: boolean;
  chat_allowed?: boolean;
  ping_status?: PingStatus;
  is_ghost?: boolean;
}

export interface ClearConversationResponse {
  conversation_id: string;
  cleared_count: number;
}

export interface DeleteConversationResponse {
  conversation_id: string;
  cleared_count: number;
  ping_deleted: boolean;
}

export interface DeleteCallHistoryResponse {
  deleted_count: number;
  hidden_count: number;
}

export type ConversationType = 'dm' | 'group';

export interface Conversation {
  conversation_id: string;
  peer_user?: UserSummary | null;
  last_message: {
    id: string;
    type: ContentType;
    text: string | null;
    media: MediaMeta | null;
    call: CallMeta | null;
    created_at: string;
  } | null;
  last_message_at: string | null;
  unread_count: number;
  /** First-class conversation entity fields (present from the /conversations inbox). */
  id: string;
  type: ConversationType;
  encryption: EncryptionMode;
  participant_ids: string[];
  participant_users: UserSummary[];
  created_by: string;
  title: string | null;
  last_message_preview: {
    message_id: string;
    sender_id: string;
    type: ContentType;
    text: string | null;
    created_at: string;
  } | null;
  created_at: string;
  updated_at: string;
}

/** Lean conversation entity returned by POST /conversations (create-or-get DM). */
export interface ConversationEntity {
  id: string;
  type: ConversationType;
  encryption: EncryptionMode;
  participant_ids: string[];
  created_by: string;
  title: string | null;
  last_message_at: string | null;
  last_message_preview: {
    message_id: string;
    sender_id: string;
    type: ContentType;
    text: string | null;
    created_at: string;
  } | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

// --- E2EE scaffolding (device + prekey distribution; no crypto yet) ---

export interface DeviceView {
  id: string;
  user_id: string;
  device_id: string;
  name: string | null;
  platform: string | null;
  identity_public_key: string | null;
  signing_public_key: string | null;
  registration_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PreKeyInput {
  key_id: number;
  public_key: string;
  signature?: string | null;
  one_time: boolean;
}

export interface PreKeyBundle {
  user_id: string;
  device_id: string;
  identity_public_key: string | null;
  signing_public_key: string | null;
  registration_id: number | null;
  one_time_prekey: PreKeyInput | null;
}

export interface DiscoveredUser extends UserSummary {
  discovered_via: OpenApiDiscoveryVia | null;
}

export interface Ping {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: OpenApiPingStatus;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
}

export interface PingListItem {
  ping: Ping;
  peer: {
    id: string;
    username: string;
    display_name: string | null;
    avatar: AvatarMeta | null;
    is_online: boolean;
  };
}

export type PingItem = PingListItem;
export type PingResponse = Ping;

export type CallType = OpenApiCallType;
export type CallStatus = OpenApiCallStatus;

export interface CallPeerUserSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar: AvatarMeta | null;
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
  participant_states: Record<string, CallParticipantState>;
  is_live: boolean;
}

export type CallParticipantRole = 'caller' | 'callee';
export type CallParticipantJoinState = 'waiting' | 'joined' | 'disconnected';
export type CallParticipantUpdateReason =
  | 'joined'
  | 'media_updated'
  | 'disconnected'
  | 'resumed';

export interface CallParticipantState {
  role: CallParticipantRole;
  join_state: CallParticipantJoinState;
  audio_enabled: boolean;
  video_enabled: boolean;
  updated_at: string;
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

export type CallTerminalPayload = CallDoc | CallSession;

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

export interface CallMediaStatePayload extends CallActionPayload {
  audio_enabled?: boolean;
  video_enabled?: boolean;
}

export interface CallParticipantUpdatedEvent extends CallSession {
  actor_user_id: string;
  reason: CallParticipantUpdateReason;
}

export interface CallHistoryItem {
  id: string;
  peer_user: CallPeerUserSummary;
  direction: CallDirection;
  type: CallType;
  status: Extract<CallStatus, 'rejected' | 'cancelled' | 'expired' | 'ended'>;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_ms: number;
  message_id: string | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    cursor?: string | null;
    next_cursor: string | null;
    limit: number | null;
    total: number | null;
  };
  request_id?: string | null;
}

export interface SuccessResponse<T> {
  success: boolean;
  data: T;
  request_id?: string | null;
}
