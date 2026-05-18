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
    if (!isAuthenticated) {
      // Logged out — destroy socket
      destroySocket();
      socketRef.current = null;
      setStatus('disconnected');
      return;
    }

    // Read token synchronously from tokenService
    const accessToken = tokenService.getAccessToken();
    if (!accessToken) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    const sock = getSocket(accessToken);
    socketRef.current = sock;

    const handleConnect = () => {
      setStatus('connected');
      setError(null);
    };

    const handleDisconnect = (reason: string) => {
      setStatus('disconnected');
      // Server forced disconnect (e.g. auth revoked) — don't auto-reconnect
      if (reason === 'io server disconnect') {
        setError('Connection closed by server');
      }
    };

    const handleConnectError = (err: Error) => {
      setStatus('error');
      setError(err.message);
    };

    sock.on('connect', handleConnect);
    sock.on('disconnect', handleDisconnect);
    sock.on('connect_error', handleConnectError);

    // If already connected (e.g. hot reload), update state immediately
    if (sock.connected) setStatus('connected');

    return () => {
      sock.off('connect', handleConnect);
      sock.off('disconnect', handleDisconnect);
      sock.off('connect_error', handleConnectError);
      // Don't destroy socket here — it's shared across components.
      // destroySocket() is called above when isAuthenticated becomes false.
    };
  }, [isAuthenticated]);

  return {
    socket: socketRef.current,
    status,
    error,
  };
}

