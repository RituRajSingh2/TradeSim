import { Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export const metadata: Metadata = {
  title: 'Analytics | TradeSim',
  description: 'Track your trading performance and portfolio equity curve.',
};

export default function AnalyticsPage() {
  return (
    <div className="p-[var(--spacing-page)] pb-24 h-full overflow-y-auto custom-scrollbar">
      <AnalyticsDashboard />
    </div>
  );
}
