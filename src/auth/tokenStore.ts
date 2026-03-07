import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  sub: string;
  email: string;
  exp: number;
}

class TokenStore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private readonly STORAGE_KEY_ACCESS = 'auth_access_token';
  private readonly STORAGE_KEY_REFRESH = 'auth_refresh_token';

  constructor() {
    this.accessToken = localStorage.getItem(this.STORAGE_KEY_ACCESS);
    this.refreshToken = localStorage.getItem(this.STORAGE_KEY_REFRESH);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem(this.STORAGE_KEY_ACCESS, accessToken);
    localStorage.setItem(this.STORAGE_KEY_REFRESH, refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem(this.STORAGE_KEY_ACCESS);
    localStorage.removeItem(this.STORAGE_KEY_REFRESH);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getUserId(): string | null {
    if (!this.accessToken) return null;
    try {
      const decoded = jwtDecode<DecodedToken>(this.accessToken);
      return decoded.sub;
    } catch {
      return null;
    }
  }

  getUserEmail(): string | null {
    if (!this.accessToken) return null;
    try {
      const decoded = jwtDecode<DecodedToken>(this.accessToken);
      return decoded.email;
    } catch {
      return null;
    }
  }
}

export const tokenStore = new TokenStore();
