'use client';

import { formatCurrency } from '@tradesim/shared';
import type { WsPortfolioUpdatePayload } from '@tradesim/shared';
import { clsx } from 'clsx';
import { Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface HoldingsListProps {
  portfolio: WsPortfolioUpdatePayload;
  getEffectiveHoldingQuantity: (symbol: string) => number;
}

export function HoldingsList({ portfolio, getEffectiveHoldingQuantity }: HoldingsListProps) {
  const router = useRouter();
  
  if (portfolio.holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border-subtle bg-bg-card/50 mt-4">
        <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
          <Briefcase className="h-6 w-6 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">No Holdings Yet</h3>
        <p className="text-sm text-text-secondary mb-6 max-w-[250px]">
          Start building your portfolio. Practice trading risk-free with virtual money.
        </p>
        <Button 
          variant="primary" 
          onClick={() => router.push('/home')}
          className="w-full max-w-[200px]"
        >
          Start your first trade
        </Button>
      </div>
    );
  }

  const sortedHoldings = [...portfolio.holdings].sort((a, b) => {
    // 1. highest current value
    const aValue = a.quantity * a.currentPrice;
    const bValue = b.quantity * b.currentPrice;
    if (bValue !== aValue) {
      return bValue - aValue;
    }
    // 2. then highest unrealized P&L magnitude
    return Math.abs(b.pnl) - Math.abs(a.pnl);
  });

  return (
    <div className="flex flex-col gap-3 mt-4">
      <h2 className="text-sm font-semibold text-text-primary tracking-tight px-1">Current Holdings</h2>
      
      <div className="flex flex-col gap-2">
        {sortedHoldings.map((holding) => {
          const effectiveQty = getEffectiveHoldingQuantity(holding.symbol);
          
          // Don't show fully optimistic-closed positions until server syncs, 
          // or show them as 0 qty briefly (we choose not to render if qty <= 0)
          if (effectiveQty <= 0) return null;

          return (
            <div 
              key={holding.symbol}
              onClick={() => router.push(`/trade/${holding.symbol}`)}
              className="flex items-center justify-between p-3 rounded-lg bg-bg-card border border-border-subtle active:scale-[0.98] transition-transform duration-100 cursor-pointer"
            >
              {/* Left Column: Symbol, Qty, Avg Buy */}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-text-primary tracking-tight">{holding.symbol}</span>
                <span className="text-[11px] text-text-secondary font-medium">
                  <span className="tabular-nums">{effectiveQty}</span> Qty • Avg <span className="tabular-nums">{formatCurrency(holding.avgBuyPrice)}</span>
                </span>
              </div>

              {/* Right Column: Current Value, P&Ls */}
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="text-sm font-bold text-text-primary tabular-nums tracking-tight">
                  {formatCurrency(effectiveQty * holding.currentPrice)}
                </span>
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  {/* Today's P&L */}
                  <span className={clsx(
                    "tabular-nums transition-colors duration-150",
                    holding.dayChange >= 0 ? "text-positive" : "text-negative"
                  )}>
                    {holding.dayChange >= 0 ? '+' : ''}{formatCurrency(holding.dayChange)}
                  </span>
                  <span className="text-text-tertiary">|</span>
                  {/* Total P&L */}
                  <span className={clsx(
                    "tabular-nums transition-colors duration-150",
                    holding.pnl >= 0 ? "text-positive" : "text-negative"
                  )}>
                    {holding.pnl >= 0 ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
