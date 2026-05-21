import { Metadata } from 'next';
import { LeaderboardDashboard } from '@/components/leaderboard/LeaderboardDashboard';

export const metadata: Metadata = {
  title: 'Leaderboard | TradeSim',
  description: 'Compete with traders locally and globally.',
};

export default function LeaderboardPage() {
  return (
    <div className="p-[var(--spacing-page)] pb-24 h-full overflow-y-auto custom-scrollbar">
      <LeaderboardDashboard />
    </div>
  );
}
