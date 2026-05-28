import { Metadata } from 'next';
import { TradeAnalyticsDashboard } from '@/components/analytics/TradeAnalyticsDashboard';

export const metadata: Metadata = {
  title: 'Trade Review | TradeSim',
  description: 'Review your trading performance, closed trades, and portfolio analytics.',
};

export default function AnalyticsPage() {
  return (
    <div className="p-[var(--spacing-page)] pb-24 h-full overflow-y-auto custom-scrollbar">
      <TradeAnalyticsDashboard />
    </div>
  );
}
