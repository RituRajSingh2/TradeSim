'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TradeReview {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnl: number;
  holdingDuration: number; // minutes
  openedAt: string;
  closedAt: string;
}

interface PaginatedResponse {
  success: boolean;
  data: {
    items: TradeReview[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

const formatINR = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export function TradeReviewList() {
  const [items, setItems] = useState<TradeReview[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchTrades = useCallback(async (p: number) => {
    setIsLoading(true);
    try {
      const res = await apiGet<PaginatedResponse>(`/analytics/trades?page=${p}&limit=10`);
      const payload = (res as any)?.data ?? res;
      setItems(payload.items ?? []);
      setMeta(payload.meta ?? { total: 0, page: p, totalPages: 1 });
    } catch {
      // Silent failure — empty state shown
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades(page);
  }, [page, fetchTrades]);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-muted">
        Loading trade history...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-text-muted">No closed trades yet.</p>
        <p className="text-xs text-text-muted">Complete a sell order to see your trade history here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
              <th className="pb-3 pr-4 font-medium">Symbol</th>
              <th className="pb-3 pr-4 font-medium text-right">Entry</th>
              <th className="pb-3 pr-4 font-medium text-right">Exit</th>
              <th className="pb-3 pr-4 font-medium text-right">Qty</th>
              <th className="pb-3 pr-4 font-medium text-right">Realized P&L</th>
              <th className="pb-3 pr-4 font-medium text-right">Duration</th>
              <th className="pb-3 font-medium text-right">Closed</th>
            </tr>
          </thead>
          <tbody>
            {items.map((trade) => {
              const isProfit = trade.realizedPnl >= 0;
              // Use desaturated tones — avoid aggressive red
              const pnlClass = isProfit ? 'text-positive' : 'text-[hsl(0,40%,60%)]';
              return (
                <tr
                  key={trade.id}
                  className="border-b border-border-subtle/40 transition-colors hover:bg-surface-secondary/40"
                >
                  <td className="py-3 pr-4 font-semibold text-text-primary">{trade.symbol}</td>
                  <td className="py-3 pr-4 text-right text-text-secondary">{formatINR(trade.entryPrice)}</td>
                  <td className="py-3 pr-4 text-right text-text-secondary">{formatINR(trade.exitPrice)}</td>
                  <td className="py-3 pr-4 text-right text-text-secondary">{trade.quantity}</td>
                  <td className={`py-3 pr-4 text-right font-semibold ${pnlClass}`}>
                    {trade.realizedPnl >= 0 ? '+' : ''}{formatINR(trade.realizedPnl)}
                  </td>
                  <td className="py-3 pr-4 text-right text-text-muted">{formatDuration(trade.holdingDuration)}</td>
                  <td className="py-3 text-right text-text-muted">{formatDate(trade.closedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{meta.total} closed trades total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded p-1 transition-colors hover:bg-surface-secondary disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              {page} / {meta.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              className="rounded p-1 transition-colors hover:bg-surface-secondary disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
