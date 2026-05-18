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

import { useEffect, useRef, useState } from 'react';
import { WS_EVENTS, type WsStockPricePayload } from '@tradesim/shared';
import { getExistingSocket } from './socket';
import { useSocket } from './use-socket';

export interface UseStockPriceReturn {
  quote: WsStockPricePayload | null;
  /** True if the last update was > 10s ago (provider may be down) */
  isStale: boolean;
}

export function useStockPrice(symbol: string | null): UseStockPriceReturn {
  const { socket } = useSocket();
  const [quote, setQuote] = useState<WsStockPricePayload | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!socket || !symbol) return;

    const upperSymbol = symbol.toUpperCase();

    // Subscribe
    socket.emit(WS_EVENTS.SUBSCRIBE_STOCK, { symbol: upperSymbol });

    const handlePrice = (data: WsStockPricePayload) => {
      if (data.symbol !== upperSymbol) return;
      setQuote(data);
      lastUpdateRef.current = Date.now();
      setIsStale(false);
    };

    socket.on(WS_EVENTS.STOCK_PRICE, handlePrice);

    // Staleness detector — check every 5s
    const staleTimer = setInterval(() => {
      if (lastUpdateRef.current > 0 && Date.now() - lastUpdateRef.current > 10_000) {
        setIsStale(true);
      }
    }, 5_000);

    return () => {
      socket.off(WS_EVENTS.STOCK_PRICE, handlePrice);
      socket.emit(WS_EVENTS.UNSUBSCRIBE_STOCK, { symbol: upperSymbol });
      clearInterval(staleTimer);
    };
  }, [socket, symbol]);

  return { quote, isStale };
}
