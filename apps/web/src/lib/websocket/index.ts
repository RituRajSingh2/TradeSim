/**
 * @tradesim/web — WebSocket library barrel export
 *
 * Public API for all real-time subscriptions.
 * Import from here, not from individual files.
 *
 * Usage:
 *   import { useStockPrice, useWatchlistPrices, WS_EVENTS } from '@/lib/websocket';
 */

// Core socket lifecycle
export { getSocket, destroySocket, getExistingSocket } from './socket';
export type { TypedSocket } from './socket';

// Hooks
export { useSocket } from './use-socket';
export type { UseSocketReturn, SocketStatus } from './use-socket';

export { useStockPrice } from './use-stock-price';
export type { UseStockPriceReturn } from './use-stock-price';

export { useWatchlistPrices } from './use-watchlist-prices';
export type { WatchlistPriceMap } from './use-watchlist-prices';

export { usePortfolioUpdates } from './use-portfolio-updates';
export type { UsePortfolioUpdatesReturn } from './use-portfolio-updates';

export { useNotifications } from './use-notifications';
export type { ActiveNotification, UseNotificationsReturn } from './use-notifications';
