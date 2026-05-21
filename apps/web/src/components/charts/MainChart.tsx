'use client';

import React, { useEffect, useState } from 'react';
import { ChartAdapter } from './ChartAdapter';
import { useChartStore, type ChartCandle } from '@/stores/chart-store';
import { apiGet } from '@/lib/api-client';
import type { ChartTimeframe } from '@tradesim/shared';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface MainChartProps {
  symbol: string;
}

const TIMEFRAMES: ChartTimeframe[] = ['10s', '30s', '1m', '5m', '15m', '1h', '1D', '1W', '1M', '1Y'];

export function MainChart({ symbol }: MainChartProps) {
  const { activeTimeframe, setActiveChart, addChunk, getFlattenedData, hasLoadedSessionMax } = useChartStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);

  // Initialize and load first chunk when symbol/timeframe changes
  useEffect(() => {
    let isMounted = true;
    setActiveChart(symbol, activeTimeframe);

    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        // Mocking API call for now — this should call GET /api/market/history
        const res = await apiGet<{ candles: ChartCandle[] }>(
          `/market/history?symbol=${symbol}&timeframe=${activeTimeframe}&limit=500`
        );
        if (!isMounted) return;
        
        // Ensure candles is always an array
        addChunk(symbol, activeTimeframe, 0, res.candles || []);
      } catch (err) {
        console.error("Failed to load initial history:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [symbol, activeTimeframe, setActiveChart, addChunk]);

  // Handle lazy loading when user scrolls left
  const handleLoadMore = async (oldestVisibleTime: number) => {
    if (isPaginating || hasLoadedSessionMax(symbol, activeTimeframe)) return;
    
    setIsPaginating(true);
    try {
       const res = await apiGet<{ candles: ChartCandle[] }>(
          `/market/history?symbol=${symbol}&timeframe=${activeTimeframe}&to=${oldestVisibleTime}&limit=500`
       );

       if (res.candles && res.candles.length > 0) {
         const currentOldest = useChartStore.getState().oldestLoadedIndex[`${symbol}_${activeTimeframe}`] ?? 0;
         addChunk(symbol, activeTimeframe, currentOldest - 1, res.candles);
       }
    } catch (err) {
      console.error("Failed to paginate history:", err);
    } finally {
      setIsPaginating(false);
    }
  };

  const chartData = getFlattenedData(symbol, activeTimeframe);

  return (
    <div className="flex flex-col h-full bg-bg-primary w-full relative">
      {/* Timeframe Header Toolbar */}
      <div className="h-12 border-b border-border-subtle flex items-center px-4 shrink-0 bg-bg-secondary gap-4 z-dropdown">
        <div className="font-semibold">{symbol}</div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveChart(symbol, tf)}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors font-medium",
                activeTimeframe === tf 
                  ? "bg-accent/20 text-accent" 
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-text-tertiary flex gap-2">
           <button className="px-2 py-1 hover:bg-bg-tertiary rounded">Indicators</button>
           <button className="px-2 py-1 hover:bg-bg-tertiary rounded">Settings</button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative w-full h-full p-0">
        {isLoading && chartData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/50 z-chart">
             <Loader2 className="h-8 w-8 text-accent animate-spin" />
          </div>
        ) : null}

        {isPaginating && (
          <div className="absolute top-2 left-2 z-chart bg-bg-elevated px-3 py-1 rounded shadow text-xs flex items-center gap-2">
            <Loader2 className="h-3 w-3 text-text-secondary animate-spin" />
            <span className="text-text-secondary">Loading history...</span>
          </div>
        )}

        <ChartAdapter 
          symbol={symbol} 
          timeframe={activeTimeframe}
          data={chartData} 
          onLoadMore={handleLoadMore}
        />
      </div>
    </div>
  );
}
