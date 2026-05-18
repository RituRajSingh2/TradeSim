// ============================================
// Transport-Agnostic Token Storage Adapter
// ============================================
//
// This interface decouples auth/session logic from the storage
// mechanism. Implementations:
//
// - Web:           localStorage (already built in apps/web/src/lib/token-service.ts)
// - React Native:  expo-secure-store / react-native-keychain
// - Desktop:       electron safe-storage
// - SSR:           httpOnly cookies via next-auth
//
// Usage:
//   const adapter = new WebTokenStorage();   // or MobileTokenStorage
//   const auth = createAuthClient(adapter);
//

export interface TokenStorageAdapter {
  /** Retrieve the stored access token. */
  getAccessToken(): string | null | Promise<string | null>;

  /** Retrieve the stored refresh token. */
  getRefreshToken(): string | null | Promise<string | null>;

  /** Persist both tokens. */
  setTokens(accessToken: string, refreshToken: string): void | Promise<void>;

  /** Update only the access token (after refresh). */
  setAccessToken(accessToken: string): void | Promise<void>;

  /** Remove all tokens (logout). */
  clearTokens(): void | Promise<void>;

  /** Whether any access token exists. */
  hasTokens(): boolean | Promise<boolean>;
}
