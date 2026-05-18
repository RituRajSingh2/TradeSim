/**
 * WebSocket client — singleton Socket.IO connection with JWT auth.
 *
 * Architecture:
 *   - Single shared socket instance per browser session
 *   - JWT injected from in-memory auth store on connect
 *   - Typed using ClientToServerEvents / ServerToClientEvents from @tradesim/shared
 *   - Auto-reconnect with exponential backoff (built into Socket.IO)
 *   - Visibility-aware: pauses on tab hide, resumes on tab show
 */

import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@tradesim/shared';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ---- Module-level singleton ----
let socket: TypedSocket | null = null;
let visibilityHandler: (() => void) | null = null;

const WS_URL =
  process.env.NEXT_PUBLIC_API_WS_URL || 'http://localhost:3001';

/**
 * Create and return the singleton WebSocket connection.
 * Safe to call multiple times — returns the existing socket if connected.
 *
 * @param accessToken - In-memory access token (NOT from localStorage)
 */
export function getSocket(accessToken: string): TypedSocket {
  if (socket?.connected) return socket;

  // Disconnect stale socket before recreating
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(WS_URL, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
    // Don't auto-connect — caller calls connect() explicitly
    autoConnect: false,
  }) as TypedSocket;

  // Register visibility-based pause/resume
  registerVisibilityHandlers(socket);

  socket.connect();
  return socket;
}

/**
 * Disconnect and destroy the socket.
 * Call on logout.
 */
export function destroySocket() {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get the current socket without creating one.
 * Returns null if not connected.
 */
export function getExistingSocket(): TypedSocket | null {
  return socket?.connected ? socket : null;
}

// ---- Visibility-based pause/resume ----

function registerVisibilityHandlers(sock: TypedSocket) {
  // Remove previous handler if any
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }

  visibilityHandler = () => {
    if (document.visibilityState === 'hidden') {
      // Tab hidden — pause to save battery
      sock.emit('subscribe:pause');
    } else {
      // Tab visible again — resume with full snapshot
      sock.emit('subscribe:resume');
    }
  };

  document.addEventListener('visibilitychange', visibilityHandler);
}
