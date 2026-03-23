import { AxiosProgressEvent } from 'axios';
import { apiClient } from './httpClient';
import {
  TokenPair,
  SuccessResponse,
  PaginatedResponse,
  MessageDoc,
  User,
  Conversation,
  DiscoveredUser,
  Ping,
  PingItem,
  PingResponse,
  MessageReactionsUpdate,
  ReplyMode,
  ThreadSummary,
  ConversationReadUpdate,
  CreateCallRequest,
  AcceptCallRequest,
  CallSession,
  CallDoc,
} from './types';

const extractResponseData = <T>(payload: T | SuccessResponse<T>): T => {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    'success' in payload
  ) {
    return payload.data;
  }

  return payload as T;
};

export const authApi = {
  register: (email: string) => apiClient.post('/auth/register', { email }),
  login: (email: string) => apiClient.post('/auth/login', { email }),
  verify: (email: string, code: string) =>
    apiClient.post<SuccessResponse<TokenPair>>('/auth/verify', { email, code }),
  logout: (refresh_token: string) => apiClient.post('/auth/logout', { refresh_token }),
  passkeys: {
    registerStart: (nickname?: string) => apiClient.post('/auth/passkeys/register/start', { nickname }),
    registerFinish: (data: { credential: any, nickname?: string }) => apiClient.post('/auth/passkeys/register/finish', data),
    loginStart: (email: string) => apiClient.post('/auth/passkeys/login/start', { email }),
    loginFinish: (data: { email: string, credential: any }) => apiClient.post<SuccessResponse<TokenPair>>('/auth/passkeys/login/finish', data),
    list: () => apiClient.get('/auth/passkeys'),
    delete: (credentialId: string) => apiClient.delete(`/auth/passkeys/${credentialId}`),
  }
};

export const usersApi = {
  getMe: () => apiClient.get<SuccessResponse<User>>('/users/me'),
  getUser: (id: string) => apiClient.get<SuccessResponse<User>>(`/users/${id}`),
  updateProfile: (data: { display_name?: string; bio?: string; is_private?: boolean; default_discovery_enabled?: boolean }) => 
    apiClient.patch<SuccessResponse<User>>('/users/me', data),
  updateUsername: (username: string) => apiClient.patch<SuccessResponse<User>>('/users/me/username', { username }),
  uploadAvatar: (formData: FormData) => apiClient.patch<SuccessResponse<User>>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteAvatar: () => apiClient.delete<SuccessResponse<User>>('/users/me/avatar'),
};

export const messagesApi = {
  uploadMedia: (data: {
    type: 'voice' | 'image' | 'sticker' | 'video' | 'file';
    receiver_id: string;
    file: File;
    text?: string;
    duration_ms?: number;
    reply_mode?: ReplyMode | null;
    reply_to_message_id?: string;
    signal?: AbortSignal;
    onUploadProgress?: (event: AxiosProgressEvent) => void;
  }) => {
    const formData = new FormData();
    formData.append('type', data.type);
    formData.append('receiver_id', data.receiver_id);
    formData.append('file', data.file);
    if (data.text) formData.append('text', data.text);
    if (data.duration_ms) formData.append('duration_ms', data.duration_ms.toString());
    if (data.reply_mode) formData.append('reply_mode', data.reply_mode);
    if (data.reply_to_message_id) formData.append('reply_to_message_id', data.reply_to_message_id);

    return apiClient.post<SuccessResponse<MessageDoc>>('/messages/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: data.signal,
      onUploadProgress: data.onUploadProgress,
    });
  },
  sendText: (data: {
    receiver_id: string;
    text: string;
    reply_mode?: ReplyMode | null;
    reply_to_message_id?: string;
  }) =>
    apiClient.post<SuccessResponse<MessageDoc>>('/messages/text', data),
  getHistory: (userId: string, limit = 20, cursor?: string) =>
    apiClient.get<PaginatedResponse<MessageDoc>>(`/messages/conversations/${userId}`, {
      params: { limit, cursor },
    }),
  markDelivered: (messageId: string) =>
    apiClient.post<MessageDoc>(`/messages/${messageId}/delivered`),
  markRead: (messageId: string) =>
    apiClient.post<MessageDoc>(`/messages/${messageId}/read`),
  editMessage: (messageId: string, text: string) =>
    apiClient.patch<MessageDoc>(`/messages/${messageId}`, { text }),
  deleteMessage: (messageId: string) =>
    apiClient.delete<MessageDoc>(`/messages/${messageId}`),
  getThreadMessages: (messageId: string, limit = 20, cursor?: string) =>
    apiClient.get<PaginatedResponse<MessageDoc>>(`/messages/${messageId}/thread`, {
      params: { limit, cursor },
    }),
  getThreadSummary: (messageId: string) =>
    apiClient.get<SuccessResponse<ThreadSummary>>(`/messages/${messageId}/thread-summary`),
  toggleReaction: (messageId: string, emoji: string) =>
    apiClient.post<SuccessResponse<MessageReactionsUpdate>>(`/messages/${messageId}/reactions`, { emoji }),
  removeOwnReaction: (messageId: string, emoji: string) =>
    apiClient.delete<SuccessResponse<MessageReactionsUpdate>>(
      `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/me`
    ),
  markConversationRead: (userId: string) =>
    apiClient.post<ConversationReadUpdate>(`/messages/conversations/${userId}/read`),
};

