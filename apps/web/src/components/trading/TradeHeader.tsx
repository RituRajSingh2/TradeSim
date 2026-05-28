'use client';

import React from 'react';
import { useStockPrice } from '@/lib/websocket/use-stock-price';
import { formatCurrency } from '@tradesim/shared';
import { cn, pnlColor } from '@/lib/utils';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { MarketStatusIndicator } from './MarketStatusIndicator';

export function TradeHeader({ symbol }: { symbol: string }) {
  const { quote, isStale } = useStockPrice(symbol);
  
  const ltp = quote?.ltp ?? 0;
  const change = quote?.change ?? 0;
  const changePercent = quote?.changePercent ?? 0;
  const isPositive = change >= 0;

  return (
    <header className="sticky top-0 z-40 bg-bg-primary border-b border-border-subtle px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/home" className="p-1 -ml-1 text-text-secondary hover:text-text-primary active:scale-95 transition-all">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-text-primary text-base leading-none tracking-tight uppercase">
              {symbol}
            </h1>
            <span className="text-[10px] font-medium text-text-tertiary leading-none bg-bg-secondary px-1 rounded">
              NSE
            </span>
          </div>
          <MarketStatusIndicator />
        </div>
      </div>

      <div className={cn(
        "flex flex-col items-end transition-opacity duration-150",
        isStale && "opacity-50 grayscale"
      )}>
        <span className="font-financial font-bold text-text-primary text-base leading-tight">
          {ltp > 0 ? formatCurrency(ltp) : '--'}
        </span>
        <div className={cn("flex items-center gap-0.5 text-[11px] font-medium leading-none", pnlColor(change))}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{change > 0 ? '+' : ''}{changePercent.toFixed(2)}%</span>
        </div>
      </div>
    </header>
  );
}
