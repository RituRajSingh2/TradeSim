'use client';

/**
 * useSocket — React hook for managed WebSocket lifecycle.
 *
 * Handles:
 *   - Connection on mount (when user is authenticated)
 *   - Cleanup on unmount / logout
 *   - Connection state tracking
 *   - Error surface
 */

import { useEffect, useRef, useState } from 'react';
import { getSocket, destroySocket, type TypedSocket } from './socket';
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

    async function initSocket() {
      if (!isAuthenticated) {
        destroySocket();
        socketRef.current = null;
        if (isMounted) setStatus('disconnected');
        return;
      }

      let accessToken = tokenService.getAccessToken();
      if (accessToken instanceof Promise) {
        accessToken = await accessToken;
      }

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

      if (sock.connected && isMounted) setStatus('connected');
    }

    initSocket();

    return () => {
      isMounted = false;
      if (sock) {
        sock.off('connect', handleConnect);
        sock.off('disconnect', handleDisconnect);
        sock.off('connect_error', handleConnectError);
      }
    };
  }, [isAuthenticated]);

  return {
    socket: socketRef.current,
    status,
    error,
  };
}

