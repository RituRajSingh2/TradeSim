'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { useStockPrice } from '@/lib/websocket/use-stock-price';
import { useVisibilitySubscription } from '@/lib/websocket/use-visibility-subscription';
import { formatCurrency } from '@tradesim/shared';
import { cn, pnlColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { useWatchlistStore } from '@/stores/watchlist-store';

export interface WatchlistRowProps {
  symbol: string;
  index: number;
}

const WatchlistRowComponent = ({ symbol, index }: WatchlistRowProps) => {
  const { containerRef, isVisible } = useVisibilitySubscription({
    rootMargin: '200px 0px',
    threshold: 0,
  });

  const { quote, isStale } = useStockPrice(isVisible ? symbol : null);
  const removeSymbol = useWatchlistStore((state) => state.removeSymbol);

  const ltp = quote?.ltp ?? 0;
  const change = quote?.change ?? 0;
  const changePercent = quote?.changePercent ?? 0;
  const isPositive = change >= 0;

  return (
    <div
      ref={containerRef as any}
      className={cn(
        "flex items-center justify-between pl-4 pr-2 py-3 border-b border-border-subtle bg-bg-primary hover:bg-bg-secondary active:bg-bg-card-hover transition-colors h-[76px] overflow-hidden group",
        isStale && "opacity-50 grayscale transition-opacity"
      )}
    >
      <Link href={`/trade/${symbol}`} className="flex-1 flex items-center justify-between outline-none">
        {/* Symbol & Name info */}
        <div className="flex flex-col">
          <span className="font-semibold text-text-primary tracking-tight text-base">
            {symbol}
          </span>
          <span className="text-xs text-text-tertiary mt-0.5">
            NSE
          </span>
        </div>

        {/* Realtime Price */}
        <div className="flex flex-col items-end mr-3">
          <span className="font-medium text-text-primary text-base">
            {ltp > 0 ? formatCurrency(ltp) : '--'}
          </span>
          <div className={cn("flex items-center gap-1 text-xs mt-0.5 font-medium", pnlColor(change))}>
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
      </Link>
      
      {/* Remove Action (Tap friendly) */}
      <button 
        onClick={() => removeSymbol(symbol)}
        className="p-2 ml-1 rounded-md text-text-muted hover:bg-bg-card hover:text-text-primary active:scale-95 transition-all flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
        aria-label={`Remove ${symbol}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export const WatchlistRow = memo(WatchlistRowComponent);
