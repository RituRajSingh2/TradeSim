import { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  ColorType,
} from 'lightweight-charts';
import type { WsChartCandlePayload, ChartTimeframe } from '@tradesim/shared';
import { socketManager } from '@/lib/socket-client';
import { useChartStore, type ChartCandle } from '@/stores/chart-store';
import { calculateSMA } from '@/lib/indicators/sma';

export interface ChartAdapterProps {
  symbol: string;
  timeframe: ChartTimeframe;
  data: ChartCandle[]; // Initial historical data chunk
  onLoadMore?: (oldestTime: number) => void;
}

export function ChartAdapter({ symbol, timeframe, data, onLoadMore }: ChartAdapterProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  // Track visibility/focus for background degradation
  const isVisibleRef = useRef(true);

  // Initialization & Data Loading
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Use initial client bounds
    const rect = chartContainerRef.current.getBoundingClientRect();
    
    const chart = createChart(chartContainerRef.current, {
      width: rect.width || 600,
      height: rect.height || 400,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1, // Normal crosshair
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981', // positive
      downColor: '#ef4444', // negative
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    seriesRef.current = candlestickSeries;
    
    // Add an SMA indicator purely on the client-side
    const smaSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    smaSeriesRef.current = smaSeries;

    // Set initial data
    if (data && data.length > 0) {
      // Data must be sorted by time ascending and strictly unique
      candlestickSeries.setData(data as any);
      
      // Calculate SMA 20 synchronously (modular architecture)
      const smaData = calculateSMA(data, 20);
      if (smaData.length > 0) {
        smaSeries.setData(smaData as any);
      }
    }

    // Lazy Loading Edge Detection (Viewport Preservation)
    const handleVisibleRangeChange = () => {
      if (!onLoadMore || !chartRef.current || !data || data.length === 0) return;
      
      const logicalRange = chartRef.current.timeScale().getVisibleLogicalRange();
      if (logicalRange !== null) {
        // If the user scrolls to the left-most 10% of the chart, trigger load more
        if (logicalRange.from < 50) {
           onLoadMore(data[0].time);
        }
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    // Setup ResizeObserver (imperative, no React state changes!)
    let resizeTimeout: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      
      const { width, height } = entries[0].contentRect;
      
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (chartRef.current) {
          chartRef.current.applyOptions({ width, height });
        }
      }, 100);
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimeout);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      smaSeriesRef.current = null;
    };
  }, [data, onLoadMore]); // Re-init when the flattened data array reference fundamentally changes (e.g., chunk load)

  // Imperative tick update outside React state
  useEffect(() => {
    if (!symbol || !timeframe) return;
    const upperSymbol = symbol.toUpperCase();

    const handleCandleUpdate = (payload: WsChartCandlePayload) => {
      if (payload.symbol !== upperSymbol || payload.timeframe !== timeframe) return;
      
      const mappedCandle: ChartCandle = {
        time: Math.floor(payload.bar.time / 1000), // Ensure seconds
        open: payload.bar.open,
        high: payload.bar.high,
        low: payload.bar.low,
        close: payload.bar.close,
        volume: payload.bar.volume,
      };

      // 1. Instantly update UI (no React rerender)
      if (isVisibleRef.current && seriesRef.current) {
        seriesRef.current.update(mappedCandle as any);
        
        // We can also update SMA incrementally if we wanted,
        // but for now we skip SMA tick update for simplicity in the modular pipeline.
      }

      // 2. Persist to Chart Store (no React rerender triggered here for ChartAdapter since it doesn't select this data directly)
      useChartStore.getState().appendRealtimeCandle(symbol, timeframe, mappedCandle, payload.isUpdate);
    };

    socketManager.onChartCandle(handleCandleUpdate);

    return () => {
      socketManager.offChartCandle(handleCandleUpdate);
    };
  }, [symbol, timeframe]);

  // Handle visibility changes for tab degradation
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return <div ref={chartContainerRef} className="w-full h-full relative" />;
}
