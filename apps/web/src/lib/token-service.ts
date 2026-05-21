// ============================================
// Token Service — Web Implementation of TokenStorageAdapter
// ============================================
// Access tokens are stored in localStorage for persistence across tabs.
// Refresh tokens are stored in httpOnly cookies (set by the backend) —
// they NEVER touch JavaScript or localStorage.
//
// Implements the shared TokenStorageAdapter interface, making it
// trivially swappable for React Native (SecureStore), Electron
// (safeStorage), or other platforms.

import type { TokenStorageAdapter } from '@tradesim/shared';

const STORAGE_KEYS = {
  accessToken: 'tradesim:access_token',
} as const;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

/**
 * Web-specific token storage using localStorage.
 * Implements the shared TokenStorageAdapter interface.
 *
 * IMPORTANT: Only the ACCESS token is stored here.
 * The REFRESH token lives in an httpOnly cookie managed by the backend.
 * This ensures JavaScript never has access to the refresh token (XSS safe).
 */
class WebTokenStorage implements TokenStorageAdapter {
  getAccessToken(): string | null {
    return getStorage()?.getItem(STORAGE_KEYS.accessToken) ?? null;
  }

  getRefreshToken(): string | null {
    // Refresh token is in httpOnly cookie — not accessible via JS.
    // The browser sends it automatically on requests to /api/auth/*.
    return null;
  }

  setTokens(accessToken: string, _refreshToken: string): void {
    // Only store access token. Refresh token is set by the backend
    // as an httpOnly cookie — we intentionally ignore it here.
    getStorage()?.setItem(STORAGE_KEYS.accessToken, accessToken);
  }

  setAccessToken(accessToken: string): void {
    getStorage()?.setItem(STORAGE_KEYS.accessToken, accessToken);
  }

  clearTokens(): void {
    getStorage()?.removeItem(STORAGE_KEYS.accessToken);
    // httpOnly cookie is cleared by the backend on POST /auth/logout
  }

  hasTokens(): boolean {
    return !!this.getAccessToken();
  }

  async refreshTokens(): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important: sends the httpOnly refresh cookie
      });

      if (!response.ok) {
        this.clearTokens();
        return null;
      }

      const { data } = await response.json();
      const newAccessToken = data.accessToken;
      
      if (newAccessToken) {
        this.setAccessToken(newAccessToken);
        return newAccessToken;
      }
      return null;
    } catch (error) {
      this.clearTokens();
      return null;
    }
  }
}

/** Singleton instance for the web app */
export const tokenService = new WebTokenStorage();
