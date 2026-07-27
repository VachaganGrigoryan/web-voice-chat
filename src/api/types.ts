import type {
  OpenApiCallStatus,
  OpenApiCallType,
  OpenApiDiscoveryVia,
  OpenApiMediaKind,
  OpenApiMediaUploadType,
  OpenApiMessageState,
  OpenApiMessageType,
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
  main_channel_id?: string | null;
  default_discovery_enabled: boolean;
  last_seen_at: string | null;
  username_updated_at: string | null;
  status_emoji?: string | null;
  status_text?: string | null;
  status_expires_at?: string | null;
  pronouns?: string | null;
  timezone?: string | null;
  dnd_from?: string | null;
  dnd_to?: string | null;
  notification_keywords?: string[];
  created_at: string;
  updated_at: string;
}

export interface NotificationView {
  id: string;
  user_id: string;
  kind: string;
  actor_user_id: string;
  resource_type: 'user' | 'conversation' | 'channel' | 'space';
  resource_id: string;
  message_id: string | null;
  read_at: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PushTokenView {
  id: string;
  user_id: string;
  device_id: string | null;
  platform: 'ios' | 'android' | 'web';
  token: string;
  created_at: string;
  updated_at: string;
}

export interface SelectedUserProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar: AvatarMeta | null;
  main_channel_id?: string | null;
  status_emoji?: string | null;
  status_text?: string | null;
  status_expires_at?: string | null;
  pronouns?: string | null;
  timezone?: string | null;
  is_online: boolean;
  presence_state?: PresenceState;
  last_seen_at?: string | null;
  profile_visibility: 'full' | 'limited';
  relationship: ConnectionState;
  // Populated only when requested via `?include=contact_details` on an accepted contact.
  connection_timestamp?: string | null;
  conversation_id?: string | null;
  shared_conversations?: SharedConversationSummary[];
  shared_spaces?: SharedSpaceSummary[];
}

export type ChannelReadPolicy = 'members' | 'contacts' | 'public';

export interface UserChannelView {
  id: string;
  title: string | null;
  slug: string | null;
  description: string | null;
  visibility: 'private' | 'public';
  posting_policy: 'everyone' | 'admins';
  read_policy: ChannelReadPolicy;
  member_count: number;
  last_message_at: string | null;
  created_at: string;
  is_main: boolean;
}

export type MessageContainerType = 'conversation' | 'channel';

export interface MessageContainerRef {
  container_type: MessageContainerType;
  container_id: string;
}

export type ChannelKind = 'profile' | 'text' | 'announcement';
export type ChannelVisibility = 'public' | 'members' | 'private';
export type ChannelJoinPolicy = 'open' | 'approval' | 'invite_only' | 'closed';
export type ChannelPostingPolicy = 'owner' | 'moderators' | 'members' | 'everyone';
export type ChannelCommentPolicy = 'disabled' | 'followers' | 'members' | 'everyone';

