// src/lib/socket-client.ts
import { io, Socket } from 'socket.io-client';
import type {
  WsStockPricePayload,
  WsPortfolioUpdatePayload,
  WsOrderExecutedPayload,
  WsNotificationPayload,
  WsWatchlistPricesPayload,
  WsChartCandlePayload
} from '@tradesim/shared';
import { WS_EVENTS, PlatformEvent } from '@tradesim/shared';
import { logger } from './logger';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

// ---- Socket Event Map (for type-safe listeners) ----

export interface ServerToClientEvents {
  [WS_EVENTS.STOCK_PRICE]: (data: WsStockPricePayload) => void;
  [WS_EVENTS.PORTFOLIO_UPDATE]: (data: WsPortfolioUpdatePayload) => void;
  [WS_EVENTS.ORDER_EXECUTED]: (data: WsOrderExecutedPayload) => void;
  [WS_EVENTS.NOTIFICATION]: (data: WsNotificationPayload) => void;
  [WS_EVENTS.WATCHLIST_PRICES]: (data: WsWatchlistPricesPayload) => void;
  [WS_EVENTS.CHART_CANDLE]: (data: WsChartCandlePayload) => void;
}

export interface ClientToServerEvents {
  [WS_EVENTS.SUBSCRIBE_STOCK]: (data: { symbol: string }) => void;
  [WS_EVENTS.UNSUBSCRIBE_STOCK]: (data: { symbol: string }) => void;
  [WS_EVENTS.SUBSCRIBE_PORTFOLIO]: () => void;
  [WS_EVENTS.UNSUBSCRIBE_PORTFOLIO]: () => void;
  [WS_EVENTS.SUBSCRIBE_WATCHLIST]: (data: { symbols: string[] }) => void;
  [WS_EVENTS.UNSUBSCRIBE_WATCHLIST]: () => void;
  [WS_EVENTS.SUBSCRIBE_PAUSE]: () => void;
  [WS_EVENTS.SUBSCRIBE_RESUME]: () => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ---- Singleton Socket Manager ----

class SocketManager {
  private socket: TypedSocket | null = null;
  private subscribedStocks = new Set<string>();

  connect(token?: string): TypedSocket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: token ? { token } : undefined,
    }) as TypedSocket;

    this.socket.on('connect', () => {
      logger.info({
        eventType: PlatformEvent.WS_CONNECT,
        message: 'Socket connected',
        metadata: { socketId: this.socket?.id }
      });
      // Re-subscribe to previously subscribed stocks on reconnect
      this.subscribedStocks.forEach((symbol) => {
        this.socket?.emit(WS_EVENTS.SUBSCRIBE_STOCK, { symbol });
      });
    });

    this.socket.on('disconnect', (reason) => {
      logger.info({
        eventType: PlatformEvent.WS_DISCONNECT,
        message: 'Socket disconnected',
        metadata: { reason }
      });
    });

    this.socket.on('connect_error', (error) => {
      logger.error({
        eventType: PlatformEvent.WS_DEGRADED,
        message: 'Socket connection error',
        error: error
      });
    });

    return this.socket;
  }

  disconnect(): void {
    this.subscribedStocks.clear();
    this.socket?.disconnect();
    this.socket = null;
  }

  getSocket(): TypedSocket | null {
    return this.socket;
  }

  subscribeStock(symbol: string): void {
    this.subscribedStocks.add(symbol);
    this.socket?.emit(WS_EVENTS.SUBSCRIBE_STOCK, { symbol });
  }

  unsubscribeStock(symbol: string): void {
    this.subscribedStocks.delete(symbol);
    this.socket?.emit(WS_EVENTS.UNSUBSCRIBE_STOCK, { symbol });
  }

  subscribePortfolio(): void {
    this.socket?.emit(WS_EVENTS.SUBSCRIBE_PORTFOLIO);
  }

  unsubscribePortfolio(): void {
    this.socket?.emit(WS_EVENTS.UNSUBSCRIBE_PORTFOLIO);
  }

  onStockPrice(handler: ServerToClientEvents[typeof WS_EVENTS.STOCK_PRICE]): void {
    this.socket?.on(WS_EVENTS.STOCK_PRICE, handler);
  }

  offStockPrice(handler: ServerToClientEvents[typeof WS_EVENTS.STOCK_PRICE]): void {
    this.socket?.off(WS_EVENTS.STOCK_PRICE, handler);
  }

  onPortfolioUpdate(handler: ServerToClientEvents[typeof WS_EVENTS.PORTFOLIO_UPDATE]): void {
    this.socket?.on(WS_EVENTS.PORTFOLIO_UPDATE, handler);
  }

  onOrderExecuted(handler: ServerToClientEvents[typeof WS_EVENTS.ORDER_EXECUTED]): void {
    this.socket?.on(WS_EVENTS.ORDER_EXECUTED, handler);
  }

  onNotification(handler: ServerToClientEvents[typeof WS_EVENTS.NOTIFICATION]): void {
    this.socket?.on(WS_EVENTS.NOTIFICATION, handler);
  }

  onWatchlistPrices(handler: ServerToClientEvents[typeof WS_EVENTS.WATCHLIST_PRICES]): void {
    this.socket?.on(WS_EVENTS.WATCHLIST_PRICES, handler);
  }

  offWatchlistPrices(handler: ServerToClientEvents[typeof WS_EVENTS.WATCHLIST_PRICES]): void {
    this.socket?.off(WS_EVENTS.WATCHLIST_PRICES, handler);
  }

  onChartCandle(handler: ServerToClientEvents[typeof WS_EVENTS.CHART_CANDLE]): void {
    this.socket?.on(WS_EVENTS.CHART_CANDLE, handler);
  }

  offChartCandle(handler: ServerToClientEvents[typeof WS_EVENTS.CHART_CANDLE]): void {
    this.socket?.off(WS_EVENTS.CHART_CANDLE, handler);
  }
}

// Export singleton
export const socketManager = new SocketManager();
