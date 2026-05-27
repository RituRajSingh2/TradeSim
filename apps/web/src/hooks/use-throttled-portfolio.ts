import { useState, useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/stores/portfolio-store';
import type { WsPortfolioUpdatePayload } from '@tradesim/shared';

/**
 * Custom hook to throttle the portfolio state updates.
 * Prevents ultra-fast WebSocket bursts from causing rapid layout shifts and UI jitter.
 *
 * @param delayMs - The minimum time between state updates in milliseconds.
 */
export function useThrottledPortfolio(delayMs = 250) {
  const { portfolio, optimisticDelta, getEffectiveBuyingPower, getEffectiveHoldingQuantity } = usePortfolioStore();
  const [throttledPortfolio, setThrottledPortfolio] = useState<WsPortfolioUpdatePayload | null>(portfolio);
  
  const lastUpdateTime = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime.current;

    if (timeSinceLastUpdate >= delayMs) {
      // Update immediately if enough time has passed
      setThrottledPortfolio(portfolio);
      lastUpdateTime.current = now;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      // Otherwise, schedule an update
      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          setThrottledPortfolio(portfolio);
          lastUpdateTime.current = Date.now();
          timeoutRef.current = null;
        }, delayMs - timeSinceLastUpdate);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [portfolio, delayMs]);

  return {
    portfolio: throttledPortfolio,
    optimisticDelta,
    getEffectiveBuyingPower,
    getEffectiveHoldingQuantity,
  };
}
