'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';

export interface AnalyticsSummary {
  totalTrades: number;
  winningTrades: number;
  realizedPnl: number;
  bestTradeSymbol: string | null;
  bestTradePnl: number | null;
  worstTradeSymbol: string | null;
  worstTradePnl: number | null;
  totalHoldingDuration: number;
  allocationBreakdown: Record<string, number> | null;
  winRate: number;
  averageHoldingDuration: number;
  analyticsVersion: number;
  lastUpdated: string;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  unrealizedPnl: number;
  totalPortfolioValue: number;
}

interface ApiResponse {
  success: boolean;
  data: AnalyticsData;
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounced unrealized PnL — never update faster than 1500ms
  const [stableUnrealizedPnl, setStableUnrealizedPnl] = useState<number>(0);
  const unrealizedPnlRef = useRef<number>(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateUnrealizedPnl = useCallback((value: number) => {
    unrealizedPnlRef.current = value;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setStableUnrealizedPnl(unrealizedPnlRef.current);
    }, 1500);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await apiGet<ApiResponse>('/analytics/summary');
      const payload = (res as any)?.data ?? res;
      setData(payload);
      // Initialize stable value without debounce on first load
      setStableUnrealizedPnl(payload.unrealizedPnl ?? 0);
    } catch (err: any) {
      setError('Unable to load analytics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [fetchAnalytics]);

  return {
    data,
    isLoading,
    error,
    stableUnrealizedPnl,
    updateUnrealizedPnl,
    refresh: fetchAnalytics,
  };
}
