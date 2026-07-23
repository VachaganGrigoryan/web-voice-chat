import { AxiosProgressEvent } from 'axios';
import { apiClient } from './httpClient';
import { extractResponseData } from './utils';
import {
  AcceptCallRequest,
  CallDoc,
  CallHistoryItem,
  CallSession,
  ClearConversationResponse,
  ContactListItem,
  ConvertThreadToGroupResponse,
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
  DeviceView,
  DiscoveredUser,
  AuthChallengeResponse,
  MessageDoc,
  MessageResponse,
  MessageSearchResults,
  NotificationLevel,
  NotificationView,
  PaginatedResponse,
  ParticipantView,
  PreKeyBundle,
  PreKeyInput,
  PasskeyAuthenticationOptionsPayload,
  PasskeyDeleteResult,
  PasskeyRegistrationOptionsPayload,
  PasskeyResponse,
  Ping,
  PingItem,
  PushTokenView,
  PresenceStatus,
  PreviewMediaKind,
  CreatePollRequest,
  CreatePollResponse,
  PollView,
  RedeemInviteResult,
  ReplyMode,
  RegenerateCodeResponse,
  SavedMessageView,
  SelectedUserProfile,
  SendRichContentRequest,
  SuccessResponse,
  ThreadSummary,
  ThreadConversationView,
  TokenPair,
  User,
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
  getUser: (id: string) =>
    apiClient
      .get<SuccessResponse<SelectedUserProfile>>(`/users/${id}`)
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
};

export const notificationsApi = {
  list: (limit = 50) =>
    apiClient
      .get<SuccessResponse<NotificationView[]>>('/notifications', { params: { limit } })
      .then((res) => extractResponseData(res.data)),
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
  registerPushToken: (data: {
    device_id?: string | null;
    platform: 'ios' | 'android' | 'web';
    token: string;
  }) =>
    apiClient
      .post<SuccessResponse<PushTokenView>>('/notifications/push-tokens', data)
      .then((res) => extractResponseData(res.data)),
  removePushToken: (params: { device_id?: string; token?: string }) =>
    apiClient
      .delete<SuccessResponse<{ deleted: number }>>('/notifications/push-tokens', {
        params,
      })
      .then((res) => extractResponseData(res.data)),
};

