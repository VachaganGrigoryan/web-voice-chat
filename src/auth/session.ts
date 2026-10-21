import { tokenStore } from './tokenStore';
import { APP_ROUTES, getAbsoluteAppUrl } from '@/app/routes';
import { socketClient } from '@/socket/socketClient';
import { disablePush } from '@/features/notifications/usePushSubscription';
import { unsubscribeLocally } from '@/features/notifications/push';
import { apiClient, setTokenUpdateCallback, setLogoutCallback } from '@/api/httpClient';

type AuthStateListener = (isAuthenticated: boolean) => void;

class SessionManager {
  private initialized = false;
  private listeners: Set<AuthStateListener> = new Set();

  constructor() {
    this.initialize();
  }

  initialize() {
    if (this.initialized) return;

    // Register callbacks with httpClient
    setTokenUpdateCallback((token) => {
      console.log('Session: Token refreshed, reconnecting socket...');
      socketClient.reconnect();
      // No need to notify auth store about token refresh unless user details changed
      // But we might want to update the token in memory if authStore keeps a copy
    });

    setLogoutCallback(async () => {
      console.log('Session: Logout triggered by refresh failure');
      // No token left to delete it server-side, so stop this browser receiving the old account's
      // pushes; capped like logout() so it never holds the redirect.
      await Promise.race([unsubscribeLocally(), new Promise((r) => setTimeout(r, 2000))]);
      this.handleLogoutInternal();
    });

    // Check if we have a token and initialize socket
    const token = tokenStore.getAccessToken();
    if (token) {
      console.log('Session: Restoring session...');
      socketClient.connect();
    }

    this.initialized = true;
  }

  subscribe(listener: AuthStateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(isAuthenticated: boolean) {
    this.listeners.forEach((listener) => listener(isAuthenticated));
  }

  async login(accessToken: string, refreshToken: string) {
    console.log('Session: Logging in...');
    tokenStore.setTokens(accessToken, refreshToken);
    socketClient.connect();
    this.notifyListeners(true);
  }

  async logout() {
    console.log('Session: Logging out...');
    const refreshToken = tokenStore.getRefreshToken();

    // Needs the access token, so run before clearing; capped so it never blocks logout.
    await Promise.race([disablePush(), new Promise((r) => setTimeout(r, 2000))]);

    // Attempt to notify server, but don't block
    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refresh_token: refreshToken });
      } catch (err) {
        console.warn('Session: Logout API call failed', err);
      }
    }

    this.handleLogoutInternal();
  }

  private handleLogoutInternal() {
    tokenStore.clearTokens();
    socketClient.disconnect();
    this.notifyListeners(false);
    
    // Force reload to clear any in-memory state if needed, or just redirect
    window.location.href = getAbsoluteAppUrl(APP_ROUTES.auth);
  }

  isAuthenticated() {
    return tokenStore.isAuthenticated();
  }
}

export const sessionManager = new SessionManager();
