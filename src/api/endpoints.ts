import { AxiosProgressEvent } from 'axios';
import { apiClient } from './httpClient';
import { extractResponseData } from './utils';
import {
  AcceptCallRequest,
  CallDoc,
  CallHistoryItem,
  CallSession,
  Channel,
  ChannelInboxRow,
  ChannelMemberView,
  ChannelViewerState,
  CreateChannelRequest,
  UpdateChannelRequest,
  MessageContainerRef,
  ClearConversationResponse,
  BlockedUserListItem,
  BlockView,
  ConnectionDirection,
  ConnectionListItem,
  Conversation,
  ConversationFolder,
  ConversationInviteLink,
  ConversationJoinRequest,
  ConversationReadUpdate,
  CreateCallRequest,
  CreateInviteLinkResponse,
  DeleteCallHistoryResponse,
  DeleteConversationResponse,
  DeleteMessageResponse,
  DiscoveredUser,
  AuthChallengeResponse,
  MessageDoc,
  MessageResponse,
  NotificationLevel,
  NotificationView,
  CapabilitiesRequest,
  CapabilitiesResponse,
  ChannelKind,
  ChannelSummary,
  DirectorySort,
  GroupSummary,
  OmniResults,
  PaginatedResponse,
  ResourceRef,
  SpaceSummary,
  ParticipantRole,
  ParticipantView,
  PasskeyAuthenticationOptionsPayload,
  PasskeyDeleteResult,
  PasskeyRegistrationOptionsPayload,
  PasskeyResponse,
  Relationship,
  PreviewMediaKind,
  CreatePollRequest,
  CreatePollResponse,
  PollView,
  RedeemInviteResult,
  ReplyMode,
  RegenerateCodeResponse,
  Role,
  SavedMessageView,
  SelectedUserProfile,
  SendRichContentRequest,
  SuccessResponse,
  ThreadSummary,
  TokenPair,
  User,
  FeedPostView,
  SpaceView,
  SpaceInviteLinkView,
  SpaceJoinRequestView,
  RedeemSpaceInviteResponse,
  SpaceMemberView,
  SpaceChannelView,
  SpaceChannelCreateRequest,
  SpaceGroupView,
  SpaceGroupCreateRequest,
  SpaceKind,
  SpaceJoinPolicy,
} from './types';

export const authApi = {
  start: (identifier: string) =>
    apiClient
      .post<SuccessResponse<AuthChallengeResponse>>('/auth/start', { method: 'email', identifier })
      .then((res) => extractResponseData(res.data)),
  finish: (identifier: string, code: string) =>
    apiClient
      .post<SuccessResponse<TokenPair>>('/auth/finish', { method: 'email', identifier, code })
      .then((res) => extractResponseData(res.data)),
  logout: (refresh_token: string) =>
    apiClient
      .post<SuccessResponse<MessageResponse>>('/auth/logout', { refresh_token })
      .then((res) => extractResponseData(res.data)),
  passkeys: {
    registerStart: (nickname?: string) =>
      apiClient
        .post<SuccessResponse<PasskeyRegistrationOptionsPayload>>(
          '/auth/passkeys/register/start',
          { nickname }
        )
        .then((res) => extractResponseData(res.data)),
    registerFinish: (data: { credential: unknown; nickname?: string }) =>
      apiClient
        .post<SuccessResponse<PasskeyResponse>>('/auth/passkeys/register/finish', data)
        .then((res) => extractResponseData(res.data)),
    loginStart: (email: string) =>
      apiClient
        .post<SuccessResponse<PasskeyAuthenticationOptionsPayload>>(
          '/auth/passkeys/login/start',
          { email }
        )
        .then((res) => extractResponseData(res.data)),
    loginFinish: (data: { email: string; credential: unknown }) =>
      apiClient
        .post<SuccessResponse<TokenPair>>('/auth/passkeys/login/finish', data)
        .then((res) => extractResponseData(res.data)),
    list: () =>
      apiClient
        .get<SuccessResponse<PasskeyResponse[]>>('/auth/passkeys')
        .then((res) => extractResponseData(res.data)),
    delete: (credentialId: string) =>
      apiClient
        .delete<SuccessResponse<PasskeyDeleteResult>>(`/auth/passkeys/${credentialId}`)
        .then((res) => extractResponseData(res.data)),
  },
};

