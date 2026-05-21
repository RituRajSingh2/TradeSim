'use client';

import { usePortfolioReconciliation } from '@/lib/websocket/use-portfolio-reconciliation';

export function TradingReconciliation() {
  usePortfolioReconciliation();
  return null;
}
