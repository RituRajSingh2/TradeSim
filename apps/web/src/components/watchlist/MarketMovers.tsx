'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import { cn, pnlColor } from '@/lib/utils';
import { formatCurrency } from '@tradesim/shared';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react';
import { Sparkline } from './Sparkline';

interface TrendingSymbol {
  symbol: string;
  changePercent: number;
  ltp: number;
}

export function MarketMovers() {
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers'>('gainers');
  const [gainers, setGainers] = useState<TrendingSymbol[]>([]);
  const [losers, setLosers] = useState<TrendingSymbol[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTrending() {
      try {
        // Fetch top movers by absolute percentage
        const data = await apiGet<TrendingSymbol[]>('/market/trending', { limit: 20 });
        
        // Separate them based on actual direction
        const g = data.filter(s => s.changePercent >= 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
        const l = data.filter(s => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);
        
        setGainers(g);
        setLosers(l);
      } catch (err) {
        console.error('Failed to fetch trending symbols', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchTrending();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTrending, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentList = activeTab === 'gainers' ? gainers : losers;
  
  if (isLoading && currentList.length === 0) {
    return (
      <div className="animate-pulse flex space-x-4 p-4 bg-bg-card border-y border-border-subtle h-[140px]">
        <div className="flex-1 bg-bg-tertiary rounded"></div>
        <div className="flex-1 bg-bg-tertiary rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-bg-primary">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border-subtle">
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary tracking-tight">Trending this session</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('gainers')}
            className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full transition-colors",
              activeTab === 'gainers' ? "bg-positive/20 text-positive" : "text-text-muted hover:text-text-primary"
            )}
          >
            Gainers
          </button>
          <button 
            onClick={() => setActiveTab('losers')}
            className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full transition-colors",
              activeTab === 'losers' ? "bg-negative/20 text-negative" : "text-text-muted hover:text-text-primary"
            )}
          >
            Losers
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar p-4 gap-3">
        {currentList.length === 0 ? (
          <div className="text-xs text-text-muted py-4 px-2">No heavy movers in this session yet.</div>
        ) : (
          currentList.map((item) => {
            const isPositive = item.changePercent >= 0;
            return (
              <Link 
                key={item.symbol} 
                href={`/trade/${item.symbol}`}
                className="snap-start shrink-0 w-[160px] p-3 rounded-xl border border-border-subtle bg-bg-card flex flex-col justify-between active:scale-95 transition-transform"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-semibold text-text-primary text-[15px]">{item.symbol}</span>
                  <div className={cn("flex items-center text-[11px] font-bold", pnlColor(item.changePercent))}>
                    {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                    {Math.abs(item.changePercent).toFixed(2)}%
                  </div>
                </div>
                
                <div className="my-2 opacity-80 h-[24px]">
                  <Sparkline symbol={item.symbol} isPositive={isPositive} width={134} height={24} />
                </div>
                
                <span className="font-financial font-medium text-text-primary text-sm tabular-nums">
                  {formatCurrency(item.ltp)}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
