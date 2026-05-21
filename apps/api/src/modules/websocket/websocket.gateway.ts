import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SubscriptionManager } from './subscription-manager';
import { PriceBroadcaster } from './price-broadcaster.service';
import {
  WS_EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type InterServerEvents,
  type SocketData,
  type WsSubscribeStock,
  type WsUnsubscribeStock,
  type WsSubscribeWatchlist,
  type WsOrderExecutedPayload,
  type WsNotificationPayload,
} from '@tradesim/shared';
import { PlatformLogger } from '../../common/logger/logger.service';

// ============================================================
// WebSocket Gateway — Socket.IO with JWT authentication
//
// Hardening:
//   1. Async JWT verification (non-blocking event loop)
//   2. Token expiry tracked per socket (socket.data.tokenExp)
//   3. Background expiry sweep every 60s — graceful disconnect
//   4. Per-IP reconnect rate limiting (max 15 in 60s window)
//   5. Graceful auth:expired event before forced disconnect
//
// Rooms:
//   stock:{symbol}     — live tick prices for a single stock
//   portfolio:{userId} — portfolio value updates
//   watchlist:{userId} — batched watchlist price deltas
// ============================================================

// Rate limiting config
const RECONNECT_LIMIT_MAX = 15;       // max reconnects per window
const RECONNECT_LIMIT_WINDOW_MS = 60_000; // 60-second rolling window
const SESSION_SWEEP_INTERVAL_MS = 60_000; // how often to sweep expired sessions
const AUTH_EXPIRE_GRACE_MS = 30_000;  // 30s grace period after JWT exp before disconnect

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/',
  transports: ['websocket', 'polling'],
})
export class TradingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly subscriptions: SubscriptionManager,
    private readonly broadcaster: PriceBroadcaster,
    private readonly logger: PlatformLogger,
  ) {
    this.logger.setContext(TradingGateway.name);
  }

  /** clientId → userId (for cleanup and room management) */
  private readonly clientUsers = new Map<string, string>();

  /** clientId → watchlist interval timer */
  private readonly watchlistTimers = new Map<string, NodeJS.Timeout>();

  /** clientId → current watchlist symbols (for cleanup on re-subscribe) */
  private readonly clientWatchlistSymbols = new Map<string, string[]>();

  /**
   * Per-IP reconnect rate limiting.
   * ip → { count, windowStart }
   */
  private readonly ipReconnectCounts = new Map<string, { count: number; windowStart: number }>();

  /** Background session sweep timer */
  private sessionSweepTimer?: NodeJS.Timeout;

  /** Validates a symbol string: alphanumeric + space, max 20 chars */
  private isValidSymbol(s: unknown): s is string {
    return typeof s === 'string' && s.length > 0 && s.length <= 20 && /^[A-Za-z0-9 &]+$/.test(s);
  }



  afterInit(server: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    this.broadcaster.setServer(server);
    this.logger.log('🔌 WebSocket gateway initialized');

    // Start background session expiry sweep
    this.sessionSweepTimer = setInterval(
      () => this.sweepExpiredSessions(),
      SESSION_SWEEP_INTERVAL_MS,
    );
  }

  // ============================================================
  // Connection Lifecycle
  // ============================================================

  async handleConnection(client: Socket) {
    try {
      const ip = this.getClientIp(client);

      // --- Rate Limiting ---
      if (this.isRateLimited(ip)) {
        this.logger.warn({
          message: `Rate limit hit for IP ${ip}. Rejecting socket ${client.id}.`,
          eventType: 'WS_RECONNECT_ABUSE',
          metadata: { ip, socketId: client.id }
        });
        client.emit('error', { message: 'Too many connections. Please wait before reconnecting.' });
        client.disconnect();
        return;
      }
      this.recordReconnectAttempt(ip);

      // --- Extract JWT ---
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn({
          message: `Client ${client.id} connected without token`,
          eventType: 'WS_AUTH_FAILED',
          metadata: { ip, socketId: client.id }
        });
        client.disconnect();
        return;
      }

      // --- Async JWT Verification (non-blocking) ---
      // verifyAsync() uses a Promise and does NOT block the event loop,
      // unlike the synchronous verify() which calls crypto.verify() inline.
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      const userId = payload.sub;
      if (!userId) {
        client.disconnect();
        return;
      }

      // --- Store expiry for background sweep ---
      // payload.exp is in seconds (Unix epoch); convert to ms
      const tokenExpMs = payload.exp ? payload.exp * 1000 : Date.now() + 3600_000;
      client.data.userId = userId;
      client.data.tokenExp = tokenExpMs;

      this.clientUsers.set(client.id, userId);
      this.subscriptions.registerClient(client.id);

      // Auto-join portfolio room
      client.join(`portfolio:${userId}`);

      this.logger.log({
        message: `Client ${client.id} connected. Total clients: ${this.subscriptions.getClientCount()}`,
        eventType: 'WS_CONNECT',
        metadata: { userId, socketId: client.id, exp: new Date(tokenExpMs).toISOString(), ip }
      });
    } catch (error) {
      this.logger.warn({
        message: `Auth failed for client ${client.id}: ${error}`,
        eventType: 'WS_AUTH_FAILED',
        metadata: { ip, socketId: client.id, error: String(error) }
      });
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.clientUsers.get(client.id);

    // Stop watchlist timer if any
    const wlTimer = this.watchlistTimers.get(client.id);
    if (wlTimer) {
      clearInterval(wlTimer);
      this.watchlistTimers.delete(client.id);
    }

    // Full subscription cleanup (decrements all ref counts)
    this.subscriptions.disconnectClient(client.id);

    // Clean up delta snapshot cache
    this.broadcaster.clearClientCache(client.id);

    // Clean up watchlist symbols map
    this.clientWatchlistSymbols.delete(client.id);

    this.clientUsers.delete(client.id);

    this.logger.log({
      message: `Client ${client.id} disconnected. Total clients: ${this.subscriptions.getClientCount()}`,
      eventType: 'WS_DISCONNECT',
      metadata: { userId: userId || 'unknown', socketId: client.id }
    });
  }

  // ============================================================
  // Background Session Expiry Enforcement
  // ============================================================

  /**
   * Runs every 60s. Iterates all connected sockets, compares current time
   * against stored tokenExp. If expired (+ grace window), emits auth:expired
   * then disconnects the socket. Batches checks to avoid event-loop spikes.
   */
  private async sweepExpiredSessions(): Promise<void> {
    if (!this.server) return;

    const now = Date.now();
    const sockets = await this.server.fetchSockets();

    if (sockets.length === 0) return;

    let expiredCount = 0;

    for (const socket of sockets) {
      const tokenExp: number | undefined = (socket.data as any)?.tokenExp;

      if (!tokenExp) continue;

      if (now > tokenExp + AUTH_EXPIRE_GRACE_MS) {
        expiredCount++;
        const userId = (socket.data as any)?.userId || 'unknown';

        this.logger.log({
          message: `Session expired: socket=${socket.id} user=${userId}. Disconnecting.`,
          eventType: 'WS_SESSION_EXPIRED',
          metadata: { userId, socketId: socket.id }
        });

        // Notify the client it is being disconnected due to session expiry
        // so it can attempt a token refresh or redirect to login
        socket.emit('auth:expired' as any, {
          reason: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please sign in again.',
        });

        // Small delay to let the emit flush before cutting the connection
        setTimeout(() => socket.disconnect(true), 200);
      }
    }

    if (expiredCount > 0) {
      this.logger.log(`🔒 Session sweep complete: ${expiredCount} expired socket(s) disconnected.`);
    }

    // Periodically clean up stale IP rate-limit entries
    this.cleanupIpRateLimits(now);
  }

  // ============================================================
  // Rate Limiting Helpers
  // ============================================================

  private getClientIp(client: Socket): string {
    return (
      (client.handshake.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      client.handshake.address ||
      'unknown'
    );
  }

  private isRateLimited(ip: string): boolean {
    const entry = this.ipReconnectCounts.get(ip);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.windowStart > RECONNECT_LIMIT_WINDOW_MS) {
      // Window has expired — reset
      this.ipReconnectCounts.delete(ip);
      return false;
    }

    return entry.count >= RECONNECT_LIMIT_MAX;
  }

  private recordReconnectAttempt(ip: string): void {
    const now = Date.now();
    const entry = this.ipReconnectCounts.get(ip);

    if (!entry || now - entry.windowStart > RECONNECT_LIMIT_WINDOW_MS) {
      this.ipReconnectCounts.set(ip, { count: 1, windowStart: now });
    } else {
      entry.count++;
    }
  }

  private cleanupIpRateLimits(now: number): void {
    for (const [ip, entry] of this.ipReconnectCounts.entries()) {
      if (now - entry.windowStart > RECONNECT_LIMIT_WINDOW_MS) {
        this.ipReconnectCounts.delete(ip);
      }
    }
  }

  // ============================================================
  // Stock Subscriptions
  // ============================================================

  @SubscribeMessage(WS_EVENTS.SUBSCRIBE_STOCK)
  handleSubscribeStock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WsSubscribeStock,
  ) {
    if (!data?.symbol || !this.isValidSymbol(data.symbol)) return;

    const symbol = data.symbol.toUpperCase();

    // Add to subscription manager (handles ref counting)
    this.subscriptions.subscribe(client.id, symbol);

    // Join the stock room for broadcasts
    client.join(`stock:${symbol}`);

    this.logger.debug(
      `Client ${client.id} subscribed to ${symbol} ` +
        `(refs: ${this.subscriptions.getRefCount(symbol)})`,
    );

    return { event: 'subscribed', data: { symbol } };
  }

  @SubscribeMessage(WS_EVENTS.UNSUBSCRIBE_STOCK)
  handleUnsubscribeStock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WsUnsubscribeStock,
  ) {
    if (!data?.symbol) return;

    const symbol = data.symbol.toUpperCase();

    this.subscriptions.unsubscribe(client.id, symbol);
    client.leave(`stock:${symbol}`);

    this.logger.debug(
      `Client ${client.id} unsubscribed from ${symbol} ` +
        `(refs: ${this.subscriptions.getRefCount(symbol)})`,
    );

    return { event: 'unsubscribed', data: { symbol } };
  }

  // ============================================================
  // Watchlist Subscriptions
  // ============================================================

  @SubscribeMessage(WS_EVENTS.SUBSCRIBE_WATCHLIST)
  handleSubscribeWatchlist(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WsSubscribeWatchlist,
  ) {
    if (!data?.symbols?.length || !Array.isArray(data.symbols)) return;

    // Validate and cap at 30 symbols
    const symbols = data.symbols
      .filter((s) => this.isValidSymbol(s))
      .map((s) => s.toUpperCase())
      .slice(0, 30);

    if (symbols.length === 0) return;

    // Clean up old watchlist subscriptions before adding new ones
    const oldSymbols = this.clientWatchlistSymbols.get(client.id);
    if (oldSymbols) {
      for (const oldSymbol of oldSymbols) {
        if (!symbols.includes(oldSymbol)) {
          this.subscriptions.unsubscribe(client.id, oldSymbol);
        }
      }
    }
    this.clientWatchlistSymbols.set(client.id, symbols);

    // Subscribe to each symbol
    for (const symbol of symbols) {
      this.subscriptions.subscribe(client.id, symbol);
    }

    // Start watchlist batch timer (Tier 2: every 2s)
    // Clear any existing timer first
    const existingTimer = this.watchlistTimers.get(client.id);
    if (existingTimer) clearInterval(existingTimer);

    const timer = setInterval(() => {
      const delta = this.broadcaster.computeWatchlistDelta(client.id, symbols);

      // Skip empty deltas
      if (delta.type === 'delta' && delta.prices.length === 0) return;

      client.emit('watchlist:prices', delta);
    }, 2000);

    this.watchlistTimers.set(client.id, timer);

    // Send initial snapshot immediately
    const snapshot = this.broadcaster.computeWatchlistDelta(client.id, symbols);
    client.emit('watchlist:prices', snapshot);

    return { event: 'subscribed', data: { symbols } };
  }

  @SubscribeMessage(WS_EVENTS.UNSUBSCRIBE_WATCHLIST)
  handleUnsubscribeWatchlist(@ConnectedSocket() client: Socket) {
    const timer = this.watchlistTimers.get(client.id);
    if (timer) {
      clearInterval(timer);
      this.watchlistTimers.delete(client.id);
    }

    return { event: 'unsubscribed', data: { channel: 'watchlist' } };
  }

  // ============================================================
  // Pause/Resume (battery optimization)
  // ============================================================

  @SubscribeMessage(WS_EVENTS.SUBSCRIBE_PAUSE)
  handlePause(@ConnectedSocket() client: Socket) {
    // Stop watchlist timer
    const timer = this.watchlistTimers.get(client.id);
    if (timer) {
      clearInterval(timer);
      this.watchlistTimers.delete(client.id);
    }

    // Leave stock rooms (but keep subscriptions — resume will rejoin)
    const symbols = this.subscriptions.getClientSymbols(client.id);
    for (const symbol of symbols) {
      client.leave(`stock:${symbol}`);
    }

    this.logger.debug(`Client ${client.id} paused subscriptions`);
    return { event: 'paused' };
  }

  @SubscribeMessage(WS_EVENTS.SUBSCRIBE_RESUME)
  handleResume(@ConnectedSocket() client: Socket) {
    // Rejoin stock rooms
    const symbols = this.subscriptions.getClientSymbols(client.id);
    for (const symbol of symbols) {
      client.join(`stock:${symbol}`);
    }

    // Clear delta cache to force full snapshot on next emit
    this.broadcaster.clearClientCache(client.id);

    this.logger.debug(`Client ${client.id} resumed subscriptions`);
    return { event: 'resumed' };
  }

  // ============================================================
  // Typed Emit Helpers
  // ============================================================

  /**
   * Emit an order-executed event to the user's portfolio room.
   * Typed: payload is validated against WsOrderExecutedPayload.
   */
  emitOrderExecuted(userId: string, payload: WsOrderExecutedPayload) {
    this.server
      ?.to(`portfolio:${userId}`)
      .emit(WS_EVENTS.ORDER_EXECUTED, payload);
  }

  /**
   * Emit a notification to the user's portfolio room.
   * Typed: payload is validated against WsNotificationPayload.
   */
  emitNotification(userId: string, payload: WsNotificationPayload) {
    this.server
      ?.to(`portfolio:${userId}`)
      .emit(WS_EVENTS.NOTIFICATION, payload);
  }

  /**
   * Generic typed emit to a user's portfolio room.
   * Use emitOrderExecuted / emitNotification for specific events.
   * @deprecated Prefer the specific typed helpers above.
   */
  emitToUser<E extends keyof ServerToClientEvents>(
    userId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.server?.to(`portfolio:${userId}`) as any).emit(event, ...args);
  }
}
