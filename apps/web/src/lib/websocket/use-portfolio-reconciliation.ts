'use client';

import { useEffect } from 'react';
import { WS_EVENTS, type WsPortfolioUpdatePayload, type WsOrderExecutedPayload } from '@tradesim/shared';
import { useSocket } from './use-socket';
import { usePortfolioStore } from '@/stores/portfolio-store';

/**
 * usePortfolioReconciliation
 * Mounts at the root of the trading dashboard.
 * Listens for Server-Authoritative WebSocket events and reconciles the optimistic store.
 */
export function usePortfolioReconciliation() {
  const { socket } = useSocket();
  const reconcilePortfolio = usePortfolioStore((state) => state.reconcilePortfolio);
  const clearPendingOrder = usePortfolioStore((state) => state.clearPendingOrder);

  useEffect(() => {
    if (!socket) return;

    const handlePortfolioUpdate = (data: WsPortfolioUpdatePayload) => {
      reconcilePortfolio(data);
    };

    const handleOrderExecuted = (data: WsOrderExecutedPayload) => {
      if (data.idempotencyKey) {
        // Drop the pending idempotency key, marking it resolved.
        // The subsequent PORTFOLIO_UPDATE will wipe the rest of the optimistic delta.
        clearPendingOrder(data.idempotencyKey);
      }
    };

    socket.on(WS_EVENTS.PORTFOLIO_UPDATE, handlePortfolioUpdate);
    socket.on(WS_EVENTS.ORDER_EXECUTED, handleOrderExecuted);

    return () => {
      socket.off(WS_EVENTS.PORTFOLIO_UPDATE, handlePortfolioUpdate);
      socket.off(WS_EVENTS.ORDER_EXECUTED, handleOrderExecuted);
    };
  }, [socket, reconcilePortfolio, clearPendingOrder]);
}
