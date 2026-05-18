// ============================================================
// WebSocket Event Contracts — End-to-End Type-Safe Events
//
// This file is the SINGLE SOURCE OF TRUTH for all WebSocket
// communication between frontend, backend, and future mobile apps.
//
// Architecture:
//   - WS_EVENTS: string constants (no raw string duplication)
//   - Zod schemas: runtime validation on server side
//   - TypeScript types: compile-time safety on both sides
//   - ClientToServerEvents / ServerToClientEvents: typed Socket.IO maps
//   - WsEnvelope: standardized wrapper for all server emissions
// ============================================================

import { z } from 'zod/v4';
import { OrderSideSchema, OrderStatusSchema } from './trading';

// ============================================================
// EVENT NAME CONSTANTS
// ============================================================

export const WS_EVENTS = {
  // ---- Client → Server ----
  SUBSCRIBE_STOCK: 'subscribe:stock',
  UNSUBSCRIBE_STOCK: 'unsubscribe:stock',
  SUBSCRIBE_WATCHLIST: 'subscribe:watchlist',
  UNSUBSCRIBE_WATCHLIST: 'unsubscribe:watchlist',
  SUBSCRIBE_PORTFOLIO: 'subscribe:portfolio',
  UNSUBSCRIBE_PORTFOLIO: 'unsubscribe:portfolio',
  SUBSCRIBE_PAUSE: 'subscribe:pause',
  SUBSCRIBE_RESUME: 'subscribe:resume',

  // ---- Server → Client ----
  STOCK_PRICE: 'stock:price',
  WATCHLIST_PRICES: 'watchlist:prices',
  PORTFOLIO_UPDATE: 'portfolio:update',
  CHART_CANDLE: 'chart:candle',
  ORDER_EXECUTED: 'order:executed',
  NOTIFICATION: 'notification',

  // ---- Connection ----
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  RECONNECT: 'reconnect',
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// ============================================================
// SHARED SYMBOL VALIDATION
// ============================================================

/** Reusable symbol validator: alphanumeric + space/&, 1-20 chars */
const WsSymbolSchema = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9 &]+$/);

// ============================================================
// CLIENT → SERVER PAYLOADS (with Zod validation)
// ============================================================

// ---- Subscribe to a single stock ----
export const WsSubscribeStockSchema = z.object({
  symbol: WsSymbolSchema,
});
export type WsSubscribeStock = z.infer<typeof WsSubscribeStockSchema>;

// ---- Unsubscribe from a single stock ----
export const WsUnsubscribeStockSchema = z.object({
  symbol: WsSymbolSchema,
});
export type WsUnsubscribeStock = z.infer<typeof WsUnsubscribeStockSchema>;

// ---- Subscribe to watchlist (batch) ----
export const WsSubscribeWatchlistSchema = z.object({
  symbols: z.array(WsSymbolSchema).min(1).max(30),
});
export type WsSubscribeWatchlist = z.infer<typeof WsSubscribeWatchlistSchema>;

// ---- Ack response (server responds to subscribe/unsubscribe) ----
export const WsAckSchema = z.object({
  event: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type WsAck = z.infer<typeof WsAckSchema>;

// ============================================================
// SERVER → CLIENT PAYLOADS
// ============================================================

// ---- Stock Price Tick (Tier 1: 1s) ----
export const WsStockPricePayloadSchema = z.object({
  symbol: z.string(),
  ltp: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  change: z.number(),
  changePercent: z.number(),
  timestamp: z.number(),
});
export type WsStockPricePayload = z.infer<typeof WsStockPricePayloadSchema>;

// ---- Watchlist Prices (Tier 2: 2s, delta-aware) ----
export const WsWatchlistPriceItemSchema = z.object({
  symbol: z.string(),
  ltp: z.number(),
  change: z.number(),
  changePercent: z.number(),
});
export type WsWatchlistPriceItem = z.infer<typeof WsWatchlistPriceItemSchema>;

export const WsWatchlistPricesPayloadSchema = z.object({
  type: z.enum(['snapshot', 'delta']),
  prices: z.array(WsWatchlistPriceItemSchema),
});
export type WsWatchlistPricesPayload = z.infer<typeof WsWatchlistPricesPayloadSchema>;

// ---- Portfolio Update (Tier 3: 5s) ----
export const WsPortfolioHoldingSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
  quantity: z.number().int(),
  avgBuyPrice: z.number(),
  currentPrice: z.number(),
  pnl: z.number(),
  pnlPercent: z.number(),
  dayChange: z.number(),
  dayChangePercent: z.number(),
});
export type WsPortfolioHolding = z.infer<typeof WsPortfolioHoldingSchema>;

export const WsPortfolioUpdatePayloadSchema = z.object({
  balance: z.number(),
  investedValue: z.number(),
  currentValue: z.number(),
  totalPnl: z.number(),
  totalPnlPercent: z.number(),
  dayPnl: z.number(),
  dayPnlPercent: z.number(),
  holdings: z.array(WsPortfolioHoldingSchema),
});
export type WsPortfolioUpdatePayload = z.infer<typeof WsPortfolioUpdatePayloadSchema>;