export const usersApi = {
  getMe: () =>
    apiClient
      .get<SuccessResponse<User>>('/users/me')
      .then((res) => extractResponseData(res.data)),
  getUser: (id: string, include?: string) =>
    apiClient
      .get<SuccessResponse<SelectedUserProfile>>(`/users/${id}`, {
        params: include ? { include } : undefined,
      })
      .then((res) => extractResponseData(res.data)),
  updateProfile: (data: {
    display_name?: string;
    bio?: string;
    pronouns?: string;
    timezone?: string;
    is_private?: boolean;
    default_discovery_enabled?: boolean;
  }) =>
    apiClient
      .patch<SuccessResponse<User>>('/users/me', data)
      .then((res) => extractResponseData(res.data)),
  updateUsername: (username: string) =>
    apiClient
      .patch<SuccessResponse<User>>('/users/me/username', { username })
      .then((res) => extractResponseData(res.data)),
  updateStatus: (data: {
    status_emoji?: string | null;
    status_text?: string | null;
    status_expires_at?: string | null;
  }) =>
    apiClient
      .patch<SuccessResponse<User>>('/users/me/status', data)
      .then((res) => extractResponseData(res.data)),
  clearStatus: () =>
    apiClient
      .delete<SuccessResponse<User>>('/users/me/status')
      .then((res) => extractResponseData(res.data)),
  uploadAvatar: (formData: FormData) =>
    apiClient
      .patch<SuccessResponse<User>>('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => extractResponseData(res.data)),
  deleteAvatar: () =>
    apiClient
      .delete<SuccessResponse<User>>('/users/me/avatar')
      .then((res) => extractResponseData(res.data)),
  setMainChannel: (channelId: string | null) =>
    apiClient
      .patch<SuccessResponse<User>>('/users/me/main-channel', { channel_id: channelId })
      .then((res) => extractResponseData(res.data)),
  getUserChannels: (userId: string) =>
    apiClient
      .get<SuccessResponse<ChannelSummary[]>>(`/users/${userId}/channels`)
      .then((res) => extractResponseData(res.data)),
};

export const feedsApi = {
  getHome: async (limit = 20, cursor?: string) => {
    const response = await apiClient.get<PaginatedResponse<FeedPostView>>('/feeds', {
      params: { limit, cursor },
    });
    return response.data;
  },
  getChannel: async (channelId: string, limit = 20, cursor?: string) => {
    const response = await apiClient.get<PaginatedResponse<FeedPostView>>(
      `/feeds/channels/${channelId}`,
      { params: { limit, cursor } }
    );
    return response.data;
  },
  getPostComments: async (channelId: string, postId: string) => {
    const response = await apiClient.get<PaginatedResponse<FeedPostView>>(
      `/feeds/channels/${channelId}/posts/${postId}/comments`
    );
    return response.data;
  },
  getUserFeed: async (username: string, limit = 20, cursor?: string) => {
    const response = await apiClient.get<PaginatedResponse<FeedPostView>>(
      `/feeds/users/${encodeURIComponent(username)}`,
      { params: { limit, cursor } }
    );
    return response.data;
  },
};

export const notificationsApi = {
  list: (limit = 50) =>
    apiClient
      .get<SuccessResponse<NotificationView[]>>('/notifications', { params: { limit } })
      .then((res) => extractResponseData(res.data)),
  /** The badge value, without paging the list to compute it. */
  unreadCount: () =>
    apiClient
      .get<SuccessResponse<{ count: number }>>('/notifications/unread-count')
      .then((res) => extractResponseData(res.data).count),
  /** Idempotent — a repeat call leaves the original `read_at` in place. */
  markRead: (notificationId: string) =>
    apiClient
      .post<SuccessResponse<NotificationView>>(`/notifications/${notificationId}/read`)
      .then((res) => extractResponseData(res.data)),
  markAllRead: () =>
    apiClient
      .post<SuccessResponse<{ updated: number }>>('/notifications/read-all')
      .then((res) => extractResponseData(res.data).updated),
  updatePreferences: (data: {
    timezone?: string | null;
    dnd_from?: string | null;
    dnd_to?: string | null;
    notification_keywords?: string[];
  }) =>
    apiClient
      .patch<SuccessResponse<User>>('/notifications/preferences', data)
      .then((res) => extractResponseData(res.data)),
  updateConversationSettings: (
    conversationId: string,
    data: { notification_level?: NotificationLevel; muted_until?: string | null }
  ) =>
    apiClient
      .patch<SuccessResponse<ParticipantView>>(
        `/notifications/conversations/${conversationId}`,
        data
      )
      .then((res) => extractResponseData(res.data)),
};

export const messagesApi = {
  uploadMedia: async (data: MessageContainerRef & {
    file: File;
    text?: string;
    duration_ms?: number;
    reply_mode?: ReplyMode | null;
    reply_to_message_id?: string;
    signal?: AbortSignal;
    onUploadProgress?: (event: AxiosProgressEvent) => void;
  } & (
    | {
        type: 'media';
        media_kind: PreviewMediaKind;
      }
    | {
        type: 'file';
        media_kind?: never;
      }
  )) => {
    const formData = new FormData();
    formData.append('type', data.type);
    formData.append('file', data.file);
    if (data.type === 'media') {
      formData.append('media_kind', data.media_kind);
    }
    if (data.text) formData.append('text', data.text);
    if (data.duration_ms) formData.append('duration_ms', data.duration_ms.toString());
    if (data.reply_mode) formData.append('reply_mode', data.reply_mode);
    if (data.reply_to_message_id) formData.append('reply_to_message_id', data.reply_to_message_id);

    const mediaPath =
      data.container_type === 'channel'
        ? `/channels/${data.container_id}/messages/media`
        : `/conversations/${data.container_id}/messages/media`;
    const response = await apiClient.post<SuccessResponse<MessageDoc>>(
      mediaPath,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: data.signal,
        onUploadProgress: data.onUploadProgress,
      }
    );
    return extractResponseData(response.data);
  },
  sendText: async (data: MessageContainerRef & {
    text: string;
    reply_mode?: ReplyMode | null;
    reply_to_message_id?: string;
  }) => {
    const path =
      data.container_type === 'channel'
        ? `/channels/${data.container_id}/messages`
        : `/conversations/${data.container_id}/messages/text`;
    const response = await apiClient.post<SuccessResponse<MessageDoc>>(
      path,
      {
        text: data.text,
        reply_mode: data.reply_mode ?? null,
        reply_to_message_id: data.reply_to_message_id,
      }
    );
    return extractResponseData(response.data);
  },
  sendRichContent: async (data: SendRichContentRequest) => {
    const contentPath =
      data.container_type === 'channel'
        ? `/channels/${data.container_id}/messages/content`
        : `/conversations/${data.container_id}/messages/content`;
    const response = await apiClient.post<SuccessResponse<MessageDoc>>(
      contentPath,
      {
        type: data.type,
        text: data.text ?? null,
        location: data.location ?? null,
        contact: data.contact ?? null,
        link_preview: data.link_preview ?? null,
        reply_mode: data.reply_mode ?? null,
        reply_to_message_id: data.reply_to_message_id ?? null,
      }
    );
    return extractResponseData(response.data);
  },
  getHistory: async (
    container: MessageContainerRef,
    limit = 20,
    cursor?: string
  ) => {
    const path =
      container.container_type === 'channel'
        ? `/channels/${container.container_id}/messages`
        : `/conversations/${container.container_id}/messages`;
    const response = await apiClient.get<PaginatedResponse<MessageDoc>>(
      path,
      { params: { limit, cursor } }
    );
    return response.data;
  },
  getMessage: (messageId: string) =>
    apiClient
      .get<SuccessResponse<MessageDoc>>(`/messages/${messageId}`)
      .then((res) => extractResponseData(res.data)),
  markDelivered: (messageId: string) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>(`/messages/${messageId}/delivered`)
      .then((res) => extractResponseData(res.data)),
  editMessage: (messageId: string, text: string) =>
    apiClient
      .patch<SuccessResponse<MessageDoc>>(`/messages/${messageId}`, { text })
      .then((res) => extractResponseData(res.data)),
  deleteMessage: (messageId: string) =>
    apiClient
      .delete<SuccessResponse<DeleteMessageResponse>>(`/messages/${messageId}`)
      .then((res) => extractResponseData(res.data)),
  getThreadMessages: (messageId: string) =>
    apiClient
      .get<SuccessResponse<MessageDoc[]>>(`/messages/${messageId}/thread`)
      .then((res) => extractResponseData(res.data)),
  getThreadSummary: (messageId: string) =>
    apiClient
      .get<SuccessResponse<ThreadSummary>>(`/messages/${messageId}/thread-summary`)
      .then((res) => extractResponseData(res.data)),
  toggleReaction: (messageId: string, emoji: string) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>(`/messages/${messageId}/reactions`, { emoji })
      .then((res) => extractResponseData(res.data)),
  forwardMessage: (messageId: string, targetConversationId: string) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>(`/messages/${messageId}/forward`, {
        target_conversation_id: targetConversationId,
      })
      .then((res) => extractResponseData(res.data)),
  pinMessage: (messageId: string) =>
    apiClient
      .post<SuccessResponse<Conversation>>(`/messages/${messageId}/pin`)
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  unpinMessage: (messageId: string) =>
    apiClient
      .delete<SuccessResponse<Conversation>>(`/messages/${messageId}/pin`)
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  getPinnedMessages: (conversationId: string) =>
    apiClient
      .get<SuccessResponse<MessageDoc[]>>(
        `/conversations/${conversationId}/messages/pinned`
      )
      .then((res) => extractResponseData(res.data)),
  scheduleMessage: (conversationId: string, text: string, scheduledForIso: string) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>(
        `/conversations/${conversationId}/messages/schedule`,
        { text, scheduled_for: scheduledForIso }
      )
      .then((res) => extractResponseData(res.data)),
  getScheduledMessages: (conversationId: string) =>
    apiClient
      .get<SuccessResponse<MessageDoc[]>>(
        `/conversations/${conversationId}/messages/scheduled`
      )
      .then((res) => extractResponseData(res.data)),
  cancelScheduledMessage: (conversationId: string, messageId: string) =>
    apiClient.delete(
      `/conversations/${conversationId}/messages/scheduled/${messageId}`
    ),
  searchMessages: (query: string, options?: { limit?: number; cursor?: string }) =>
    apiClient
      .get<PaginatedResponse<MessageDoc>>('/search/messages', {
        params: { q: query, limit: options?.limit, cursor: options?.cursor },
      })
      .then((res) => res.data),
  markConversationRead: async (conversationId: string): Promise<ConversationReadUpdate> => {
    await apiClient.post(`/conversations/${conversationId}/read`);
    return {};
  },
  clearConversation: async (conversationId: string) => {
    const response = await apiClient.delete<SuccessResponse<ClearConversationResponse>>(
      `/conversations/${conversationId}/messages`
    );
    return extractResponseData(response.data);
  },
  deleteConversation: async (conversationId: string) => {
    const response = await apiClient.delete<SuccessResponse<DeleteConversationResponse>>(
      `/conversations/${conversationId}`
    );
    return extractResponseData(response.data);
  },
};

const normalizeConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  conversation_id: conversation.conversation_id ?? conversation.id,
  pinned: conversation.pinned ?? false,
  archived: conversation.archived ?? false,
  folder: conversation.folder ?? null,
  last_message: conversation.last_message ?? (
    conversation.last_message_preview
      ? {
          id: conversation.last_message_preview.message_id,
          type: conversation.last_message_preview.type,
          text: conversation.last_message_preview.text,
          media: null,
          call: null,
          created_at: conversation.last_message_preview.created_at,
        }
      : null
  ),
});

export const conversationsApi = {
  getConversations: (
    limit = 20,
    cursor?: string,
    options?: { archived?: boolean; folder?: string; space_id?: string }
  ) =>
    apiClient
      .get<PaginatedResponse<Conversation>>('/conversations', {
        params: {
          limit,
          cursor,
          archived: options?.archived ? true : undefined,
          folder: options?.folder,
          space_id: options?.space_id,
        },
      })
      .then((res) => ({
        ...res.data,
        data: res.data.data.map(normalizeConversation),
      })),
  getConversation: (conversationId: string) =>
    apiClient
      .get<SuccessResponse<Conversation>>(`/conversations/${conversationId}`)
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  listFolders: () =>
    apiClient
      .get<SuccessResponse<ConversationFolder[]>>('/conversations/folders')
      .then((res) => extractResponseData(res.data)),
  renameFolder: (name: string, newName: string) =>
    apiClient
      .patch<SuccessResponse<{ updated: number }>>(
        `/conversations/folders/${encodeURIComponent(name)}`,
        { new_name: newName }
      )
      .then((res) => extractResponseData(res.data)),
  deleteFolder: (name: string) =>
    apiClient
      .delete<void>(
        `/conversations/folders/${encodeURIComponent(name)}`
      )
      .then(() => undefined),
  updateInboxStateBulk: (
    conversationIds: string[],
    updates: { pinned?: boolean; archived?: boolean; folder?: string | null }
  ) =>
    apiClient
      .patch<SuccessResponse<{ updated: number }>>('/conversations/inbox', {
        conversation_ids: conversationIds,
        ...updates,
      })
      .then((res) => extractResponseData(res.data)),
  createInvite: (
    conversationId: string,
    data: { expires_at?: string | null; max_uses?: number | null; requires_approval?: boolean } = {}
  ) =>
    apiClient
      .post<SuccessResponse<ConversationInviteLink>>(
        `/conversations/${conversationId}/invites`,
        data
      )
      .then((res) => extractResponseData(res.data)),
  listInvites: (conversationId: string) =>
    apiClient
      .get<SuccessResponse<ConversationInviteLink[]>>(`/conversations/${conversationId}/invites`)
      .then((res) => extractResponseData(res.data)),
  revokeInvite: (conversationId: string, inviteId: string) =>
    apiClient
      .delete(`/conversations/${conversationId}/invites/${inviteId}`)
      .then(() => undefined),
  redeemInvite: (code: string) =>
    apiClient
      .post<SuccessResponse<RedeemInviteResult>>(
        `/conversations/invites/${encodeURIComponent(code)}/redeem`
      )
      .then((res) => {
        const result = extractResponseData(res.data);
        return {
          ...result,
          conversation: result.conversation ? normalizeConversation(result.conversation) : null,
        };
      }),
  listJoinRequests: (conversationId: string) =>
    apiClient
      .get<SuccessResponse<ConversationJoinRequest[]>>(
        `/conversations/${conversationId}/join-requests`
      )
      .then((res) => extractResponseData(res.data)),
  approveJoinRequest: (conversationId: string, requestId: string) =>
    apiClient
      .post<SuccessResponse<Relationship>>(
        `/conversations/${conversationId}/members/${requestId}/accept`
      )
      .then((res) => extractResponseData(res.data)),
  rejectJoinRequest: (conversationId: string, requestId: string) =>
    apiClient
      .post<SuccessResponse<Relationship>>(
        `/conversations/${conversationId}/members/${requestId}/decline`
      )
      .then((res) => extractResponseData(res.data)),
  updateInboxState: (
    conversationId: string,
    updates: { pinned?: boolean; archived?: boolean; folder?: string | null }
  ) =>
    apiClient
      .patch<SuccessResponse<ParticipantView>>(
        `/conversations/${conversationId}/inbox`,
        updates
      )
      .then((res) => extractResponseData(res.data)),
  createOrGetDm: (peerUserId: string) =>
    apiClient
      .post<SuccessResponse<Conversation>>('/conversations', { peer_user_id: peerUserId })
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  createGroup: (data: { title: string; participant_ids: string[]; space_id?: string; space_visibility?: 'space_public' | 'invite_only' }) =>
    apiClient
      .post<SuccessResponse<Conversation>>('/conversations/groups', data)
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  listMembers: (conversationId: string) =>
    apiClient
      .get<SuccessResponse<ParticipantView[]>>(`/conversations/${conversationId}/members`)
      .then((res) => extractResponseData(res.data)),
  removeMember: (conversationId: string, memberUserId: string) =>
    apiClient
      .delete(`/conversations/${conversationId}/members/${memberUserId}`)
      .then(() => undefined),
  updateMemberRole: (
    conversationId: string,
    memberUserId: string,
    role: ParticipantRole
  ) =>
    apiClient
      .patch<SuccessResponse<ParticipantView>>(
        `/conversations/${conversationId}/members/${memberUserId}/role`,
        { role }
      )
      .then((res) => extractResponseData(res.data)),
  transferOwnership: (conversationId: string, userId: string) =>
    apiClient
      .post<SuccessResponse<ParticipantView[]>>(
        `/conversations/${conversationId}/ownership`,
        { user_id: userId }
      )
      .then((res) => extractResponseData(res.data)),
  leaveGroup: (conversationId: string) =>
    apiClient
      .post(`/conversations/${conversationId}/leave`)
      .then(() => undefined),
  deleteGroup: (conversationId: string) =>
    apiClient
      .delete(`/conversations/groups/${conversationId}`)
      .then(() => undefined),
  updateGroup: (conversationId: string, data: { title: string }) =>
    apiClient
      .patch<SuccessResponse<Conversation>>(
        `/conversations/groups/${conversationId}`,
        data
      )
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  uploadGroupAvatar: (conversationId: string, formData: FormData) =>
    apiClient
      .patch<SuccessResponse<Conversation>>(
        `/conversations/groups/${conversationId}/avatar`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  deleteGroupAvatar: (conversationId: string) =>
    apiClient
      .delete<SuccessResponse<Conversation>>(
        `/conversations/groups/${conversationId}/avatar`
      )
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  clearGroupForEveryone: (conversationId: string) =>
    apiClient
      .delete<SuccessResponse<ClearConversationResponse>>(
        `/conversations/${conversationId}/messages/all`
      )
      .then((res) => extractResponseData(res.data)),
  setDraft: (conversationId: string, text: string) =>
    apiClient
      .put<SuccessResponse<ParticipantView>>(
        `/conversations/${conversationId}/draft`,
        { text }
      )
      .then((res) => extractResponseData(res.data)),
  getDraft: (conversationId: string) =>
    apiClient
      .get<SuccessResponse<ParticipantView>>(`/conversations/${conversationId}/draft`)
      .then((res) => extractResponseData(res.data)),
  clearDraft: (conversationId: string) =>
    apiClient.delete(`/conversations/${conversationId}/draft`),
};

export const savedMessagesApi = {
  save: (conversationId: string, messageId: string) =>
    apiClient
      .post<SuccessResponse<SavedMessageView>>('/me/saved-messages', {
        conversation_id: conversationId,
        message_id: messageId,
      })
      .then((res) => extractResponseData(res.data)),
  list: (limit = 50) =>
    apiClient
      .get<SuccessResponse<SavedMessageView[]>>('/me/saved-messages', {
        params: { limit },
      })
      .then((res) => extractResponseData(res.data)),
  remove: (messageId: string) =>
    apiClient.delete(`/me/saved-messages/${messageId}`),
};


export const discoveryApi = {
  regenerateCode: () =>
    apiClient
      .post<SuccessResponse<RegenerateCodeResponse>>('/discovery/code/regenerate')
      .then((res) => extractResponseData(res.data)),
  resolveCode: (code: string) =>
    apiClient
      .post<SuccessResponse<DiscoveredUser>>('/discovery/code/resolve', { code })
      .then((res) => extractResponseData(res.data)),
  createLink: (expires_in_seconds: number, max_uses: number) =>
    apiClient
      .post<SuccessResponse<CreateInviteLinkResponse>>('/discovery/links', {
        expires_in_seconds,
        max_uses,
      })
      .then((res) => extractResponseData(res.data)),
  resolveLink: (token: string) =>
    apiClient
      .get<SuccessResponse<DiscoveredUser>>(`/discovery/invite/${token}`)
      .then((res) => extractResponseData(res.data)),
  searchUsers: (q: string) =>
    apiClient
      .get<SuccessResponse<DiscoveredUser[]>>('/discovery/users/search', { params: { q } })
      .then((res) => extractResponseData(res.data)),
};

export const connectionsApi = {
  request: (userId: string) =>
    apiClient
      .post<SuccessResponse<Relationship>>(`/connections/${userId}/ping`)
      .then((res) => extractResponseData(res.data)),
  getPending: (direction: ConnectionDirection, limit = 20, cursor?: string) =>
    apiClient
      .get<PaginatedResponse<ConnectionListItem>>('/connections/pending', {
        params: { direction, limit, cursor },
      })
      .then((res) => res.data),
  getContacts: (limit = 20, cursor?: string) =>
    apiClient
      .get<PaginatedResponse<ConnectionListItem>>('/connections', {
        params: { limit, cursor },
      })
      .then((res) => res.data),
  accept: (relationshipId: string) =>
    apiClient
      .post<SuccessResponse<Relationship>>(`/connections/${relationshipId}/accept`)
      .then((res) => extractResponseData(res.data)),
  decline: (relationshipId: string) =>
    apiClient
      .post<SuccessResponse<Relationship>>(`/connections/${relationshipId}/decline`)
      .then((res) => extractResponseData(res.data)),
  revoke: (relationshipId: string) =>
    apiClient
      .delete<SuccessResponse<Relationship>>(`/connections/${relationshipId}`)
      .then((res) => extractResponseData(res.data)),
};

export const followsApi = {
  followUser: (userId: string) =>
    apiClient
      .post<SuccessResponse<Relationship>>(`/users/${userId}/follow`)
      .then((res) => extractResponseData(res.data)),
  unfollowUser: (userId: string) =>
    apiClient
      .delete<SuccessResponse<boolean>>(`/users/${userId}/follow`)
      .then((res) => extractResponseData(res.data)),
  followChannel: (channelId: string) =>
    apiClient
      .post<SuccessResponse<Relationship>>(`/channels/${channelId}/follow`)
      .then((res) => extractResponseData(res.data)),
  unfollowChannel: (channelId: string) =>
    apiClient
      .delete<SuccessResponse<boolean>>(`/channels/${channelId}/follow`)
      .then((res) => extractResponseData(res.data)),
  listFollowers: (userId: string, limit = 100) =>
    apiClient
      .get<SuccessResponse<Relationship[]>>(`/users/${userId}/followers`, {
        params: { limit },
      })
      .then((res) => extractResponseData(res.data)),
  listFollowing: (userId: string, limit = 100) =>
    apiClient
      .get<SuccessResponse<Relationship[]>>(`/users/${userId}/following`, {
        params: { limit },
      })
      .then((res) => extractResponseData(res.data)),
};

export const channelsApi = {
  create: (data: CreateChannelRequest) =>
    apiClient
      .post<SuccessResponse<Channel>>('/channels', data)
      .then((res) => extractResponseData(res.data)),
  get: (channelId: string) =>
    apiClient
      .get<SuccessResponse<Channel>>(`/channels/${channelId}`)
      .then((res) => extractResponseData(res.data)),
  update: (channelId: string, data: UpdateChannelRequest) =>
    apiClient
      .patch<SuccessResponse<Channel>>(`/channels/${channelId}`, data)
      .then((res) => extractResponseData(res.data)),
  createMessage: (
    channelId: string,
    data: {
      text: string;
      reply_mode?: ReplyMode | null;
      reply_to_message_id?: string | null;
    }
  ) =>
    messagesApi.sendText({
      container_type: 'channel',
      container_id: channelId,
      text: data.text,
      reply_mode: data.reply_mode,
      reply_to_message_id: data.reply_to_message_id ?? undefined,
    }),
  /** Channels the caller belongs to, with per-user state for the chat inbox. */
  listMine: (limit = 100) =>
    apiClient
      .get<SuccessResponse<ChannelInboxRow[]>>('/channels/me', { params: { limit } })
      .then((res) => extractResponseData(res.data)),
  listMembers: (channelId: string) =>
    apiClient
      .get<SuccessResponse<ChannelMemberView[]>>(`/channels/${channelId}/members`)
      .then((res) => extractResponseData(res.data)),
  leave: (channelId: string) =>
    apiClient
      .post<SuccessResponse<boolean>>(`/channels/${channelId}/leave`)
      .then((res) => extractResponseData(res.data)),
  setInboxState: (
    channelId: string,
    updates: { pinned?: boolean; archived?: boolean; folder?: string | null }
  ) =>
    apiClient
      .patch<SuccessResponse<ChannelViewerState>>(`/channels/${channelId}/inbox`, updates)
      .then((res) => extractResponseData(res.data)),
  setNotifications: (
    channelId: string,
    updates: { notification_level?: NotificationLevel; muted_until?: string | null }
  ) =>
    apiClient
      .patch<SuccessResponse<ChannelViewerState>>(
        `/channels/${channelId}/notifications`,
        updates
      )
      .then((res) => extractResponseData(res.data)),
  markRead: (channelId: string) =>
    apiClient
      .post<SuccessResponse<ChannelViewerState>>(`/channels/${channelId}/read`)
      .then((res) => extractResponseData(res.data)),
};

type MembershipTargetType = 'space' | 'conversation' | 'channel';

const membershipPath = (
  targetType: MembershipTargetType,
  targetId: string,
  suffix: string
) => `/${targetType === 'space' ? 'spaces' : `${targetType}s`}/${targetId}/${suffix}`;

export const membershipsApi = {
  join: (targetType: Exclude<MembershipTargetType, 'space'>, targetId: string) =>
    apiClient
      .post<SuccessResponse<Relationship>>(membershipPath(targetType, targetId, 'join'))
      .then((res) => extractResponseData(res.data)),
  invite: (targetType: MembershipTargetType, targetId: string, userId: string) =>
    apiClient
      .post<SuccessResponse<Relationship>>(
        membershipPath(targetType, targetId, `invite/${userId}`)
      )
      .then((res) => extractResponseData(res.data)),
  accept: (
    targetType: MembershipTargetType,
    targetId: string,
    relationshipId: string
  ) =>
    apiClient
      .post<SuccessResponse<Relationship>>(
        membershipPath(targetType, targetId, `members/${relationshipId}/accept`)
      )
      .then((res) => extractResponseData(res.data)),
  decline: (
    targetType: MembershipTargetType,
    targetId: string,
    relationshipId: string
  ) =>
    apiClient
      .post<SuccessResponse<Relationship>>(
        membershipPath(targetType, targetId, `members/${relationshipId}/decline`)
      )
      .then((res) => extractResponseData(res.data)),
  assignRoles: (relationshipId: string, roleIds: string[]) =>
    apiClient
      .put<SuccessResponse<Relationship>>(`/relationships/${relationshipId}/roles`, {
        role_ids: roleIds,
      })
      .then((res) => extractResponseData(res.data)),
};

const roleScopePath = (scopeType: MembershipTargetType) =>
  scopeType === 'space' ? 'spaces' : `${scopeType}s`;

export const rolesApi = {
  list: (scopeType: MembershipTargetType, resourceId: string) =>
    apiClient
      .get<SuccessResponse<Role[]>>(
        `/${roleScopePath(scopeType)}/${resourceId}/roles`
      )
      .then((res) => extractResponseData(res.data)),
  create: (
    scopeType: MembershipTargetType,
    resourceId: string,
    data: { name: string; permissions: string[]; priority?: number }
  ) =>
    apiClient
      .post<SuccessResponse<Role>>(
        `/${roleScopePath(scopeType)}/${resourceId}/roles`,
        data
      )
      .then((res) => extractResponseData(res.data)),
  update: (
    scopeType: MembershipTargetType,
    resourceId: string,
    roleId: string,
    data: { name?: string; permissions?: string[]; priority?: number }
  ) =>
    apiClient
      .patch<SuccessResponse<Role>>(
        `/${roleScopePath(scopeType)}/${resourceId}/roles/${roleId}`,
        data
      )
      .then((res) => extractResponseData(res.data)),
  remove: (scopeType: MembershipTargetType, resourceId: string, roleId: string) =>
    apiClient.delete<void>(
      `/${roleScopePath(scopeType)}/${resourceId}/roles/${roleId}`
    ),
};

export const blocksApi = {
  block: (userId: string) =>
    apiClient
      .post<SuccessResponse<BlockView>>(`/blocks/${userId}`)
      .then((res) => extractResponseData(res.data)),
  unblock: (userId: string) => apiClient.delete<void>(`/blocks/${userId}`),
  list: (limit = 20, cursor?: string) =>
    apiClient
      .get<PaginatedResponse<BlockedUserListItem>>('/blocks', {
        params: { limit, cursor },
      })
      .then((res) => res.data),
};

export const callsApi = {
  create: (data: CreateCallRequest) =>
    apiClient
      .post<SuccessResponse<CallSession>>('/calls', data)
      .then((res) => extractResponseData(res.data)),
  getActive: () =>
    apiClient
      .get<SuccessResponse<CallSession | null>>('/calls/active')
      .then((res) => extractResponseData(res.data)),
  accept: (callId: string, data: AcceptCallRequest) =>
    apiClient
      .post<SuccessResponse<CallSession>>(`/calls/${callId}/accept`, data)
      .then((res) => extractResponseData(res.data)),
  reject: (callId: string) =>
    apiClient
      .post<SuccessResponse<CallDoc>>(`/calls/${callId}/reject`)
      .then((res) => extractResponseData(res.data)),
  end: (callId: string) =>
    apiClient
      .post<SuccessResponse<CallDoc>>(`/calls/${callId}/end`)
      .then((res) => extractResponseData(res.data)),
  getHistory: (limit = 20, cursor?: string, peer_user_id?: string) =>
    apiClient
      .get<PaginatedResponse<CallHistoryItem>>('/calls/history', {
        params: { limit, cursor, peer_user_id },
      })
      .then((res) => res.data),
  deleteHistory: (peer_user_id?: string) =>
    apiClient
      .delete<SuccessResponse<DeleteCallHistoryResponse>>('/calls/history', {
        params: peer_user_id ? { peer_user_id } : undefined,
      })
      .then((res) => extractResponseData(res.data)),
};

export const pollsApi = {
  create: (data: CreatePollRequest) =>
    apiClient
      .post<SuccessResponse<CreatePollResponse>>('/polls', data)
      .then((res) => extractResponseData(res.data)),
  get: (pollId: string) =>
    apiClient
      .get<SuccessResponse<PollView>>(`/polls/${pollId}`)
      .then((res) => extractResponseData(res.data)),
  vote: (pollId: string, optionIds: string[]) =>
    apiClient
      .post<SuccessResponse<PollView>>(`/polls/${pollId}/vote`, { option_ids: optionIds })
      .then((res) => extractResponseData(res.data)),
  retract: (pollId: string) =>
    apiClient
      .post<SuccessResponse<PollView>>(`/polls/${pollId}/retract`)
      .then((res) => extractResponseData(res.data)),
  close: (pollId: string) =>
    apiClient
      .post<SuccessResponse<PollView>>(`/polls/${pollId}/close`)
      .then((res) => extractResponseData(res.data)),
};

export const spacesApi = {
  list: () =>
    apiClient
      .get<SuccessResponse<SpaceView[]>>('/spaces/me')
      .then((res) => extractResponseData(res.data)),
  create: (data: {
    name: string;
    slug: string;
    kind?: SpaceKind;
    visibility?: 'private' | 'public';
    join_policy?: SpaceJoinPolicy;
  }) =>
    apiClient
      .post<SuccessResponse<SpaceView>>('/spaces', data)
      .then((res) => extractResponseData(res.data)),
  get: (spaceId: string) =>
    apiClient
      .get<SuccessResponse<SpaceView>>(`/spaces/${spaceId}`)
      .then((res) => extractResponseData(res.data)),
  update: (
    spaceId: string,
    data: { name?: string; visibility?: string; settings?: Record<string, any> }
  ) =>
    apiClient
      .patch<SuccessResponse<SpaceView>>(`/spaces/${spaceId}`, data)
      .then((res) => extractResponseData(res.data)),
  createInvite: (
    spaceId: string,
    data: {
      expires_at?: string | null;
      max_uses?: number | null;
      approval_required?: boolean;
      role_ids?: string[];
    }
  ) =>
    apiClient
      .post<SuccessResponse<SpaceInviteLinkView>>(`/spaces/${spaceId}/invites`, data)
      .then((res) => extractResponseData(res.data)),
  inviteUser: (spaceId: string, userId: string) =>
    membershipsApi.invite('space', spaceId, userId),
  listInvites: (spaceId: string) =>
    apiClient
      .get<SuccessResponse<SpaceInviteLinkView[]>>(`/spaces/${spaceId}/invites`)
      .then((res) => extractResponseData(res.data)),
  revokeInvite: (spaceId: string, inviteId: string) =>
    apiClient
      .delete(`/spaces/${spaceId}/invites/${inviteId}`)
      .then(() => undefined),
  redeemInvite: (code: string) =>
    apiClient
      .post<SuccessResponse<RedeemSpaceInviteResponse>>(`/spaces/invites/${code}/redeem`)
      .then((res) => extractResponseData(res.data)),
  join: (spaceId: string) =>
    apiClient
      .post<SuccessResponse<SpaceJoinRequestView>>(`/spaces/${spaceId}/join`)
      .then((res) => extractResponseData(res.data)),
  listJoinRequests: (spaceId: string) =>
    apiClient
      .get<SuccessResponse<SpaceJoinRequestView[]>>(`/spaces/${spaceId}/join-requests`)
      .then((res) => extractResponseData(res.data)),
  // A join request is approved by an authority holding `member.approve`, not by
  // the requester accepting their own membership — those are different routes.
  approveJoinRequest: (spaceId: string, requestId: string) =>
    apiClient
      .post<SuccessResponse<SpaceJoinRequestView>>(
        `/spaces/${spaceId}/join-requests/${requestId}/approve`
      )
      .then((res) => extractResponseData(res.data)),
  rejectJoinRequest: (spaceId: string, requestId: string) =>
    apiClient
      .post<SuccessResponse<SpaceJoinRequestView>>(
        `/spaces/${spaceId}/join-requests/${requestId}/reject`
      )
      .then((res) => extractResponseData(res.data)),
  listMembers: (spaceId: string) =>
    apiClient
      .get<SuccessResponse<SpaceMemberView[]>>(`/spaces/${spaceId}/members`)
      .then((res) => extractResponseData(res.data)),
  listChannels: (spaceId: string) =>
    apiClient
      .get<SuccessResponse<SpaceChannelView[]>>(`/spaces/${spaceId}/channels`)
      .then((res) => extractResponseData(res.data)),
  /** Returns the full `Channel`, not the trimmed `SpaceChannelView` the list
   * endpoint yields — refetch the list rather than appending this. */
  createChannel: (spaceId: string, data: SpaceChannelCreateRequest) =>
    apiClient
      .post<SuccessResponse<Channel>>(`/spaces/${spaceId}/channels`, data)
      .then((res) => extractResponseData(res.data)),
  joinChannel: (spaceId: string, channelId: string) =>
    apiClient
      .post<void>(`/spaces/${spaceId}/channels/${channelId}/join`)
      .then(() => undefined),
  listGroups: (spaceId: string) =>
    apiClient
      .get<SuccessResponse<SpaceGroupView[]>>(`/spaces/${spaceId}/groups`)
      .then((res) => extractResponseData(res.data)),
  createGroup: (spaceId: string, data: SpaceGroupCreateRequest) =>
    apiClient
      .post<SuccessResponse<SpaceGroupView>>(`/spaces/${spaceId}/groups`, data)
      .then((res) => extractResponseData(res.data)),
};

// --- viewer capabilities ----------------------------------------------------

export const capabilitiesApi = {
  /**
   * The primary contract. Batched because the server builds one authorization
   * context per request and memoizes inside it — fifty resources resolved
   * together share those lookups, fifty requests cannot.
   */
  resolve: (body: CapabilitiesRequest) =>
    apiClient
      .post<SuccessResponse<CapabilitiesResponse>>('/viewer/capabilities', body)
      .then((res) => extractResponseData(res.data)),
};

// --- directory --------------------------------------------------------------

export interface DirectoryChannelParams {
  q?: string;
  owner_type?: 'user' | 'space';
  space_id?: string;
  kind?: ChannelKind;
  tags?: string[];
  sort?: DirectorySort;
  cursor?: string;
  limit?: number;
}

export const directoryApi = {
  listChannels: (params: DirectoryChannelParams = {}) =>
    apiClient
      .get<PaginatedResponse<ChannelSummary>>('/directory/channels', { params })
      .then((res) => res.data),
  listSpaces: (
    params: { q?: string; join_policy?: string; sort?: DirectorySort; cursor?: string; limit?: number } = {}
  ) =>
    apiClient
      .get<PaginatedResponse<SpaceSummary>>('/directory/spaces', { params })
      .then((res) => res.data),
  listGroups: (
    params: { q?: string; space_id?: string; sort?: DirectorySort; cursor?: string; limit?: number } = {}
  ) =>
    apiClient
      .get<PaginatedResponse<GroupSummary>>('/directory/groups', { params })
      .then((res) => res.data),
  listPeople: (params: { q: string; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<DiscoveredUser>>('/directory/people', { params })
      .then((res) => res.data),
  /** Typeahead preview across types; deliberately unpaginated. */
  omni: (q: string, types?: string[]) =>
    apiClient
      .get<SuccessResponse<OmniResults>>('/directory', {
        params: { q, types: types?.join(',') },
      })
      .then((res) => extractResponseData(res.data)),
};
