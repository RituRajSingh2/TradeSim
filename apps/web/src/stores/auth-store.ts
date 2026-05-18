import { create } from 'zustand';
import type { User } from '@tradesim/shared';
import { tokenService } from '@/lib/token-service';

interface AuthState {
  /** Current authenticated user, null if not logged in. */
  user: User | null;
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;
  /** Whether the initial auth hydration is in progress. */
  isLoading: boolean;
}

interface AuthActions {
  /** Set user after successful login/token verification. */
  setUser: (user: User) => void;
  /** Persist both tokens and update store state. */
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Clear all auth state and tokens. */
  logout: () => void;
  /** Set loading state. */
  setLoading: (loading: boolean) => void;
  /**
   * Hydrate auth state from persisted tokens on app mount.
   * Returns true if a token was found (caller should fetch user profile).
   */
  hydrate: () => boolean;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  // ---- State ----
  user: null,
  isAuthenticated: false,
  isLoading: true,

  // ---- Actions ----
  setUser: (user) =>
    set({ user, isAuthenticated: true, isLoading: false }),

  setTokens: (accessToken, refreshToken) => {
    tokenService.setTokens(accessToken, refreshToken);
  },

  logout: () => {
    tokenService.clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (isLoading) => set({ isLoading }),

  hydrate: () => {
    // WebTokenStorage.hasTokens() is always synchronous.
    // The adapter interface allows async for mobile (SecureStore),
    // but the web implementation is guaranteed sync.
    const hasToken = tokenService.hasTokens() as boolean;
    if (hasToken) {
      set({ isLoading: true });
    } else {
      set({ isLoading: false });
    }
    return hasToken;
  },
}));
