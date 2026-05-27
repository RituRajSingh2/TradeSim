'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@tradesim/shared';
import type { WsPortfolioUpdatePayload } from '@tradesim/shared';
import { clsx } from 'clsx';

interface PortfolioOverviewProps {
  portfolio: WsPortfolioUpdatePayload;
  getEffectiveBuyingPower: () => number;
}

export function PortfolioOverview({ portfolio, getEffectiveBuyingPower }: PortfolioOverviewProps) {
  const totalValue = portfolio.balance + portfolio.currentValue;
  const cashBalance = getEffectiveBuyingPower();

  return (
    <Card variant="elevated" padding="lg" className="bg-bg-card border-border-subtle shadow-sm flex flex-col gap-4">
      {/* Primary Metric: Total Value */}
      <div>
        <div className="mb-1 text-xs text-text-secondary font-medium uppercase tracking-wider">
          Total Portfolio Value
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight text-text-primary tabular-nums">
            {formatCurrency(totalValue)}
          </span>
          <Badge variant={portfolio.dayPnl >= 0 ? 'positive' : 'negative'} size="sm" className="tabular-nums transition-colors duration-150">
            {portfolio.dayPnl >= 0 ? '+' : ''}{portfolio.dayPnlPercent.toFixed(2)}%
          </Badge>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border-subtle">
        {/* Today's P&L */}
        <div className="flex flex-col">
          <span className="text-[10px] text-text-tertiary uppercase font-medium">Today's P&L</span>
          <span className={clsx(
            "text-sm font-semibold tabular-nums tracking-tight transition-colors duration-150 mt-1",
            portfolio.dayPnl >= 0 ? "text-positive" : "text-negative"
          )}>
            {portfolio.dayPnl >= 0 ? '+' : ''}{formatCurrency(portfolio.dayPnl)}
          </span>
        </div>

        {/* Total P&L */}
        <div className="flex flex-col">
          <span className="text-[10px] text-text-tertiary uppercase font-medium">Total P&L</span>
          <span className={clsx(
            "text-sm font-semibold tabular-nums tracking-tight transition-colors duration-150 mt-1",
            portfolio.totalPnl >= 0 ? "text-positive" : "text-negative"
          )}>
            {portfolio.totalPnl >= 0 ? '+' : ''}{formatCurrency(portfolio.totalPnl)}
          </span>
        </div>

        {/* Cash Balance */}
        <div className="flex flex-col">
          <span className="text-[10px] text-text-tertiary uppercase font-medium">Cash Balance</span>
          <span className="text-sm font-semibold text-text-primary tabular-nums tracking-tight mt-1 transition-colors duration-150">
            {formatCurrency(cashBalance)}
          </span>
        </div>
      </div>
    </Card>
  );
}
