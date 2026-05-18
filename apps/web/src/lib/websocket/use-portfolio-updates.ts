'use client';

/**
 * usePortfolioUpdates — Subscribe to live portfolio value push updates.
 *
 * Update cadence: pushed on order execution + 5s polling (Tier 3)
 * Used by the portfolio dashboard to reflect live P&L.
 *
 * Usage:
 *   const { portfolio } = usePortfolioUpdates();
 */

import { useEffect, useState } from 'react';
import { WS_EVENTS, type WsPortfolioUpdatePayload } from '@tradesim/shared';
import { useSocket } from './use-socket';

export interface UsePortfolioUpdatesReturn {
  portfolio: WsPortfolioUpdatePayload | null;
}

export function usePortfolioUpdates(): UsePortfolioUpdatesReturn {
  const { socket } = useSocket();
  const [portfolio, setPortfolio] = useState<WsPortfolioUpdatePayload | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Portfolio room is auto-joined on connect — no explicit subscribe needed
    const handleUpdate = (data: WsPortfolioUpdatePayload) => {
      setPortfolio(data);
    };

    socket.on(WS_EVENTS.PORTFOLIO_UPDATE, handleUpdate);

    return () => {
      socket.off(WS_EVENTS.PORTFOLIO_UPDATE, handleUpdate);
    };
  }, [socket]);

  return { portfolio };
}
