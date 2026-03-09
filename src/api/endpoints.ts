import { apiClient } from './httpClient';
import { TokenPair, SuccessResponse, PaginatedResponse, MessageDoc, User, Conversation } from './types';

export const authApi = {
  register: (email: string) => apiClient.post('/auth/register', { email }),
  login: (email: string) => apiClient.post('/auth/login', { email }),
  verify: (email: string, code: string) =>
    apiClient.post<SuccessResponse<TokenPair>>('/auth/verify', { email, code }),
  logout: (refresh_token: string) => apiClient.post('/auth/logout', { refresh_token }),
};

export const usersApi = {
  getMe: () => apiClient.get<SuccessResponse<User>>('/users/me'),
  updateProfile: (data: { display_name?: string; bio?: string; is_private?: boolean; default_discovery_enabled?: boolean }) => 
    apiClient.patch<SuccessResponse<User>>('/users/me', data),
  updateUsername: (username: string) => apiClient.patch<SuccessResponse<User>>('/users/me/username', { username }),
  uploadAvatar: (formData: FormData) => apiClient.patch<SuccessResponse<User>>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteAvatar: () => apiClient.delete<SuccessResponse<User>>('/users/me/avatar'),
};

export const messagesApi = {
  uploadVoice: (formData: FormData) =>
    apiClient.post<SuccessResponse<MessageDoc>>('/messages/voice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  sendText: (receiver_id: string, text: string) => 
    apiClient.post<SuccessResponse<MessageDoc>>('/messages/text', { receiver_id, text }),
  getHistory: (userId: string, limit = 20, cursor?: string) =>
    apiClient.get<PaginatedResponse<MessageDoc>>(`/messages/conversations/${userId}`, {
      params: { limit, cursor },
    }),
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

export const healthApi = {
  getLive: () => apiClient.get('/health/live'),
  getReady: () => apiClient.get('/health/ready'),
};
