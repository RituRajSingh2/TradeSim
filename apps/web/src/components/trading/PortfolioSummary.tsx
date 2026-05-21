'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { usePortfolioStore } from '@/stores/portfolio-store';
import { formatCurrency } from '@tradesim/shared';

export function PortfolioSummary() {
  const { portfolio, getEffectiveBuyingPower } = usePortfolioStore();

  const effectiveBp = getEffectiveBuyingPower();
  const invested = portfolio?.investedValue || 0;
  const current = portfolio?.currentValue || 0;
  const totalPnl = portfolio?.totalPnl || 0;
  const totalPnlPercent = portfolio?.totalPnlPercent || 0;

  return (
    <div className="flex flex-col h-full space-y-4">
      <h3 className="font-semibold text-lg text-text-primary">Portfolio</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">Buying Power</span>
          <span className="font-financial font-bold text-text-primary text-lg tracking-tight">
            {formatCurrency(effectiveBp)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">Invested Value</span>
          <span className="font-financial text-text-primary">
            {formatCurrency(invested)}
          </span>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-border-subtle">
          <span className="text-sm text-text-secondary">Current Value</span>
          <span className="font-financial text-text-primary">
            {formatCurrency(current)}
          </span>
        </div>

        <div className="flex justify-between items-center bg-bg-primary rounded p-2 border border-border-subtle">
          <span className="text-sm text-text-secondary">Total P&L</span>
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-financial font-bold",
              totalPnl > 0 ? "text-positive" : totalPnl < 0 ? "text-negative" : "text-text-primary"
            )}>
              {totalPnl > 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </span>
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              totalPnlPercent > 0 ? "bg-positive/20 text-positive" : 
              totalPnlPercent < 0 ? "bg-negative/20 text-negative" : "bg-bg-tertiary text-text-secondary"
            )}>
              {totalPnlPercent > 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
