'use client';

import { useMemo } from 'react';
import { AnalyticsSummary } from '@/lib/hooks/use-analytics';
import { BookOpen } from 'lucide-react';

interface Props {
  summary: AnalyticsSummary;
}

interface Insight {
  text: string;
  confidence: 'high';
}

/**
 * Derives at most ONE high-confidence behavioral insight from the analytics summary.
 * Rules:
 * - Minimum 5 trades for any insight to show.
 * - Strictly neutral/supportive tone.
 * - No guru language, no emotional judgment, no streak mechanics.
 */
function deriveInsight(summary: AnalyticsSummary): Insight | null {
  const { totalTrades, winRate, averageHoldingDuration, bestTradePnl, worstTradePnl } = summary;

  // Require minimum sample size for all insights
  if (totalTrades < 5) return null;

  // Insight 1: Long-hold correlation (only if avg duration is > 3 days)
  const avgDurationDays = averageHoldingDuration / (60 * 24);
  if (avgDurationDays > 3 && winRate > 50) {
    return {
      text: `Your closed trades held over 3 days have contributed to a positive win rate of ${winRate.toFixed(0)}%.`,
      confidence: 'high',
    };
  }

  // Insight 2: High concentration risk (only if one position is dominant)
  if (bestTradePnl !== null && worstTradePnl !== null && totalTrades >= 10) {
    const pnlSpread = Math.abs(bestTradePnl - worstTradePnl);
    const absWorst = Math.abs(worstTradePnl);
    if (absWorst > 0 && pnlSpread / absWorst > 5) {
      return {
        text: 'Your best and worst trades show a wide performance gap. Position sizing may be worth reviewing.',
        confidence: 'high',
      };
    }
  }

  // Insight 3: Consistent winning (≥70% win rate with sufficient trades)
  if (winRate >= 70 && totalTrades >= 10) {
    return {
      text: `${winRate.toFixed(0)}% of your closed trades have been profitable across ${totalTrades} trades.`,
      confidence: 'high',
    };
  }

  // No confident insight available
  return null;
}

export function BehavioralInsights({ summary }: Props) {
  const insight = useMemo(() => deriveInsight(summary), [summary]);

  if (!insight) return null;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-secondary p-4 flex gap-3 items-start">
      <div className="mt-0.5 flex-shrink-0 rounded-full bg-accent/10 p-1.5">
        <BookOpen className="h-3.5 w-3.5 text-accent" />
      </div>
      <p className="text-sm leading-relaxed text-text-secondary">{insight.text}</p>
    </div>
  );
}
