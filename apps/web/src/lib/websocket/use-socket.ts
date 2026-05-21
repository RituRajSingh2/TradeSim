'use client';

/**
 * useSocket — React hook for managed WebSocket lifecycle.
 *
 * Handles:
 *   - Connection on mount (when user is authenticated)
 *   - Cleanup on unmount / logout
 *   - Connection state tracking
 *   - Error surface
 *
 * Hardening:
 *   - Listens to auth:expired from server.
 *   - Gracefully attempts silent refresh, and reconnects without full page reload.
 *   - Exits to logout strictly on failed refresh.
 */

import { useEffect, useRef, useState } from 'react';
import {
  getSocket,
  destroySocket,
  isSocketReconnecting,
  setSocketReconnecting,
  type TypedSocket,
} from './socket';
import { useAuthStore } from '@/stores/auth-store';
import { tokenService } from '@/lib/token-service';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseSocketReturn {
  socket: TypedSocket | null;
  status: SocketStatus;
  error: string | null;
}

export function useSocket(): UseSocketReturn {
  // Use isAuthenticated as the trigger — token is in tokenService
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [status, setStatus] = useState<SocketStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    let isMounted = true;
    let sock: TypedSocket | null = null;

    const handleConnect = () => {
      if (isMounted) {
        setStatus('connected');
        setError(null);
      }
    };

    const handleDisconnect = (reason: string) => {
      if (isMounted) {
        setStatus('disconnected');
        if (reason === 'io server disconnect') {
          setError('Connection closed by server');
        }
      }
    };

    const handleConnectError = (err: Error) => {
      if (isMounted) {
        setStatus('error');
        setError(err.message);
      }
    };

    const handleAuthExpired = async (payload: { reason: string; message: string }) => {
      console.warn(`Socket auth expired: ${payload.reason}`);
      
      // Prevent rapid concurrent reconnect attempts
      if (isSocketReconnecting() || !isMounted) return;
      setSocketReconnecting(true);
      
      try {
        // Attempt silent refresh via the tokenService API interceptor logic
        const newAccessToken = await tokenService.refreshTokens();
        
        if (newAccessToken && isMounted) {
          console.log('Socket token refreshed. Reconnecting...');
          destroySocket(); // Clean up old listeners and socket
          
          sock = getSocket(newAccessToken);
          socketRef.current = sock;
          
          sock.on('connect', handleConnect);
          sock.on('disconnect', handleDisconnect);
          sock.on('connect_error', handleConnectError);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sock.on('auth:expired' as any, handleAuthExpired);
          
        } else {
          throw new Error('Refresh failed');
        }
      } catch (error) {
        console.error('Socket token refresh failed. Forcing logout.', error);
        if (isMounted) {
          logout();
        }
      } finally {
        setSocketReconnecting(false);
      }
    };

    async function initSocket() {
      // Don't init if already in the middle of a reconnect flow
      if (isSocketReconnecting()) return;

      if (!isAuthenticated) {
        destroySocket();
        socketRef.current = null;
        if (isMounted) setStatus('disconnected');
        return;
      }

      const accessToken = tokenService.getAccessToken();

      if (!accessToken || !isMounted) {
        if (isMounted) setStatus('disconnected');
        return;
      }

      if (isMounted) setStatus('connecting');
      sock = getSocket(accessToken);
      socketRef.current = sock;

      sock.on('connect', handleConnect);
      sock.on('disconnect', handleDisconnect);
      sock.on('connect_error', handleConnectError);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sock.on('auth:expired' as any, handleAuthExpired);

      if (sock.connected && isMounted) setStatus('connected');
    }

    initSocket();

    return () => {
      isMounted = false;
      if (sock) {
        sock.off('connect', handleConnect);
        sock.off('disconnect', handleDisconnect);
        sock.off('connect_error', handleConnectError);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sock.off('auth:expired' as any, handleAuthExpired);
      }
    };
  }, [isAuthenticated, logout]);

  return {
    socket: socketRef.current,
    status,
    error,
  };
}
