'use client';

import React from 'react';
import { usePortfolioStore } from '@/stores/portfolio-store';
import { useStockPrice } from '@/lib/websocket/use-stock-price';
import { formatCurrency } from '@tradesim/shared';
import { cn, pnlColor } from '@/lib/utils';

export function TradeHoldings({ symbol }: { symbol: string }) {
  const { portfolio, getEffectiveHoldingQuantity } = usePortfolioStore();
  const { quote } = useStockPrice(symbol);
  
  const quantity = getEffectiveHoldingQuantity(symbol);
  
  if (quantity <= 0 || !portfolio) return null;

  const holding = portfolio.holdings.find(h => h.symbol === symbol);
  if (!holding) return null;

  const currentPrice = quote?.ltp ?? holding.currentPrice;
  // Calculate previous close from quote if available, otherwise fallback to holding data
  const previousClose = quote ? (quote.ltp - quote.change) : (holding.currentPrice - holding.dayChange);
  
  const avgBuyPrice = holding.avgBuyPrice;
  const currentValue = quantity * currentPrice;
  
  const totalPnl = currentValue - (quantity * avgBuyPrice);
  const totalPnlPercent = (totalPnl / (quantity * avgBuyPrice)) * 100;
  
  const todayPnl = currentValue - (quantity * previousClose);
  const todayPnlPercent = (todayPnl / (quantity * previousClose)) * 100;

  return (
    <div className="px-4 py-4 bg-bg-primary">
      <div className="bg-bg-secondary rounded-xl p-4 border border-border-subtle">
        <h3 className="text-xs font-semibold text-text-muted tracking-wider uppercase mb-3">
          Your Holdings
        </h3>
        
        <div className="grid grid-cols-2 gap-y-4 gap-x-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-text-tertiary">Quantity</span>
            <span className="text-sm font-semibold text-text-primary mt-0.5">{quantity}</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[10px] text-text-tertiary">Avg. Buy Price</span>
            <span className="text-sm font-semibold text-text-primary mt-0.5">{formatCurrency(avgBuyPrice)}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-text-tertiary">Total P&L</span>
            <span className={cn("text-sm font-semibold mt-0.5", pnlColor(totalPnl))}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
              <span className="text-[10px] ml-1">({totalPnlPercent.toFixed(2)}%)</span>
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[10px] text-text-tertiary">Today's P&L</span>
            <span className={cn("text-sm font-semibold mt-0.5", pnlColor(todayPnl))}>
              {todayPnl >= 0 ? '+' : ''}{formatCurrency(todayPnl)}
              <span className="text-[10px] ml-1">({todayPnlPercent.toFixed(2)}%)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
