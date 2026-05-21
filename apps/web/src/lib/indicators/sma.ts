import type { ChartCandle } from '@/stores/chart-store';

export interface IndicatorResult {
  time: number;
  value: number;
}

/**
 * calculateSMA
 * Computes Simple Moving Average synchronously.
 * Designed to be easily offloadable to a Web Worker later.
 */
export function calculateSMA(data: ChartCandle[], period: number): IndicatorResult[] {
  if (data.length < period) return [];

  const results: IndicatorResult[] = [];
  let sum = 0;

  // Initialize the first window
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  results.push({ time: data[period - 1].time, value: sum / period });

  // Slide the window
  for (let i = period; i < data.length; i++) {
    sum += data[i].close - data[i - period].close;
    results.push({ time: data[i].time, value: sum / period });
  }

  return results;
}

/**
 * calculateIncrementalSMA
 * Computes just the trailing SMA value for a realtime tick update.
 */
export function calculateIncrementalSMA(
  currentCandles: ChartCandle[],
  period: number
): IndicatorResult | null {
  if (currentCandles.length < period) return null;

  // Grab the last N candles
  const window = currentCandles.slice(-period);
  let sum = 0;
  for (let i = 0; i < window.length; i++) {
    sum += window[i].close;
  }

  return {
    time: window[window.length - 1].time,
    value: sum / period,
  };
}