export const messagesApi = {
  uploadMedia: async (data: {
    conversation_id: string;
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

    const response = await apiClient.post<SuccessResponse<MessageDoc>>(
      `/conversations/${data.conversation_id}/messages/media`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: data.signal,
        onUploadProgress: data.onUploadProgress,
      }
    );
    return extractResponseData(response.data);
  },
  sendText: async (data: {
    conversation_id: string;
    text: string;
    reply_mode?: ReplyMode | null;
    reply_to_message_id?: string;
  }) => {
    const response = await apiClient.post<SuccessResponse<MessageDoc>>(
      `/conversations/${data.conversation_id}/messages/text`,
      {
        text: data.text,
        reply_mode: data.reply_mode ?? null,
        reply_to_message_id: data.reply_to_message_id,
      }
    );
    return extractResponseData(response.data);
  },
  sendRichContent: async (data: SendRichContentRequest) => {
    const response = await apiClient.post<SuccessResponse<MessageDoc>>(
      `/conversations/${data.conversation_id}/messages/content`,
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
  getHistory: async (conversationId: string, limit = 20, cursor?: string) => {
    const response = await apiClient.get<PaginatedResponse<MessageDoc>>(
      `/conversations/${conversationId}/messages`,
      { params: { limit, cursor } }
    );
    return response.data;
  },
  getMessage: (conversationId: string, messageId: string) =>
    apiClient
      .get<SuccessResponse<MessageDoc>>(
        `/conversations/${conversationId}/messages/${messageId}`
      )
      .then((res) => extractResponseData(res.data)),
  markDelivered: (conversationId: string, messageId: string) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>(
        `/conversations/${conversationId}/messages/${messageId}/delivered`
      )
      .then((res) => extractResponseData(res.data)),
  markRead: (conversationId: string, messageId: string) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>(
        `/conversations/${conversationId}/messages/${messageId}/read`
      )
      .then((res) => extractResponseData(res.data)),
  editMessage: (conversationId: string, messageId: string, text: string) =>
    apiClient
      .patch<SuccessResponse<MessageDoc>>(
        `/conversations/${conversationId}/messages/${messageId}`,
        { text }
      )
      .then((res) => extractResponseData(res.data)),
  deleteMessage: (conversationId: string, messageId: string) =>
    apiClient
      .delete<SuccessResponse<DeleteMessageResponse>>(
        `/conversations/${conversationId}/messages/${messageId}`
      )
      .then((res) => extractResponseData(res.data)),
  getThreadMessages: (conversationId: string, messageId: string) =>
    apiClient
      .get<SuccessResponse<MessageDoc[]>>(
        `/conversations/${conversationId}/messages/${messageId}/thread`
      )
      .then((res) => extractResponseData(res.data)),
  getThreadSummary: (conversationId: string, messageId: string) =>
    apiClient
      .get<SuccessResponse<ThreadSummary>>(
        `/conversations/${conversationId}/messages/${messageId}/thread-summary`
      )
      .then((res) => extractResponseData(res.data)),
  toggleReaction: (conversationId: string, messageId: string, emoji: string) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>(
        `/conversations/${conversationId}/messages/${messageId}/reactions`,
        { emoji }
      )
      .then((res) => extractResponseData(res.data)),
  removeOwnReaction: (conversationId: string, messageId: string, emoji: string) =>
    apiClient
      .delete<SuccessResponse<MessageDoc>>(
        `/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(
          emoji
        )}/me`
      )
      .then((res) => extractResponseData(res.data)),
  forwardMessage: (
    conversationId: string,
    messageId: string,
    targetConversationId: string
  ) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>(
        `/conversations/${conversationId}/messages/${messageId}/forward`,
        { target_conversation_id: targetConversationId }
      )
      .then((res) => extractResponseData(res.data)),
  pinMessage: (conversationId: string, messageId: string) =>
    apiClient
      .post<SuccessResponse<Conversation>>(
        `/conversations/${conversationId}/messages/${messageId}/pin`
      )
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  unpinMessage: (conversationId: string, messageId: string) =>
    apiClient
      .delete<SuccessResponse<Conversation>>(
        `/conversations/${conversationId}/messages/${messageId}/pin`
      )
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  getPinnedMessages: (conversationId: string) =>
    apiClient
      .get<SuccessResponse<MessageDoc[]>>(
        `/conversations/${conversationId}/pinned-messages`
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
  searchMessages: (query: string, options?: { limit?: number; page?: number }) =>
    apiClient
      .get<SuccessResponse<MessageSearchResults>>('/search/messages', {
        params: { q: query, limit: options?.limit, page: options?.page },
      })
      .then((res) => extractResponseData(res.data)),
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

const normalizeThreadConversation = (thread: ThreadConversationView): ThreadConversationView => ({
  ...thread,
  thread: normalizeConversation(thread.thread),
  parent: thread.parent ? normalizeConversation(thread.parent) : null,
});

export const conversationsApi = {
  getConversations: (
    limit = 20,
    cursor?: string,
    options?: { archived?: boolean; folder?: string }
  ) =>
    apiClient
      .get<PaginatedResponse<Conversation>>('/conversations', {
        params: {
          limit,
          cursor,
          archived: options?.archived ? true : undefined,
          folder: options?.folder,
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
  getThreads: (limit = 20, cursor?: string, options?: { archived?: boolean }) =>
    apiClient
      .get<PaginatedResponse<ThreadConversationView>>('/conversations/threads', {
        params: {
          limit,
          cursor,
          archived: options?.archived ? true : undefined,
        },
      })
      .then((res) => ({
        ...res.data,
        data: res.data.data.map(normalizeThreadConversation),
      })),
  getThreadConversation: (threadId: string) =>
    apiClient
      .get<SuccessResponse<ThreadConversationView>>(`/conversations/threads/${threadId}`)
      .then((res) => normalizeThreadConversation(extractResponseData(res.data))),
  getThreadConversationMessages: (threadId: string) =>
    apiClient
      .get<SuccessResponse<MessageDoc[]>>(`/conversations/threads/${threadId}/messages`)
      .then((res) => extractResponseData(res.data)),
  convertThreadToGroup: (
    threadId: string,
    data: { title: string; participant_ids: string[] }
  ) =>
    apiClient
      .post<SuccessResponse<ConvertThreadToGroupResponse>>(
        `/conversations/threads/${threadId}/convert-to-group`,
        data
      )
      .then((res) => {
        const result = extractResponseData(res.data);
        return {
          ...result,
          group: normalizeConversation(result.group),
          thread: normalizeConversation(result.thread),
        };
      }),
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
  createChannel: (data: {
    title: string;
    description?: string;
    visibility?: 'private' | 'public';
    posting_policy?: 'everyone' | 'admins';
    slug?: string;
    participant_ids?: string[];
  }) =>
    apiClient
      .post<SuccessResponse<Conversation>>('/conversations/channels', data)
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  getPublicBySlug: (slug: string) =>
    apiClient
      .get<SuccessResponse<Conversation>>(`/conversations/public/${encodeURIComponent(slug)}`)
      .then((res) => normalizeConversation(extractResponseData(res.data))),
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
      .post<SuccessResponse<ConversationJoinRequest>>(
        `/conversations/${conversationId}/join-requests/${requestId}/approve`
      )
      .then((res) => extractResponseData(res.data)),
  rejectJoinRequest: (conversationId: string, requestId: string) =>
    apiClient
      .post<SuccessResponse<ConversationJoinRequest>>(
        `/conversations/${conversationId}/join-requests/${requestId}/reject`
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
  updateMemberPermissions: (
    conversationId: string,
    memberUserId: string,
    permissions: Record<string, boolean> | null
  ) =>
    apiClient
      .patch<SuccessResponse<ParticipantView>>(
        `/conversations/${conversationId}/members/${memberUserId}/permissions`,
        { permissions }
      )
      .then((res) => extractResponseData(res.data)),
  openThreadConversation: (conversationId: string, messageId: string) =>
    apiClient
      .post<SuccessResponse<Conversation>>(
        `/conversations/${conversationId}/messages/${messageId}/thread-conversation`
      )
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  createOrGetDm: (peerUserId: string) =>
    apiClient
      .post<SuccessResponse<Conversation>>('/conversations', { peer_user_id: peerUserId })
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  createGroup: (data: { title: string; participant_ids: string[] }) =>
    apiClient
      .post<SuccessResponse<Conversation>>('/conversations/groups', data)
      .then((res) => normalizeConversation(extractResponseData(res.data))),
  listMembers: (conversationId: string) =>
    apiClient
      .get<SuccessResponse<ParticipantView[]>>(`/conversations/${conversationId}/members`)
      .then((res) => extractResponseData(res.data)),
  addMembers: (conversationId: string, participantIds: string[]) =>
    apiClient
      .post<SuccessResponse<ParticipantView[]>>(
        `/conversations/${conversationId}/members`,
        { participant_ids: participantIds }
      )
      .then((res) => extractResponseData(res.data)),
  removeMember: (conversationId: string, memberUserId: string) =>
    apiClient
      .delete(`/conversations/${conversationId}/members/${memberUserId}`)
      .then(() => undefined),
  updateMemberRole: (
    conversationId: string,
    memberUserId: string,
    role: 'admin' | 'member'
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

export const devicesApi = {
  register: (data: {
    device_id: string;
    name?: string;
    platform?: string;
    identity_public_key?: string;
    signing_public_key?: string;
    registration_id?: number;
  }) =>
    apiClient
      .post<SuccessResponse<DeviceView>>('/devices', data)
      .then((res) => extractResponseData(res.data)),
  uploadPreKeys: (deviceId: string, prekeys: PreKeyInput[]) =>
    apiClient
      .post<SuccessResponse<{ device_id: string; uploaded: number }>>(
        `/devices/${deviceId}/prekeys`,
        { prekeys }
      )
      .then((res) => extractResponseData(res.data)),
  getPreKeyBundle: (userId: string, deviceId?: string) =>
    apiClient
      .get<SuccessResponse<PreKeyBundle>>(`/users/${userId}/prekey-bundle`, {
        params: deviceId ? { device_id: deviceId } : undefined,
      })
      .then((res) => extractResponseData(res.data)),
};

export const realtimeApi = {
  getOnlineUsers: () =>
    apiClient
      .get<SuccessResponse<string[]>>('/realtime/online-users')
      .then((res) => extractResponseData(res.data)),
  getPresence: (userIds: string[]) =>
    apiClient
      .get<SuccessResponse<Record<string, PresenceStatus>>>('/realtime/presence', {
        params: { user_ids: userIds },
      })
      .then((res) => extractResponseData(res.data)),
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

export const pingsApi = {
  sendPing: (to_user_id: string) =>
    apiClient
      .post<SuccessResponse<Ping>>('/pings', { to_user_id })
      .then((res) => extractResponseData(res.data)),
  getIncoming: (limit = 20, cursor?: string) =>
    apiClient
      .get<PaginatedResponse<PingItem>>('/pings/incoming', { params: { limit, cursor } })
      .then((res) => res.data),
  getOutgoing: (limit = 20, cursor?: string) =>
    apiClient
      .get<PaginatedResponse<PingItem>>('/pings/outgoing', { params: { limit, cursor } })
      .then((res) => res.data),
  acceptPing: (ping_id: string) =>
    apiClient
      .post<SuccessResponse<Ping>>(`/pings/${ping_id}/accept`)
      .then((res) => extractResponseData(res.data)),
  declinePing: (ping_id: string) =>
    apiClient
      .post<SuccessResponse<Ping>>(`/pings/${ping_id}/decline`)
      .then((res) => extractResponseData(res.data)),
  cancelPing: (ping_id: string) =>
    apiClient
      .post<SuccessResponse<Ping>>(`/pings/${ping_id}/cancel`)
      .then((res) => extractResponseData(res.data)),
  blockUser: (peer_user_id: string) =>
    apiClient
      .post<SuccessResponse<Ping>>('/pings/block', { peer_user_id })
      .then((res) => extractResponseData(res.data)),
  unblockUser: (peer_user_id: string) =>
    apiClient
      .post<SuccessResponse<Ping>>('/pings/unblock', { peer_user_id })
      .then((res) => extractResponseData(res.data)),
  getBlockedUsers: () =>
    apiClient
      .get<SuccessResponse<Ping[]>>('/pings/blocked')
      .then((res) => extractResponseData(res.data)),
  getContacts: (limit = 20, cursor?: string) =>
    apiClient
      .get<PaginatedResponse<ContactListItem>>('/pings/contacts', { params: { limit, cursor } })
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

export const healthApi = {
  getLive: () => apiClient.get('/health/live'),
  getReady: () => apiClient.get('/health/ready'),
};
