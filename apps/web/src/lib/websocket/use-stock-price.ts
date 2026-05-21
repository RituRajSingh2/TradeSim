'use client';

/**
 * useStockPrice — Subscribe to live tick updates for a single symbol.
 *
 * Update cadence: 1s (Tier 1 — Broadcast loop)
 * Unsubscribes cleanly on unmount or symbol change.
 *
 * Usage:
 *   const { quote, isStale } = useStockPrice('RELIANCE');
 */

import { useEffect, useSyncExternalStore, useCallback } from 'react';
import type { WsStockPricePayload } from '@tradesim/shared';
import { subscriptionManager } from './subscription-manager';
import { priceFeed, PriceFeedData } from './price-feed';

export interface UseStockPriceReturn {
  quote: WsStockPricePayload | null;
  /** True if the last update was > 10s ago (provider may be down) */
  isStale: boolean;
}

export function useStockPrice(symbol: string | null): UseStockPriceReturn {
  // Subscribe to the global price feed
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!symbol) return () => {};
      const upperSymbol = symbol.toUpperCase();
      return priceFeed.subscribe(upperSymbol, onStoreChange);
    },
    [symbol]
  );

  // Get the current snapshot from the global price feed
  const getSnapshot = useCallback(
    (): PriceFeedData | undefined => {
      if (!symbol) return undefined;
      return priceFeed.getPrice(symbol.toUpperCase());
    },
    [symbol]
  );

  const priceData = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Manage websocket lifecycle (ref counting)
  useEffect(() => {
    if (!symbol) return;
    const upperSymbol = symbol.toUpperCase();
    
    subscriptionManager.subscribeStock(upperSymbol);
    return () => {
      subscriptionManager.unsubscribeStock(upperSymbol);
    };
  }, [symbol]);

  // Staleness detection is derived. We check if the snapshot timestamp is old.
  const isStale = priceData?.quote
    ? Date.now() - priceData.quote.timestamp > 10_000
    : false;

  return { 
    quote: priceData?.quote || null, 
    isStale 
  };
}
