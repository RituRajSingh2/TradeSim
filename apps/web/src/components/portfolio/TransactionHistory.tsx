'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { usePortfolioStore } from '@/stores/portfolio-store';
import type { LedgerEntry, PaginatedResponse } from '@tradesim/shared';
import { formatCurrency } from '@tradesim/shared';
import { clsx } from 'clsx';
import { History, Loader2 } from 'lucide-react';

type TransactionRow = {
  id: string;
  side: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  price: number;
  createdAt: string;
  isOptimistic: boolean;
};

export function TransactionHistory() {
  const [serverTransactions, setServerTransactions] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { optimisticDelta, clearPendingTransactions } = usePortfolioStore();
  const { pendingTransactions } = optimisticDelta;

  useEffect(() => {
    let isMounted = true;
    
    async function fetchTransactions() {
      try {
        const res = await apiGet<PaginatedResponse<LedgerEntry>>(
          '/portfolio/transactions?category=BUY_ORDER,SELL_ORDER&pageSize=20'
        );
        if (isMounted) {
          setServerTransactions(res.items);
          
          // Clear pending transactions that have made it to the server
          // In a real app we'd filter them specifically by idempotencyKey if we could, 
          // but clearing them all on a fresh fetch is safe because they should be resolved.
          clearPendingTransactions();
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load transaction history');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTransactions();
    
    // Refresh occasionally or we can rely on manual refreshes
    const interval = setInterval(fetchTransactions, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [clearPendingTransactions]);

  // Merge optimistic and server transactions
  // Remove any server transaction that shares an idempotencyKey with a pending one (rare)
  const filteredServer = serverTransactions.filter(
    (st) => !pendingTransactions.some((pt) => pt.idempotencyKey === st.idempotencyKey)
  );

  const merged: TransactionRow[] = [
    ...pendingTransactions.map((pt) => ({
      id: pt.idempotencyKey,
      side: pt.side,
      symbol: pt.symbol,
      quantity: pt.quantity,
      price: pt.price,
      createdAt: pt.createdAt,
      isOptimistic: true,
    })),
    ...filteredServer.map((st) => ({
      id: st.id,
      side: (st.category === 'BUY_ORDER' ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
      symbol: (st.metadata?.symbol as string) || 'UNKNOWN',
      quantity: (st.metadata?.quantity as number) || 0,
      price: (st.metadata?.price as number) || 0,
      createdAt: st.createdAt,
      isOptimistic: false,
    }))
  ];

  // Sort merged array by createdAt desc
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (isLoading && merged.length === 0) {
    return (
      <div className="flex flex-col gap-3 mt-6">
        <h2 className="text-sm font-semibold text-text-primary tracking-tight px-1 flex items-center gap-2">
          <History className="h-4 w-4" /> Recent Activity
        </h2>
        <div className="flex justify-center p-6 bg-bg-card rounded-lg border border-border-subtle">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      </div>
    );
  }

  if (merged.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 mt-6">
      <h2 className="text-sm font-semibold text-text-primary tracking-tight px-1 flex items-center gap-2">
        <History className="h-4 w-4" /> Recent Activity
      </h2>
      
      <div className="flex flex-col bg-bg-card rounded-xl border border-border-subtle overflow-hidden">
        {merged.map((tx, idx) => {
          const dateObj = new Date(tx.createdAt);
          const timeString = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          
          return (
            <div 
              key={tx.id} 
              className={clsx(
                "flex items-center justify-between p-3 transition-opacity duration-150",
                idx !== merged.length - 1 && "border-b border-border-subtle",
                tx.isOptimistic && "opacity-70 animate-pulse bg-bg-tertiary/50"
              )}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide",
                    tx.side === 'BUY' ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
                  )}>
                    {tx.side}
                  </span>
                  <span className="text-sm font-bold text-text-primary tracking-tight">{tx.symbol}</span>
                  {tx.isOptimistic && (
                    <span className="text-[9px] text-text-tertiary uppercase ml-1">Sending...</span>
                  )}
                </div>
                <span className="text-[11px] text-text-secondary">
                  {timeString}
                </span>
              </div>

              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm font-semibold text-text-primary tabular-nums tracking-tight">
                  {formatCurrency(tx.price * tx.quantity)}
                </span>
                <span className="text-[11px] text-text-secondary tabular-nums">
                  {tx.quantity} Qty @ {formatCurrency(tx.price)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
