'use client';

import { Target, TrendingUp, Clock, BarChart2, ArrowUp, ArrowDown } from 'lucide-react';
import { useAnalytics } from '@/lib/hooks/use-analytics';
import { BehavioralInsights } from './BehavioralInsights';
import { TradeReviewList } from './TradeReviewList';
import { EquityChart } from '../charts/EquityChart';

const formatINR = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val);

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m avg`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h avg`;
  return `${Math.floor(hours / 24)}d avg`;
};

/**
 * Computes portfolio allocation percentages from absolute values stored in API.
 * Percentages are ALWAYS derived at render time — never stored.
 */
function computeAllocationPct(breakdown: Record<string, number> | null): Array<{ symbol: string; pct: number }> {
  if (!breakdown) return [];
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  if (total === 0) return [];
  return Object.entries(breakdown)
    .map(([symbol, value]) => ({ symbol, pct: (value / total) * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const valueCls =
    tone === 'positive'
      ? 'text-positive'
      : tone === 'negative'
        ? 'text-[hsl(0,40%,60%)]' // desaturated, calm
        : 'text-text-primary';

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-secondary p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">{icon}{label}</div>
      {/* tabular-nums via inline style — zero layout shift guarantee */}
      <div className={`text-2xl font-bold tracking-tight ${valueCls}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

export function TradeAnalyticsDashboard() {
  const { data, isLoading, error, stableUnrealizedPnl } = useAnalytics();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-text-muted">
        Loading analytics...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-text-muted">
        {error ?? 'No analytics data available. Complete your first trade to begin.'}
      </div>
    );
  }

  const { summary } = data;
  const allocationPct = computeAllocationPct(summary.allocationBreakdown);
  const losingTrades = summary.totalTrades - summary.winningTrades;
  const unrealizedTone: 'positive' | 'negative' | 'neutral' =
    stableUnrealizedPnl > 0 ? 'positive' : stableUnrealizedPnl < 0 ? 'negative' : 'neutral';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-text-primary">Trade Review</h2>
        <span className="text-xs text-text-muted">
          v{summary.analyticsVersion} · Updated {new Date(summary.lastUpdated).toLocaleDateString('en-IN')}
        </span>
      </div>

      {/* KPI Cards — No animation, no flicker */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Win Rate"
          value={`${summary.winRate.toFixed(1)}%`}
          sub={`${summary.winningTrades}W · ${losingTrades}L`}
          icon={<Target className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Realized P&L"
          value={formatINR(Number(summary.realizedPnl))}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          tone={Number(summary.realizedPnl) >= 0 ? 'positive' : 'negative'}
        />
        {/* Unrealized PnL: debounced via hook — stable render */}
        <KpiCard
          label="Unrealized P&L"
          value={formatINR(stableUnrealizedPnl)}
          sub="Live · 1–2s cadence"
          icon={<BarChart2 className="h-3.5 w-3.5" />}
          tone={unrealizedTone}
        />
        <KpiCard
          label="Avg. Hold Duration"
          value={formatDuration(summary.averageHoldingDuration)}
          sub={`${summary.totalTrades} total trades`}
          icon={<Clock className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Behavioral Insight — max ONE, only if high-confidence */}
      <BehavioralInsights summary={summary} />

      {/* Equity Curve */}
      <div className="flex flex-col rounded-xl border border-border-subtle bg-surface-secondary overflow-hidden">
        <div className="border-b border-border-subtle px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">Portfolio Equity Curve</h3>
        </div>
        <div className="h-[300px] w-full">
          <EquityChart />
        </div>
      </div>

      {/* Best / Worst Trade */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-surface-secondary p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-muted">
            <ArrowUp className="h-3.5 w-3.5 text-positive" /> Best Trade
          </div>
          {summary.bestTradeSymbol ? (
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-text-primary">{summary.bestTradeSymbol}</span>
              <span className="font-semibold text-positive" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(Number(summary.bestTradePnl))}
              </span>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No profitable closes yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-secondary p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-muted">
            <ArrowDown className="h-3.5 w-3.5 text-[hsl(0,40%,60%)]" /> Worst Trade
          </div>
          {summary.worstTradeSymbol ? (
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-text-primary">{summary.worstTradeSymbol}</span>
              <span className="font-semibold text-[hsl(0,40%,60%)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(Number(summary.worstTradePnl))}
              </span>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No losing closes yet.</p>
          )}
        </div>
      </div>

      {/* Allocation Breakdown — rendered from absolute values */}
      {allocationPct.length > 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-secondary p-4">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Portfolio Allocation</h3>
          <div className="flex flex-col gap-3">
            {allocationPct.map(({ symbol, pct }) => (
              <div key={symbol} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm font-medium text-text-primary">{symbol}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-border-subtle/40 h-1.5">
                  {/* CSS-only transition, no animation libraries */}
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${pct.toFixed(1)}%`, transition: 'width 300ms ease' }}
                  />
                </div>
                <span
                  className="w-12 shrink-0 text-right text-xs text-text-muted"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade History */}
      <div className="rounded-xl border border-border-subtle bg-surface-secondary p-4">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Closed Trades</h3>
        <TradeReviewList />
      </div>
    </div>
  );
}
