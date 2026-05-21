'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { apiGet } from '@/lib/api-client';

type TimeRange = '1d' | '1w' | '1mo' | '1y' | 'all';

interface EquityPoint {
  time: number;
  value: number;
}

const RANGES: { value: TimeRange; label: string }[] = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1mo', label: '1M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'ALL' },
];

export function EquityChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const [range, setRange] = useState<TimeRange>('1mo');
  const [data, setData] = useState<EquityPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch data on range change
  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const response = await apiGet<{ data: EquityPoint[] }>(`/portfolio/history?range=${range}`);
        if (isMounted) {
          setData(response.data);
        }
      } catch (err) {
        console.error('Failed to load equity curve', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadHistory();
    return () => { isMounted = false; };
  }, [range]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid' as const, color: 'transparent' },
        textColor: '#a3a3a3',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const series = chart.addAreaSeries({
      lineColor: '#6366f1',
      topColor: 'rgba(99, 102, 241, 0.4)',
      bottomColor: 'rgba(99, 102, 241, 0.0)',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    
    if (data.length > 0) {
      // lightweight-charts expects time ascending
      const formattedData = data.map(d => ({
        time: d.time as Time,
        value: d.value,
      }));
      seriesRef.current.setData(formattedData);
      chartRef.current.timeScale().fitContent();
    } else {
      seriesRef.current.setData([]);
    }
  }, [data]);

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Timeframe Selector */}
      <div className="absolute top-2 right-4 z-10 flex gap-1 rounded-md bg-bg-primary/80 p-1 backdrop-blur-sm border border-border-subtle">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
              range === r.value 
                ? 'bg-accent text-white' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-primary/20 backdrop-blur-[1px]">
          <span className="text-sm text-text-muted">Loading chart...</span>
        </div>
      )}
      
      {data.length === 0 && !isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <span className="text-sm text-text-muted">Not enough data to plot equity curve.</span>
        </div>
      )}

      {/* Chart Container */}
      <div ref={chartContainerRef} className="flex-1 w-full" />
    </div>
  );
}
