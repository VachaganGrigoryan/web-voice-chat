import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { APP_ROUTES, getAbsoluteAppUrl } from '@/app/routes';
import { tokenStore } from '@/auth/tokenStore';

export const API_URL = import.meta.env.VITE_API_URL || 'https://voca-api.notallow.cc';

// Callbacks for external coordination
let onTokenUpdate: ((accessToken: string) => void) | null = null;
let onLogout: (() => void) | null = null;

export const setTokenUpdateCallback = (callback: (token: string) => void) => {
  onTokenUpdate = callback;
};

export const setLogoutCallback = (callback: () => void) => {
  onLogout = callback;
};

/**
 * Called when a container-scoped request is refused, so the capability cache can
 * discard the entry that said it would be allowed.
 *
 * The client gates affordances on cached capabilities, which can go stale. This
 * bounds how long a wrong UI survives: the first refusal corrects it. Gating is
 * for affordance quality; the server remains the only authority.
 */
let onForbidden: ((scope: string, id: string) => void) | null = null;

export const setForbiddenCallback = (
  callback: (scope: string, id: string) => void
) => {
  onForbidden = callback;
};

/** Container-scoped path prefixes whose 403 identifies a resource. */
const FORBIDDEN_SCOPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/channels\/([^/]+)/, 'channel'],
  [/^\/conversations\/([^/]+)/, 'conversation'],
  [/^\/spaces\/([^/]+)/, 'space'],
];

const reportForbidden = (url: string | undefined) => {
  if (!onForbidden || !url) return;
  // Strip the base URL and any query string before matching.
  const path = url.replace(API_URL, '').split('?')[0];
  for (const [pattern, scope] of FORBIDDEN_SCOPES) {
    const match = pattern.exec(path);
    if (match) {
      onForbidden(scope, match[1]);
      return;
    }
  }
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
          window.location.href = getAbsoluteAppUrl(APP_ROUTES.auth);
        }
        
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 403) {
      reportForbidden(originalRequest?.url);
    }

    return Promise.reject(error);
  }
);
