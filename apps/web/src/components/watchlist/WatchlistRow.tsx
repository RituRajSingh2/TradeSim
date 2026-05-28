'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { useStockPrice } from '@/lib/websocket/use-stock-price';
import { useVisibilitySubscription } from '@/lib/websocket/use-visibility-subscription';
import { formatCurrency } from '@tradesim/shared';
import { cn, pnlColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { useWatchlistStore } from '@/stores/watchlist-store';
import { Sparkline } from './Sparkline';

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
      <Link href={`/trade/${symbol}`} className="flex-1 flex items-center justify-between outline-none overflow-hidden">
        
        {/* Symbol Info (Left) */}
        <div className="flex flex-col flex-1 min-w-0 pr-4">
          <span className="font-semibold text-text-primary tracking-tight text-[15px] truncate">
            {symbol}
          </span>
          <span className="text-[11px] font-medium text-text-tertiary mt-0.5">
            NSE
          </span>
        </div>

        {/* Sparkline (Center-Right) */}
        <div className="flex-shrink-0 mr-4 opacity-80">
          <Sparkline symbol={symbol} isPositive={isPositive} width={48} height={20} />
        </div>

        {/* Realtime Price & P&L (Right) */}
        <div className="flex flex-col items-end mr-2 w-[90px] shrink-0">
          <span className="font-financial font-medium text-text-primary text-[15px] tabular-nums tracking-tight">
            {ltp > 0 ? formatCurrency(ltp) : '--'}
          </span>
          <div className={cn("flex items-center justify-end gap-1 text-[11px] font-financial font-medium mt-0.5 tabular-nums", pnlColor(change))}>
            {isPositive ? (
              <TrendingUp className="h-3 w-3 shrink-0" />
            ) : (
              <TrendingDown className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">
              {change > 0 ? '+' : ''}{changePercent.toFixed(2)}%
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