// ---- Chart Candle Update (Tier 4: 10s) ----
export const WsChartCandlePayloadSchema = z.object({
  symbol: z.string(),
  timeframe: z.string(),
  bar: z.object({
    time: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
  }),
  /** true if this updates the last bar, false if it's a new bar */
  isUpdate: z.boolean(),
});
export type WsChartCandlePayload = z.infer<typeof WsChartCandlePayloadSchema>;

// ---- Order Executed (push notification) ----
export const WsOrderExecutedPayloadSchema = z.object({
  orderId: z.string(),
  symbol: z.string(),
  companyName: z.string(),
  side: OrderSideSchema,
  quantity: z.number().int(),
  price: z.number(),
  totalValue: z.number(),
  status: OrderStatusSchema,
  executedAt: z.string(),
});
export type WsOrderExecutedPayload = z.infer<typeof WsOrderExecutedPayloadSchema>;

// ---- Notification (generic) ----
export const WsNotificationPayloadSchema = z.object({
  id: z.string(),
  type: z.enum(['success', 'error', 'info', 'warning']),
  title: z.string(),
  message: z.string(),
  /** Optional action URL (e.g., "View Order") */
  actionUrl: z.string().optional(),
  /** Auto-dismiss after ms (0 = sticky) */
  dismissAfterMs: z.number().int().optional(),
});
export type WsNotificationPayload = z.infer<typeof WsNotificationPayloadSchema>;

// ============================================================
// EVENT ENVELOPE — Standardized wrapper for all server emissions
// ============================================================

/**
 * Every server→client emission is wrapped in this envelope.
 * Provides consistent structure for:
 * - Frontend event handlers
 * - Logging and debugging
 * - Future versioning
 */
export interface WsEnvelope<T = unknown> {
  /** Event name (matches WS_EVENTS constant) */
  event: string;
  /** Typed payload */
  data: T;
  /** Server timestamp (ms since epoch) */
  ts: number;
  /** Optional sequence number for ordering */
  seq?: number;
}

/** Helper to create a typed envelope */
export function createWsEnvelope<T>(
  event: string,
  data: T,
  seq?: number,
): WsEnvelope<T> {
  return { event, data, ts: Date.now(), seq };
}

// ============================================================
// TYPED SOCKET.IO EVENT MAPS
// ============================================================

/**
 * Client → Server events.
 * Used by Socket.IO generic: `Socket<ServerToClientEvents, ClientToServerEvents>`
 *
 * Each key is the event name, each value is the handler signature.
 * The callback parameter receives the server's acknowledgement.
 */
export interface ClientToServerEvents {
  [WS_EVENTS.SUBSCRIBE_STOCK]: (
    data: WsSubscribeStock,
    callback?: (ack: WsAck) => void,
  ) => void;
  [WS_EVENTS.UNSUBSCRIBE_STOCK]: (
    data: WsUnsubscribeStock,
    callback?: (ack: WsAck) => void,
  ) => void;
  [WS_EVENTS.SUBSCRIBE_WATCHLIST]: (
    data: WsSubscribeWatchlist,
    callback?: (ack: WsAck) => void,
  ) => void;
  [WS_EVENTS.UNSUBSCRIBE_WATCHLIST]: (
    callback?: (ack: WsAck) => void,
  ) => void;
  [WS_EVENTS.SUBSCRIBE_PAUSE]: (
    callback?: (ack: WsAck) => void,
  ) => void;
  [WS_EVENTS.SUBSCRIBE_RESUME]: (
    callback?: (ack: WsAck) => void,
  ) => void;
}

/**
 * Server → Client events.
 * Used by Socket.IO generic: `Socket<ServerToClientEvents, ClientToServerEvents>`
 */
export interface ServerToClientEvents {
  [WS_EVENTS.STOCK_PRICE]: (data: WsStockPricePayload) => void;
  [WS_EVENTS.WATCHLIST_PRICES]: (data: WsWatchlistPricesPayload) => void;
  [WS_EVENTS.PORTFOLIO_UPDATE]: (data: WsPortfolioUpdatePayload) => void;
  [WS_EVENTS.CHART_CANDLE]: (data: WsChartCandlePayload) => void;
  [WS_EVENTS.ORDER_EXECUTED]: (data: WsOrderExecutedPayload) => void;
  [WS_EVENTS.NOTIFICATION]: (data: WsNotificationPayload) => void;
  [WS_EVENTS.ERROR]: (data: { message: string }) => void;
}

/**
 * Inter-server events (for Socket.IO adapter scaling with Redis).
 * Currently unused — placeholder for multi-instance deployment.
 */
export interface InterServerEvents {
  ping: () => void;
}

/**
 * Socket data — attached to each socket instance.
 */
export interface SocketData {
  userId: string;
  connectedAt: number;
}
