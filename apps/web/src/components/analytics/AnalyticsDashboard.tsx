'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { TrendingUp, TrendingDown, Target, Clock, Trophy, AlertTriangle } from 'lucide-react';
import { EquityChart } from '../charts/EquityChart';

interface PerformanceMetrics {
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  realizedPnl: number;
  unrealizedPnl: number;
  bestTrade: { symbol: string; pnl: number; percent: number } | null;
  worstTrade: { symbol: string; pnl: number; percent: number } | null;
  avgHoldingDurationMs: number;
  allocation: Record<string, number>;
}

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAnalytics = async () => {
      try {
        const data = await apiGet<PerformanceMetrics>('/portfolio/analytics');
        if (isMounted) setMetrics(data);
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchAnalytics();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-text-muted">Loading Analytics...</div>;
  }

  if (!metrics) {
    return <div className="flex h-64 items-center justify-center text-text-muted">No data available. Start trading!</div>;
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  const formatPercent = (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-text-primary">Performance Insights</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border-subtle glass-panel p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
            <Target className="h-4 w-4 text-accent" />
            Win Rate
          </div>
          <div className="text-2xl font-bold text-text-primary">{metrics.winRate.toFixed(1)}%</div>
          <div className="mt-1 text-xs text-text-muted">{metrics.winningTrades}W / {metrics.losingTrades}L</div>
        </div>

        <div className="rounded-xl border border-border-subtle glass-panel p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
            <TrendingUp className="h-4 w-4 text-positive" />
            Realized P&L
          </div>
          <div className={`text-2xl font-bold ${metrics.realizedPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
            {formatCurrency(metrics.realizedPnl)}
          </div>
        </div>

        <div className="rounded-xl border border-border-subtle glass-panel p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
            <Clock className="h-4 w-4 text-blue-400" />
            Unrealized P&L
          </div>
          <div className={`text-2xl font-bold ${metrics.unrealizedPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
            {formatCurrency(metrics.unrealizedPnl)}
          </div>
        </div>

        <div className="rounded-xl border border-border-subtle glass-panel p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
            <Trophy className="h-4 w-4 text-yellow-400" />
            Total Trades
          </div>
          <div className="text-2xl font-bold text-text-primary">{metrics.totalTrades}</div>
        </div>
      </div>

      {/* Equity Curve Chart */}
      <div className="flex flex-col rounded-xl border border-border-subtle glass-panel overflow-hidden">
        <div className="border-b border-border-subtle p-4 pb-3">
          <h3 className="font-semibold text-text-primary">Portfolio Equity Curve</h3>
        </div>
        <div className="h-[350px] w-full p-0">
          <EquityChart />
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border-subtle glass-panel p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <Trophy className="h-4 w-4 text-yellow-400" /> Best Trade
          </div>
          {metrics.bestTrade ? (
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg text-text-primary">{metrics.bestTrade.symbol}</span>
              <div className="text-right">
                <div className="text-positive font-bold">{formatCurrency(metrics.bestTrade.pnl)}</div>
                <div className="text-sm text-positive">{formatPercent(metrics.bestTrade.percent)}</div>
              </div>
            </div>
          ) : (
             <div className="text-sm text-text-muted">No closed profitable trades yet.</div>
          )}
        </div>

        <div className="rounded-xl border border-border-subtle glass-panel p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <AlertTriangle className="h-4 w-4 text-negative" /> Worst Trade
          </div>
          {metrics.worstTrade ? (
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg text-text-primary">{metrics.worstTrade.symbol}</span>
              <div className="text-right">
                <div className="text-negative font-bold">{formatCurrency(metrics.worstTrade.pnl)}</div>
                <div className="text-sm text-negative">{formatPercent(metrics.worstTrade.percent)}</div>
              </div>
            </div>
          ) : (
             <div className="text-sm text-text-muted">No closed losing trades yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
