import { create } from 'zustand';
import { tokenStore } from '@/features/auth/api/tokenStore';
import { sessionManager } from '@/features/auth/api/session';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userEmail: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUserEmail: (email: string) => void;
  logout: () => void;
}

// Initialize state from tokenStore
const getInitialState = () => ({
  accessToken: tokenStore.getAccessToken(),
  refreshToken: tokenStore.getRefreshToken(),
  userEmail: tokenStore.getUserEmail(),
  userId: tokenStore.getUserId(),
  isAuthenticated: tokenStore.isAuthenticated(),
});

export const useAuthStore = create<AuthState>((set) => {
  // Subscribe to session changes
  sessionManager.subscribe((isAuthenticated) => {
    if (!isAuthenticated) {
      set({
        accessToken: null,
        refreshToken: null,
        userEmail: null,
        userId: null,
        isAuthenticated: false,
      });
    } else {
      // Refresh state from tokenStore
      set(getInitialState());
    }
  });

  return {
    ...getInitialState(),
    
    setTokens: (accessToken, refreshToken) => {
      sessionManager.login(accessToken, refreshToken);
      // State update happens via subscription or we can do it optimistically here
      set({
        accessToken,
        refreshToken,
        isAuthenticated: true,
        userId: tokenStore.getUserId(), // tokenStore is updated by sessionManager
        userEmail: tokenStore.getUserEmail(),
      });
    },

    setUserEmail: (email) => set({ userEmail: email }),

    logout: () => {
      sessionManager.logout();
      // State update happens via subscription
    },
  };
});
