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

import { useEffect, useSyncExternalStore, useCallback, useMemo } from 'react';
import type { WsWatchlistPriceItem } from '@tradesim/shared';
import { subscriptionManager } from './subscription-manager';
import { priceFeed } from './price-feed';

export type WatchlistPriceMap = Map<string, WsWatchlistPriceItem>;

export function useWatchlistPrices(symbols: string[]): WatchlistPriceMap {
  const upperSymbols = useMemo(
    () => symbols.map((s) => s.toUpperCase()),
    [symbols.join(',')]
  );

  // Subscribe to the global price feed for multiple symbols
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (upperSymbols.length === 0) return () => {};
      
      const unsubscribers = upperSymbols.map((symbol) =>
        priceFeed.subscribe(symbol, onStoreChange)
      );

      return () => {
        unsubscribers.forEach((unsub) => unsub());
      };
    },
    [upperSymbols]
  );

  // Get the current snapshot map
  const getSnapshot = useCallback((): WatchlistPriceMap => {
    const map = new Map<string, WsWatchlistPriceItem>();
    for (const symbol of upperSymbols) {
      const data = priceFeed.getPrice(symbol);
      if (data?.quote) {
        map.set(symbol, {
          symbol: data.quote.symbol,
          ltp: data.quote.ltp,
          change: data.quote.change,
          changePercent: data.quote.changePercent,
        });
      }
    }
    return map;
  }, [upperSymbols]);

  // To prevent constant re-renders when producing a new map object in getSnapshot,
  // useSyncExternalStore requires getSnapshot to return the SAME reference if the data hasn't changed.
  // We can hash the versions to create a stable reference.
  const getVersionHash = useCallback(() => {
    return upperSymbols
      .map((sym) => `${sym}:${priceFeed.getPrice(sym)?.version || 0}`)
      .join('|');
  }, [upperSymbols]);

  const versionHash = useSyncExternalStore(subscribe, getVersionHash, getVersionHash);

  // Create the map only when the version hash changes
  const pricesMap = useMemo(() => getSnapshot(), [versionHash, getSnapshot]);

  // Manage websocket lifecycle (ref counting)
  useEffect(() => {
    if (upperSymbols.length === 0) return;

    upperSymbols.forEach((symbol) => {
      subscriptionManager.subscribeWatchlistSymbol(symbol);
    });

    return () => {
      upperSymbols.forEach((symbol) => {
        subscriptionManager.unsubscribeWatchlistSymbol(symbol);
      });
    };
  }, [upperSymbols]);

  return pricesMap;
}
