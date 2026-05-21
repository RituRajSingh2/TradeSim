'use client';

import React, { memo } from 'react';
import { useStockPrice } from '@/lib/websocket/use-stock-price';
import { useVisibilitySubscription } from '@/lib/websocket/use-visibility-subscription';
import { formatCurrency } from '@tradesim/shared';
import { cn, pnlColor } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface WatchlistRowProps {
  symbol: string;
  index: number;
}

const WatchlistRowComponent = ({ symbol, index }: WatchlistRowProps) => {
  // 1. Detect if the row is actually near/in the viewport
  // rootMargin '200px' ensures we subscribe slightly before it comes into view
  const { containerRef, isVisible } = useVisibilitySubscription({
    rootMargin: '200px 0px',
    threshold: 0,
  });

  // 2. Only subscribe if visible (pass null to pause subscription)
  const { quote, isStale } = useStockPrice(isVisible ? symbol : null);

  // Fallbacks for initial render before websocket tick
  const ltp = quote?.ltp ?? 0;
  const change = quote?.change ?? 0;
  const changePercent = quote?.changePercent ?? 0;
  const isPositive = change >= 0;

  return (
    <div
      ref={containerRef as any}
      className={cn(
        "flex items-center justify-between p-4 border-b border-border-subtle bg-bg-card hover:bg-bg-card-hover transition-colors h-[73px] overflow-hidden",
        isStale && "opacity-50 grayscale transition-opacity"
      )}
    >
      {/* Symbol & Name info */}
      <div className="flex flex-col">
        <span className="font-semibold text-text-primary tracking-tight">
          {symbol}
        </span>
        <span className="text-xs text-text-tertiary">
          NSE
        </span>
      </div>

      {/* Realtime Price */}
      <div className="flex flex-col items-end">
        <span className="font-medium text-text-primary">
          {ltp > 0 ? formatCurrency(ltp) : '--'}
        </span>
        <div className={cn("flex items-center gap-1 text-xs", pnlColor(change))}>
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>
            {change > 0 ? '+' : ''}{formatCurrency(Math.abs(change))}
          </span>
          <span>
            ({change > 0 ? '+' : ''}{changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
};

// 3. React.memo prevents re-renders from parent container state changes.
// Since the only props are simple primitives (string, number), default shallow compare is perfect.
export const WatchlistRow = memo(WatchlistRowComponent);
