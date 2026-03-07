import { apiClient } from './client';
import { TokenPair, SuccessResponse, PaginatedResponse, MessageDoc } from './types';

export const authApi = {
  register: (email: string) => apiClient.post('/auth/register', { email }),
  login: (email: string) => apiClient.post('/auth/login', { email }),
  verify: (email: string, code: string) =>
    apiClient.post<SuccessResponse<TokenPair>>('/auth/verify', { email, code }),
  logout: (refresh_token: string) => apiClient.post('/auth/logout', { refresh_token }),
};

export const messagesApi = {
  uploadVoice: (formData: FormData) =>
    apiClient.post<SuccessResponse<MessageDoc>>('/messages/voice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getHistory: (userId: string, limit = 20, cursor?: string) =>
    apiClient.get<PaginatedResponse<MessageDoc>>(`/messages/${userId}`, {
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