export const conversationsApi = {
  getConversations: (limit = 20, cursor?: string) => 
    apiClient.get<PaginatedResponse<Conversation>>('/messages/conversations', {
      params: { limit, cursor },
    }),
};

export const realtimeApi = {
  getOnlineUsers: () => apiClient.get<SuccessResponse<string[]>>('/realtime/online-users'),
  getPresence: (userIds: string[]) =>
    apiClient.get<SuccessResponse<Record<string, string>>>('/realtime/presence', {
      params: { user_ids: userIds },
    }),
};

export const discoveryApi = {
  regenerateCode: () => apiClient.post('/discovery/code/regenerate'),
  resolveCode: (code: string) => apiClient.post<{ data: DiscoveredUser }>('/discovery/code/resolve', { code }),
  createLink: (expires_in_seconds: number, max_uses: number) => apiClient.post('/discovery/links', { expires_in_seconds, max_uses }),
  resolveLink: (token: string) => apiClient.get<{ data: DiscoveredUser }>(`/discovery/invite/${token}`),
  searchUsers: (q: string) => apiClient.get<{ data: DiscoveredUser[] }>('/discovery/users/search', { params: { q } }),
};

export const pingsApi = {
  sendPing: (to_user_id: string) => apiClient.post<SuccessResponse<Ping>>('/pings', { to_user_id }),
  getIncoming: (limit = 20, cursor?: string) => 
    apiClient.get<PaginatedResponse<PingItem>>('/pings/incoming', { params: { limit, cursor } }),
  getOutgoing: (limit = 20, cursor?: string) => 
    apiClient.get<PaginatedResponse<PingItem>>('/pings/outgoing', { params: { limit, cursor } }),
  acceptPing: (ping_id: string) => apiClient.post<SuccessResponse<Ping>>(`/pings/${ping_id}/accept`),
  declinePing: (ping_id: string) => apiClient.post<SuccessResponse<Ping>>(`/pings/${ping_id}/decline`),
  cancelPing: (ping_id: string) => apiClient.post<PingResponse>(`/pings/${ping_id}/cancel`),
  blockUser: (peer_user_id: string) => apiClient.post<PingResponse>('/pings/block', { peer_user_id }),
  unblockUser: (peer_user_id: string) => apiClient.post<PingResponse>('/pings/unblock', { peer_user_id }),
  getBlockedUsers: () => apiClient.get<PingResponse[]>('/pings/blocked'),
};

export const callsApi = {
  create: (data: CreateCallRequest) =>
    apiClient.post<SuccessResponse<CallSession>>('/calls', data),
  getActive: async () => {
    const response = await apiClient.get<SuccessResponse<CallSession | null> | CallSession | null>('/calls/active');
    return extractResponseData(response.data);
  },
  accept: (callId: string, data: AcceptCallRequest) =>
    apiClient.post<SuccessResponse<CallSession>>(`/calls/${callId}/accept`, data),
  reject: async (callId: string) => {
    const response = await apiClient.post<SuccessResponse<CallDoc> | CallDoc>(`/calls/${callId}/reject`);
    return extractResponseData(response.data);
  },
  end: async (callId: string) => {
    const response = await apiClient.post<SuccessResponse<CallDoc> | CallDoc>(`/calls/${callId}/end`);
    return extractResponseData(response.data);
  },
};

export const healthApi = {
  getLive: () => apiClient.get('/health/live'),
  getReady: () => apiClient.get('/health/ready'),
};
