import { Logger } from '@nestjs/common';
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
  createWsEnvelope,
} from '@tradesim/shared';

// ============================================================
// WebSocket Gateway — Socket.IO with JWT authentication
//
// Rooms:
//   stock:{symbol}     — live tick prices for a single stock
//   portfolio:{userId} — portfolio value updates
//   watchlist:{userId} — batched watchlist price deltas
//
// Authentication:
//   Client sends JWT in handshake: { auth: { token: "..." } }
//   Gateway verifies token and attaches userId to socket.data
//
// Lifecycle:
//   connect  → verify JWT, register client, join portfolio room
//   subscribe:stock → join stock room, add to subscription manager
//   unsubscribe:stock → leave stock room, remove from subscription manager
//   disconnect → full cleanup via subscription manager
// ============================================================

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

  private readonly logger = new Logger(TradingGateway.name);

  /** clientId → userId (for cleanup and room management) */
  private readonly clientUsers = new Map<string, string>();

  /** clientId → watchlist interval timer */
  private readonly watchlistTimers = new Map<string, NodeJS.Timeout>();

  /** clientId → current watchlist symbols (for cleanup on re-subscribe) */
  private readonly clientWatchlistSymbols = new Map<string, string[]>();

  /** Validates a symbol string: alphanumeric + space, max 20 chars */
  private isValidSymbol(s: unknown): s is string {
    return typeof s === 'string' && s.length > 0 && s.length <= 20 && /^[A-Za-z0-9 &]+$/.test(s);
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly subscriptions: SubscriptionManager,
    private readonly broadcaster: PriceBroadcaster,
  ) {}

  afterInit(server: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    this.broadcaster.setServer(server);
    this.logger.log('🔌 WebSocket gateway initialized');
  }

  // ---- Connection Lifecycle ----

  async handleConnection(client: Socket) {
    try {
      // Extract JWT from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      const userId = payload.sub;
      if (!userId) {
        client.disconnect();
        return;
      }

      // Store userId and register client
      client.data.userId = userId;
      this.clientUsers.set(client.id, userId);
      this.subscriptions.registerClient(client.id);

      // Auto-join portfolio room
      client.join(`portfolio:${userId}`);

      this.logger.log(
        `Client ${client.id} connected (user: ${userId}). ` +
          `Total clients: ${this.subscriptions.getClientCount()}`,
      );
    } catch (error) {
      this.logger.warn(`Auth failed for client ${client.id}: ${error}`);
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

    this.logger.log(
      `Client ${client.id} disconnected (user: ${userId || 'unknown'}). ` +
        `Total clients: ${this.subscriptions.getClientCount()}`,
    );
  }

  // ---- Stock Subscriptions ----

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

  // ---- Watchlist Subscriptions ----

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
      const delta = this.broadcaster.computeWatchlistDelta(
        client.id,
        symbols,
      );

      // Skip empty deltas
      if (delta.type === 'delta' && delta.prices.length === 0) return;

      client.emit('watchlist:prices', delta);
    }, 2000);

    this.watchlistTimers.set(client.id, timer);

    // Send initial snapshot immediately
    const snapshot = this.broadcaster.computeWatchlistDelta(
      client.id,
      symbols,
    );
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

  // ---- Pause/Resume (battery optimization) ----

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

  // ---- Typed Emit Helpers ----

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
