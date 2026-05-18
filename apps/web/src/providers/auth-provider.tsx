'use client';

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { apiGet, apiPost } from '@/lib/api-client';
import { tokenService } from '@/lib/token-service';
import type { User } from '@tradesim/shared';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (firebaseIdToken: string, phone: string, otp: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider — wraps the app with authentication context.
 *
 * On mount:
 * 1. Checks if an access token exists in storage
 * 2. If yes, fetches /auth/me to validate the token and get user data
 * 3. If the token is expired, the API client interceptor handles refresh via httpOnly cookie
 *
 * Login flow:
 * 1. Client-side Firebase sends OTP + verifies → gets Firebase ID token
 * 2. Frontend sends ID token to POST /api/auth/login
 * 3. Backend verifies, creates user if new, returns accessToken + sets httpOnly cookie
 * 4. Frontend stores accessToken in tokenService, sets user in store
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user,
    isAuthenticated,
    isLoading,
    setUser,
    setTokens,
    logout: storeLogout,
    setLoading,
  } = useAuthStore();

  // Hydrate auth state on mount
  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      const accessToken = tokenService.getAccessToken() as string | null;

      if (!accessToken) {
        if (!isCancelled) setLoading(false);
        return;
      }

      try {
        // Validate token by fetching current user
        const userData = await apiGet<User>('/auth/me');
        if (!isCancelled) setUser(userData);
      } catch {
        // Token invalid or expired (interceptor already tried refresh)
        if (!isCancelled) storeLogout();
      }
    };

    hydrate();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (
      firebaseIdToken: string,
      phone: string,
      otp: string,
      referralCode?: string,
    ) => {
      setLoading(true);

      try {
        const response = await apiPost<{
          user: { id: string; phone: string; name: string | null; isNewUser: boolean };
          accessToken: string;
        }>('/auth/login', {
          phone,
          otp,
          firebaseIdToken,
          referralCode: referralCode || undefined,
        });

        // Store access token (refresh token is in httpOnly cookie)
        (tokenService as { setAccessToken: (t: string) => void }).setAccessToken(
          response.accessToken,
        );

        // Fetch full user profile
        const fullUser = await apiGet<User>('/auth/me');
        setUser(fullUser);
      } catch (error) {
        setLoading(false);
        throw error;
      }
    },
    [setUser, setLoading],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout', { allDevices: false });
    } catch {
      // Logout even if API call fails
    }
    storeLogout();
  }, [storeLogout]);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context.
 * Must be used within <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
