import { io, Socket } from 'socket.io-client';
import type {
  WsStockPricePayload,
  WsPortfolioUpdatePayload,
  WsOrderExecutedPayload,
  WsNotificationPayload,
} from '@tradesim/shared';
import { WsEvent } from '@tradesim/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

// ---- Socket Event Map (for type-safe listeners) ----

export interface ServerToClientEvents {
  [WsEvent.STOCK_PRICE]: (data: WsStockPricePayload) => void;
  [WsEvent.PORTFOLIO_UPDATE]: (data: WsPortfolioUpdatePayload) => void;
  [WsEvent.ORDER_EXECUTED]: (data: WsOrderExecutedPayload) => void;
  [WsEvent.NOTIFICATION]: (data: WsNotificationPayload) => void;
}

export interface ClientToServerEvents {
  [WsEvent.SUBSCRIBE_STOCK]: (data: { symbol: string }) => void;
  [WsEvent.UNSUBSCRIBE_STOCK]: (data: { symbol: string }) => void;
  [WsEvent.SUBSCRIBE_PORTFOLIO]: () => void;
  [WsEvent.UNSUBSCRIBE_PORTFOLIO]: () => void;
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
      console.log('[WS] Connected:', this.socket?.id);
      // Re-subscribe to previously subscribed stocks on reconnect
      this.subscribedStocks.forEach((symbol) => {
        this.socket?.emit(WsEvent.SUBSCRIBE_STOCK, { symbol });
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error.message);
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
    this.socket?.emit(WsEvent.SUBSCRIBE_STOCK, { symbol });
  }

  unsubscribeStock(symbol: string): void {
    this.subscribedStocks.delete(symbol);
    this.socket?.emit(WsEvent.UNSUBSCRIBE_STOCK, { symbol });
  }

  subscribePortfolio(): void {
    this.socket?.emit(WsEvent.SUBSCRIBE_PORTFOLIO);
  }

  unsubscribePortfolio(): void {
    this.socket?.emit(WsEvent.UNSUBSCRIBE_PORTFOLIO);
  }

  onStockPrice(handler: ServerToClientEvents[typeof WsEvent.STOCK_PRICE]): void {
    this.socket?.on(WsEvent.STOCK_PRICE, handler);
  }

  offStockPrice(handler: ServerToClientEvents[typeof WsEvent.STOCK_PRICE]): void {
    this.socket?.off(WsEvent.STOCK_PRICE, handler);
  }

  onPortfolioUpdate(handler: ServerToClientEvents[typeof WsEvent.PORTFOLIO_UPDATE]): void {
    this.socket?.on(WsEvent.PORTFOLIO_UPDATE, handler);
  }

  onOrderExecuted(handler: ServerToClientEvents[typeof WsEvent.ORDER_EXECUTED]): void {
    this.socket?.on(WsEvent.ORDER_EXECUTED, handler);
  }

  onNotification(handler: ServerToClientEvents[typeof WsEvent.NOTIFICATION]): void {
    this.socket?.on(WsEvent.NOTIFICATION, handler);
  }
}

// Export singleton
export const socketManager = new SocketManager();
