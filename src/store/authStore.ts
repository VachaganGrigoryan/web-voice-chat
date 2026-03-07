import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';

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

interface DecodedToken {
  sub: string; // Assuming 'sub' is the user ID
  email: string;
  exp: number;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userEmail: null,
      userId: null,
      isAuthenticated: false,
      setTokens: (accessToken, refreshToken) => {
        try {
          const decoded = jwtDecode<DecodedToken>(accessToken);
          set({
            accessToken,
            refreshToken,
            isAuthenticated: true,
            userId: decoded.sub,
            userEmail: decoded.email,
          });
        } catch (error) {
          console.error('Failed to decode token:', error);
          set({ accessToken, refreshToken, isAuthenticated: true });
        }
      },
      setUserEmail: (email) => set({ userEmail: email }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          userEmail: null,
          userId: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
