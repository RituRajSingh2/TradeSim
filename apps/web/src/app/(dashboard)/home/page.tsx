import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@tradesim/shared';
import { SymbolSearch } from '@/components/watchlist/SymbolSearch';
import { Watchlist } from '@/components/watchlist/Watchlist';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function HomePage() {
  // Placeholder data — will be replaced with real data in Phase 6+
  const portfolioValue = 0;
  const dayPnl = 0;
  const dayPnlPercent = 0;

  return (
    <div className="flex flex-col w-full min-h-full">
      {/* 1. Portfolio Summary Card */}
      <div className="px-4 pt-6 pb-4">
        <Card variant="elevated" padding="lg" className="bg-bg-card border-border-subtle shadow-sm">
          <div className="mb-1 text-sm text-text-secondary font-medium">Portfolio Value</div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold tracking-tight text-text-primary">
              {formatCurrency(portfolioValue)}
            </span>
            <Badge variant={dayPnl >= 0 ? 'positive' : 'negative'} size="sm">
              {dayPnl >= 0 ? '+' : ''}{dayPnlPercent.toFixed(2)}%
            </Badge>
          </div>
          <div className="mt-1 text-sm text-text-tertiary font-medium">
            Day P&L: {formatCurrency(dayPnl)}
          </div>
        </Card>
      </div>

      {/* 2. Search Bar */}
      <div className="px-4 pb-2 sticky top-0 z-40 bg-bg-primary/95 backdrop-blur-md pt-2">
        <SymbolSearch />
      </div>

      {/* 3. Watchlist */}
      <div className="flex-1 mt-2">
        <div className="px-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary tracking-tight">Your Watchlist</h2>
        </div>
        <Watchlist />
      </div>
    </div>
  );
}
