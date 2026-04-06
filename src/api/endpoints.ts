import { AxiosProgressEvent } from 'axios';
import { apiClient } from './httpClient';
import { extractResponseData } from './utils';
import {
  AcceptCallRequest,
  CallDoc,
  CallHistoryItem,
  CallSession,
  Conversation,
  ConversationReadUpdate,
  CreateCallRequest,
  CreateInviteLinkResponse,
  DeleteMessageResponse,
  DiscoveredUser,
  AuthChallengeResponse,
  MessageDoc,
  MessageResponse,
  PaginatedResponse,
  PasskeyAuthenticationOptionsPayload,
  PasskeyDeleteResult,
  PasskeyRegistrationOptionsPayload,
  PasskeyResponse,
  Ping,
  PingItem,
  PreviewMediaKind,
  ReplyMode,
  RegenerateCodeResponse,
  SelectedUserProfile,
  SuccessResponse,
  ThreadSummary,
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

export const messagesApi = {
  uploadMedia: async (data: {
    receiver_id: string;
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
    formData.append('receiver_id', data.receiver_id);
    formData.append('file', data.file);
    if (data.type === 'media') {
      formData.append('media_kind', data.media_kind);
    }
    if (data.text) formData.append('text', data.text);
    if (data.duration_ms) formData.append('duration_ms', data.duration_ms.toString());
    if (data.reply_mode) formData.append('reply_mode', data.reply_mode);
    if (data.reply_to_message_id) formData.append('reply_to_message_id', data.reply_to_message_id);

    const response = await apiClient.post<SuccessResponse<MessageDoc>>('/messages/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: data.signal,
      onUploadProgress: data.onUploadProgress,
    });
    return extractResponseData(response.data);
  },
  sendText: (data: {
    receiver_id: string;
    text: string;
    reply_mode?: ReplyMode | null;
    reply_to_message_id?: string;
  }) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>('/messages/text', data)
      .then((res) => extractResponseData(res.data)),
  getHistory: (userId: string, limit = 20, cursor?: string) =>
    apiClient
      .get<PaginatedResponse<MessageDoc>>(`/messages/conversations/${userId}`, {
        params: { limit, cursor },
      })
      .then((res) => res.data),
  markDelivered: (messageId: string) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>(`/messages/${messageId}/delivered`)
      .then((res) => extractResponseData(res.data)),
  markRead: (messageId: string) =>
    apiClient
      .post<SuccessResponse<MessageDoc>>(`/messages/${messageId}/read`)
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
  removeOwnReaction: (messageId: string, emoji: string) =>
    apiClient
      .delete<SuccessResponse<MessageDoc>>(
        `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/me`
      )
      .then((res) => extractResponseData(res.data)),
  markConversationRead: (userId: string) =>
    apiClient
      .post<SuccessResponse<ConversationReadUpdate>>(`/messages/conversations/${userId}/read`)
      .then((res) => extractResponseData(res.data)),
};

export const conversationsApi = {
  getConversations: (limit = 20, cursor?: string) =>
    apiClient
      .get<PaginatedResponse<Conversation>>('/messages/conversations', {
        params: { limit, cursor },
      })
      .then((res) => res.data),
};

export const realtimeApi = {
  getOnlineUsers: () =>
    apiClient
      .get<SuccessResponse<string[]>>('/realtime/online-users')
      .then((res) => extractResponseData(res.data)),
  getPresence: (userIds: string[]) =>
    apiClient
      .get<SuccessResponse<Record<string, string>>>('/realtime/presence', {
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
};

export const healthApi = {
  getLive: () => apiClient.get('/health/live'),
  getReady: () => apiClient.get('/health/ready'),
};
