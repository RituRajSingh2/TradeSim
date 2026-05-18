'use client';

/**
 * useWatchlistPrices — Subscribe to batched watchlist price updates.
 *
 * Update cadence: 2s (Tier 2 — delta-based batch)
 * Handles both 'snapshot' (first emit) and 'delta' (changed-only) payloads.
 * Merges deltas into a complete price map for stable rendering.
 *
 * Usage:
 *   const prices = useWatchlistPrices(['RELIANCE', 'TCS', 'INFY']);
 *   prices.get('RELIANCE') // → { ltp, change, changePercent }
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  WS_EVENTS,
  type WsWatchlistPricesPayload,
  type WsWatchlistPriceItem,
} from '@tradesim/shared';
import { useSocket } from './use-socket';

export type WatchlistPriceMap = Map<string, WsWatchlistPriceItem>;

export function useWatchlistPrices(symbols: string[]): WatchlistPriceMap {
  const { socket } = useSocket();
  // Stable Map reference — mutated in-place, spread copy triggers render
  const pricesRef = useRef<WatchlistPriceMap>(new Map());
  const [, forceUpdate] = useState(0);

  // Stable symbols key to avoid effect re-fires on array identity change
  const symbolsKey = symbols.map((s) => s.toUpperCase()).sort().join(',');

  useEffect(() => {
    if (!socket || symbols.length === 0) return;

    const upperSymbols = symbols.map((s) => s.toUpperCase());

    // Subscribe watchlist
    socket.emit(WS_EVENTS.SUBSCRIBE_WATCHLIST, { symbols: upperSymbols });

    const handlePrices = (payload: WsWatchlistPricesPayload) => {
      if (payload.type === 'snapshot') {
        // Full replacement
        pricesRef.current = new Map(
          payload.prices.map((p) => [p.symbol, p]),
        );
      } else {
        // Delta — merge changed entries only
        const next = new Map(pricesRef.current);
        for (const item of payload.prices) {
          next.set(item.symbol, item);
        }
        pricesRef.current = next;
      }
      // Trigger re-render
      forceUpdate((n) => n + 1);
    };

    socket.on(WS_EVENTS.WATCHLIST_PRICES, handlePrices);

    return () => {
      socket.off(WS_EVENTS.WATCHLIST_PRICES, handlePrices);
      socket.emit(WS_EVENTS.UNSUBSCRIBE_WATCHLIST);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, symbolsKey]);

  return pricesRef.current;
}
