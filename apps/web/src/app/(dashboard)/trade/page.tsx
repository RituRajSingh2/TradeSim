import { Metadata } from 'next';
import { DashboardGrid } from '@/components/layout/DashboardGrid';
import { Panel } from '@/components/layout/Panel';
import { VirtualWatchlist } from '@/components/watchlist/VirtualWatchlist';

import { MainChart } from '@/components/charts/MainChart';
import { OrderPanel } from '@/components/trading/OrderPanel';
import { PortfolioSummary } from '@/components/trading/PortfolioSummary';
import { TradingReconciliation } from '@/components/trading/TradingReconciliation';

export const metadata: Metadata = {
  title: 'Trading Workspace',
};

export default function TradePage() {
  // Temporary watchlist symbols for scaffolding
  const watchlistSymbols = [
    'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'SBI', 'BHARTIARTL',
    'ITC', 'LT', 'BAJFINANCE', 'HINDUNILVR', 'AXISBANK', 'KOTAKBANK',
    'MARUTI', 'SUNPHARMA', 'ULTRACEMCO', 'TITAN', 'NTPC', 'TATASTEEL',
    'POWERGRID', 'ONGC', 'M&M', 'WIPRO', 'ADANIPORTS', 'NESTLEIND',
    'HCLTECH', 'ASIANPAINT', 'BAJAJFINSV', 'GRASIM', 'TECHM'
  ];

  return (
    <>
      <TradingReconciliation />
      <DashboardGrid>
        {/* 1. Watchlist Panel (Left) */}
      <Panel area="watchlist" scrollable>
        {/* Fill height so VirtualList can calculate properly */}
        <div className="h-full w-full">
          <VirtualWatchlist symbols={watchlistSymbols} className="h-full border-none rounded-none" />
        </div>
      </Panel>

      {/* 2. Main Chart Panel (Center) */}
      <Panel area="chart" scrollable={false}>
        <div className="flex flex-col h-full bg-bg-primary w-full">
          <div className="h-12 border-b border-border-subtle flex items-center px-4 shrink-0 bg-bg-secondary">
            <span className="font-semibold">NIFTY 50</span>
            <span className="ml-auto text-xs text-text-tertiary">Chart Tools Placeholder</span>
          </div>
          <div className="flex-1 relative w-full h-full p-2">
            <MainChart symbol="RELIANCE" />
          </div>
        </div>
      </Panel>

      {/* 3. Order Panel (Right) */}
      <Panel area="order" scrollable>
        <div className="p-4 space-y-6 h-full flex flex-col">
          <OrderPanel symbol="RELIANCE" />
          
          <div className="bg-bg-card border border-border-subtle rounded-xl p-4 shrink-0">
            <PortfolioSummary />
          </div>
        </div>
      </Panel>
    </DashboardGrid>
    </>
  );
}