export interface Channel {
  id: string;
  owner: {
    type: 'user' | 'space';
    id: string;
  };
  space_id: string | null;
  kind: ChannelKind;
  slug: string;
  name: string;
  description: string | null;
  avatar: AvatarMeta | null;
  banner: AvatarMeta | null;
  visibility: ChannelVisibility;
  join_policy: ChannelJoinPolicy;
  posting_policy: ChannelPostingPolicy;
  comment_policy: ChannelCommentPolicy;
  tags: string[];
  message_count: number;
  follower_count: number;
  last_message_id: string | null;
  last_activity_at: string | null;
  legacy_conversation_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateChannelRequest {
  name: string;
  slug: string;
  kind?: Exclude<ChannelKind, 'profile'>;
  description?: string | null;
  visibility?: ChannelVisibility;
  join_policy?: ChannelJoinPolicy;
  posting_policy?: ChannelPostingPolicy;
  comment_policy?: ChannelCommentPolicy;
  tags?: string[];
}

export interface UpdateChannelRequest {
  name?: string | null;
  description?: string | null;
  avatar?: AvatarMeta | null;
  banner?: AvatarMeta | null;
  visibility?: ChannelVisibility | null;
  join_policy?: ChannelJoinPolicy | null;
  posting_policy?: ChannelPostingPolicy | null;
  comment_policy?: ChannelCommentPolicy | null;
  tags?: string[] | null;
}

export interface FeedAuthor {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar: AvatarMeta | null;
}

export interface FeedPostView {
  id: string;
  channel_id: string;
  author: FeedAuthor;
  type: MessageType;
  text: string | null;
  attachments: MediaMeta[];
  reactions: MessageReactionGroup[];
  comment_count: number;
  has_thread: boolean;
  is_deleted: boolean;
  created_at: string;
  edited_at: string | null;
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
export type MessageState = OpenApiMessageState;
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
  container_type: MessageContainerType;
  container_id: string;
  /** @deprecated Use `container_id`. Present for conversation compatibility. */
  conversation_id: string;
  is_thread_root: boolean;
  thread_reply_count: number;
  last_thread_reply_at: string | null;
}

export type EncryptionMode = 'none' | 'e2ee';
export type ContentType = MessageType | 'system';

export interface PollRef {
  poll_id: string;
  question: string;
}

export interface MessagePlaintext {
  text: string | null;
  media: MediaMeta | null;
  call: CallMeta | null;
  /** Legacy embedded poll payload; new poll messages link via `poll_ref`. */
  poll?: Record<string, unknown> | null;
  poll_ref?: PollRef | null;
  sticker?: Record<string, unknown> | null;
  location?: Record<string, unknown> | null;
  contact?: Record<string, unknown> | null;
  link_preview?: Record<string, unknown> | null;
}

/**
 * Encryption-ready message body envelope. When `encryption === 'none'` the body
 * lives in `plaintext`; `ciphertext`/`envelope` are reserved for future E2EE.
 */
export interface MessageContent {
  encryption: EncryptionMode;
  type: ContentType;
  plaintext: MessagePlaintext | null;
  attachments: MediaMeta[];
  ciphertext: string | null;
  envelope: Record<string, unknown> | null;
}

export interface RichLocationInput {
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
}

export interface RichContactInput {
  display_name: string;
  user_id?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface RichLinkPreviewInput {
  url: string;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
}

export interface SendRichContentRequest {
  container_type: 'conversation';
  container_id: string;
  // Polls are created via `pollsApi.create` (/polls), not this rich-content path.
  type: Extract<MessageType, 'sticker' | 'voice' | 'location' | 'contact' | 'link_preview'>;
  text?: string | null;
  location?: RichLocationInput | null;
  contact?: RichContactInput | null;
  link_preview?: RichLinkPreviewInput | null;
  reply_mode?: ReplyMode | null;
  reply_to_message_id?: string | null;
}

// ---- Polls (PollBot) --------------------------------------------------------

export type PollResultsVisibility = 'after_vote' | 'always' | 'after_close';

export interface PollOptionInput {
  id: string;
  text: string;
}

export interface CreatePollRequest {
  conversation_id: string;
  question: string;
  options: PollOptionInput[];
  allows_multiple?: boolean;
  anonymous?: boolean;
  results_visibility?: PollResultsVisibility;
  closes_at?: string | null;
}

export interface PollVoteRequest {
  option_ids: string[];
}

export interface PollOptionView {
  id: string;
  text: string;
  /** Present only when results are visible to the caller (per results_visibility). */
  vote_count: number | null;
}

export interface PollView {
  id: string;
  conversation_id: string;
  message_id: string | null;
  created_by: string;
  bot_id: string;
  question: string;
  options: PollOptionView[];
  allows_multiple: boolean;
  anonymous: boolean;
  results_visibility: PollResultsVisibility;
  closes_at: string | null;
  closed: boolean;
  total_votes: number | null;
  results_visible: boolean;
  my_option_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface CreatePollResponse {
  poll: PollView;
  message: MessageDoc;
}

export interface ForwardedFrom {
  conversation_id: string;
  message_id: string;
  sender_id: string;
  forwarded_at: string;
}

export interface MessageEdit {
  content: MessageContent;
  edited_at: string;
}

/** A user's private bookmark of a message (GET/POST /me/saved-messages). */
export interface SavedMessageView {
  id: string;
  user_id: string;
  message_id: string;
  conversation_id: string;
  saved_at: string;
  message: MessageDoc | null;
}

/** Paginated result envelope for GET /search/messages. */
export interface MessageSearchResults {
  items: MessageDoc[];
  has_more: boolean;
}

export interface MessageDoc {
  container_type: MessageContainerType;
  container_id: string;
  id: string;
  /** @deprecated Use `container_id`. Present for conversation compatibility. */
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
  mention_user_ids: string[];
  mention_scope: 'here' | 'all' | null;
  forwarded_from: ForwardedFrom | null;
  edit_history: MessageEdit[];
  scheduled_for: string | null;
  state: MessageState;
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
  container_type: MessageContainerType;
  container_id: string;
  /** @deprecated Use `container_id`. Present for conversation compatibility. */
  conversation_id: string;
  reactions: MessageReactionGroup[];
  updated_at: string;
}

export interface DeleteMessageResponse {
  message_id: string;
  container_type: MessageContainerType;
  container_id: string;
  /** @deprecated Use `container_id`. Present for conversation compatibility. */
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

export type ConnectionStatus =
  | 'none'
  | 'pending'
  | 'active'
  | 'declined'
  | 'revoked'
  | 'blocked';
export type ConnectionDirection = 'incoming' | 'outgoing';

export interface UserSummary {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar: AvatarMeta | null;
  is_online: boolean | null;
  presence_state?: PresenceState;
  last_seen_at?: string | null;
  can_ping?: boolean;
  chat_allowed?: boolean;
  connection_status?: ConnectionStatus;
  connection_direction?: ConnectionDirection | null;
  relationship_id?: string | null;
  is_ghost?: boolean;
}

export type PresenceState = 'online' | 'away' | 'dnd' | 'offline';

export interface PresenceStatus {
  user_id: string;
  state: PresenceState;
  is_online: boolean;
  last_seen_at: string | null;
}

export interface ConnectionState {
  can_ping: boolean;
  chat_allowed: boolean;
  connection_status: ConnectionStatus;
  direction: ConnectionDirection | null;
  relationship_id: string | null;
  blocked_by_me: boolean;
  blocks_me: boolean;
}

export interface ClearConversationResponse {
  conversation_id: string;
  cleared_count: number;
}

export interface DeleteConversationResponse {
  conversation_id: string;
  cleared_count: number;
}

export interface DeleteCallHistoryResponse {
  deleted_count: number;
  hidden_count: number;
}

export type ConversationType = 'dm' | 'group';

/**
 * Name of the role a participant holds — 'Admin', 'Moderator', 'Member',
 * 'Guest', or a custom role defined for that conversation. Ownership is NOT a
 * role: read `owner_type`/`owner_id` on the conversation instead.
 */
export type ParticipantRole = string;

export const ROLE_ADMIN = 'Admin';
export const ROLE_MODERATOR = 'Moderator';
export const ROLE_MEMBER = 'Member';
export type NotificationLevel = 'all' | 'mentions' | 'none';
export type ConversationVisibility = 'private' | 'public';
export type PostingPolicy = 'everyone' | 'admins';

/** Group membership record returned by GET /conversations/{id}/members. */
export interface ParticipantView {
  conversation_id: string;
  user_id: string;
  role: ParticipantRole | null;
  permissions: Record<string, boolean> | null;
  joined_at: string;
  last_read_at: string | null;
  last_read_message_id: string | null;
  notification_level: NotificationLevel;
  muted_until: string | null;
  archived: boolean;
  pinned: boolean;
  folder: string | null;
  invited_by: string | null;
  draft_text: string | null;
  draft_updated_at: string | null;
  muted: boolean;
  hidden: boolean;
}

/** A user's folder, discovered from per-participant `folder` labels. */
export interface ConversationFolder {
  name: string;
  count: number;
  archived_count: number;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

/** Invite link to a conversation (POST /conversations/{id}/invites). */
export interface ConversationInviteLink {
  id: string;
  conversation_id: string;
  code: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  requires_approval: boolean;
  revoked: boolean;
  created_at: string;
  updated_at: string;
}

/** Pending/resolved request to join a conversation. */
export interface ConversationJoinRequest {
  id: string;
  conversation_id: string;
  user_id: string;
  status: JoinRequestStatus;
  invite_code: string | null;
  responded_at: string | null;
  created_at: string;
}

/** Result of redeeming an invite code. */
export interface RedeemInviteResult {
  status: 'joined' | 'pending';
  conversation: Conversation | null;
  join_request: ConversationJoinRequest | null;
}

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
  /** Who owns this conversation; ownership is not a role (§51). */
  owner_type?: 'user' | 'space' | null;
  owner_id?: string | null;
  title: string | null;
  image?: AvatarMeta | null;
  visibility: ConversationVisibility;
  posting_policy: PostingPolicy;
  space_id: string | null;
  space_visibility?: 'space_public' | 'invite_only' | null;
  parent_conversation_id: string | null;
  root_message_id: string | null;
  slug: string | null;
  description: string | null;
  member_count: number;
  pinned_message_ids: string[];
  settings: Record<string, unknown>;
  last_message_preview: {
    message_id: string;
    sender_id: string;
    type: ContentType;
    text: string | null;
    created_at: string;
  } | null;
  notification_level: NotificationLevel;
  muted_until: string | null;
  /** Viewer-relative inbox flags (the requesting user's own participant state). */
  pinned: boolean;
  archived: boolean;
  folder: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThreadConversationView {
  thread: Conversation;
  parent: Conversation | null;
  root_message: MessageDoc | null;
  locked: boolean;
  converted_to_conversation_id: string | null;
}

export interface ConvertThreadToGroupResponse {
  group: Conversation;
  thread: Conversation;
  imported_count: number;
  truncated: boolean;
}

/** Lean conversation entity returned by POST /conversations (create-or-get DM). */
export interface ConversationEntity {
  id: string;
  type: ConversationType;
  encryption: EncryptionMode;
  participant_ids: string[];
  created_by: string;
  title: string | null;
  visibility: ConversationVisibility;
  posting_policy: PostingPolicy;
  space_id: string | null;
  parent_conversation_id: string | null;
  root_message_id: string | null;
  slug: string | null;
  description: string | null;
  member_count: number;
  pinned_message_ids: string[];
  settings: Record<string, unknown>;
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

export interface RelationshipState {
  muted_until: string | null;
  archived: boolean;
  pinned: boolean;
  hidden: boolean;
  folder: string | null;
  last_read_message_id: string | null;
  notification_level: NotificationLevel;
}

export interface Relationship {
  id: string;
  kind: 'connection' | 'follow' | 'membership';
  user_id: string;
  target_type: 'user' | 'conversation' | 'space' | 'channel';
  target_id: string;
  status: 'pending' | 'active' | 'declined' | 'revoked';
  initiation: 'request' | 'invite' | 'direct' | 'system';
  initiated_by: string;
  approved_by: string | null;
  pair_id: string | null;
  role_ids: string[];
  state: RelationshipState;
  requested_at: string;
  activated_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignRelationshipRolesRequest {
  role_ids: string[];
}

export interface Role {
  id: string;
  scope_type: 'space' | 'conversation' | 'channel';
  scope_id: string;
  name: string;
  permissions: string[];
  priority: number;
  system: boolean;
  created_at: string;
  updated_at: string;
}

export interface PeerUserSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar: AvatarMeta | null;
  is_online: boolean;
}

export interface ConnectionListItem {
  relationship: Relationship;
  peer: PeerUserSummary;
  direction: ConnectionDirection;
  conversation_id: string | null;
}

export interface BlockView {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  updated_at: string;
}

export interface BlockedUserListItem {
  block: BlockView;
  user: PeerUserSummary;
}

export interface SharedConversationSummary {
  id: string;
  type: string;
  title: string | null;
}

export interface SharedSpaceSummary {
  id: string;
  name: string;
  slug: string;
}

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

export type SpaceKind = 'workspace' | 'community';
export type SpaceJoinPolicy = 'open' | 'approval' | 'invite_only' | 'closed';

export interface SpaceView {
  id: string;
  name: string;
  slug: string;
  kind: SpaceKind;
  visibility: 'private' | 'public';
  join_policy: SpaceJoinPolicy;
  avatar: Record<string, any> | null;
  created_by: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  owner_user_id: string;
  /** Name of the role the viewer holds here, or null. Ownership is separate. */
  viewer_role?: ParticipantRole | null;
}

export interface SpaceInviteLinkView {
  id: string;
  target_type: 'space';
  target_id: string;
  code: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  approval_required: boolean;
  role_ids: string[];
  revoked: boolean;
  invitee_id?: string | null;
}

export interface SpaceJoinRequestView {
  id: string;
  target_type: 'space';
  target_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  invite_code: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface RedeemSpaceInviteResponse {
  status: 'joined' | 'pending';
  space: SpaceView | null;
  membership: Relationship;
}

export interface SpaceMemberUserSummary {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar: Record<string, any> | null;
}

export interface SpaceMemberView {
  id: string;
  space_id: string;
  user_id: string;
  role: ParticipantRole | null;
  joined_at: string;
  user: SpaceMemberUserSummary | null;
}

/**
 * A channel owned by a space. `joined` reports an explicit channel membership,
 * which is distinct from read access: a `members`-visibility channel is
 * readable by any active space member without one.
 */
export interface SpaceChannelView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: 'profile' | 'text' | 'announcement';
  visibility: ChannelVisibility;
  posting_policy: ChannelPostingPolicy;
  joined: boolean;
}

export interface SpaceChannelCreateRequest {
  name: string;
  slug: string;
  description?: string | null;
  kind?: 'text' | 'announcement';
  visibility?: ChannelVisibility;
  posting_policy?: ChannelPostingPolicy;
  comment_policy?: ChannelCommentPolicy;
  tags?: string[];
}

/**
 * A group conversation owned by a space. Participation is always explicit — a
 * space member is not implicitly a participant — so `joined` is authoritative.
 */
export interface SpaceGroupView {
  id: string;
  title: string | null;
  participant_count: number;
  joined: boolean;
  created_at: string;
}

export interface SpaceGroupCreateRequest {
  title: string;
  participant_ids: string[];
}
