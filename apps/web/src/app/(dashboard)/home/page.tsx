import type { Metadata } from 'next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@tradesim/shared';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function HomePage() {
  // Placeholder data — will be replaced with real data in Phase 6+
  const portfolioValue = 10_000;
  const dayPnl = 0;
  const dayPnlPercent = 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Portfolio Summary */}
      <Card variant="elevated" padding="lg">
        <div className="mb-1 text-sm text-text-secondary">Portfolio Value</div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight">
            {formatCurrency(portfolioValue)}
          </span>
          <Badge variant={dayPnl >= 0 ? 'positive' : 'negative'} size="sm">
            {dayPnl >= 0 ? '+' : ''}{dayPnlPercent.toFixed(2)}%
          </Badge>
        </div>
        <div className="mt-1 text-sm text-text-tertiary">
          Day P&L: {formatCurrency(dayPnl)}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card variant="interactive" padding="md">
          <CardContent>
            <div className="text-sm font-semibold text-text-primary">Markets</div>
            <div className="mt-1 text-xs text-text-tertiary">Browse NSE stocks</div>
          </CardContent>
        </Card>
        <Card variant="interactive" padding="md">
          <CardContent>
            <div className="text-sm font-semibold text-text-primary">Watchlist</div>
            <div className="mt-1 text-xs text-text-tertiary">Track your picks</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Placeholder */}
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 text-3xl">📊</div>
            <p className="text-sm text-text-secondary">
              No trades yet. Head to Markets to place your first order.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
