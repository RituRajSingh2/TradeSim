'use client';

import React, { useEffect, useState } from 'react';
import { ChartAdapter } from '@/components/charts/ChartAdapter';
import { useChartStore, type ChartCandle } from '@/stores/chart-store';
import { apiGet } from '@/lib/api-client';
import type { ChartTimeframe } from '@tradesim/shared';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface TradeChartProps {
  symbol: string;
}

const TIMEFRAMES: ChartTimeframe[] = ['1D', '1W', '1M', '1Y'];

export function TradeChart({ symbol }: TradeChartProps) {
  const { activeTimeframe, setActiveChart, addChunk, getFlattenedData } = useChartStore();
  const [isLoading, setIsLoading] = useState(false);

  // We only show a limited set of timeframes in the mobile trading view
  const currentTf = TIMEFRAMES.includes(activeTimeframe) ? activeTimeframe : '1D';

  useEffect(() => {
    let isMounted = true;
    setActiveChart(symbol, currentTf);

    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const res = await apiGet<{ candles: ChartCandle[] }>(
          `/market/history?symbol=${symbol}&timeframe=${currentTf}&limit=500`
        );
        if (!isMounted) return;
        addChunk(symbol, currentTf, 0, res.candles || []);
      } catch (err) {
        console.error("Failed to load initial history:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadInitialData();
    return () => { isMounted = false; };
  }, [symbol, currentTf, setActiveChart, addChunk]);

  const chartData = getFlattenedData(symbol, currentTf);

  return (
    <div className="flex flex-col w-full bg-bg-primary h-[42vh] min-h-[360px] max-h-[480px]">
      <div className="h-10 border-b border-border-subtle flex items-center px-4 shrink-0 gap-4">
        <div className="flex items-center gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveChart(symbol, tf)}
              className={cn(
                "px-3 py-1 text-[11px] rounded transition-colors font-semibold uppercase tracking-wider",
                currentTf === tf 
                  ? "bg-text-primary text-bg-primary" 
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 relative w-full h-full p-0">
        {isLoading && chartData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/50 z-10">
            <Loader2 className="h-6 w-6 text-text-muted animate-spin" />
          </div>
        )}
        <ChartAdapter 
          symbol={symbol} 
          timeframe={currentTf}
          data={chartData} 
        />
      </div>
    </div>
  );
}
