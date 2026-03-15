import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { tokenStore } from '@/features/auth/api/tokenStore';

export const API_URL = import.meta.env.VITE_API_URL || 'https://voice-chat.vachagan.dev';

// Callbacks for external coordination
let onTokenUpdate: ((accessToken: string) => void) | null = null;
let onLogout: (() => void) | null = null;

export const setTokenUpdateCallback = (callback: (token: string) => void) => {
  onTokenUpdate = callback;
};

export const setLogoutCallback = (callback: () => void) => {
  onLogout = callback;
};

// Create a dedicated instance for refresh calls to avoid interceptors
const refreshClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenStore.getRefreshToken();

      if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { data } = await refreshClient.post('/auth/refresh', { refresh_token: refreshToken });
        const { access_token, refresh_token: newRefreshToken } = data.data;

        tokenStore.setTokens(access_token, newRefreshToken);
        
        if (onTokenUpdate) {
          onTokenUpdate(access_token);
        }

        processQueue(null, access_token);
        
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        tokenStore.clearTokens();
        
        if (onLogout) {
          onLogout();
        } else {
          window.location.href = '/#/auth';
        }
        
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
