'use client';

import React, { forwardRef } from 'react';
import { formatCurrency } from '@tradesim/shared';
import { ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';

interface TradeShareCardProps {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalValue: number;
}

export const TradeShareCard = forwardRef<HTMLDivElement, TradeShareCardProps>(
  ({ symbol, side, quantity, price, totalValue }, ref) => {
    const isBuy = side === 'BUY';

    return (
      <div 
        ref={ref}
        className="w-[400px] h-[400px] bg-[#0F0F13] flex flex-col relative overflow-hidden"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {/* Subtle, premium gradient mesh (Matte) */}
        <div className={clsx(
          "absolute top-0 left-0 right-0 h-32 opacity-40",
          isBuy ? "bg-gradient-to-b from-emerald-900/40 to-transparent" : "bg-gradient-to-b from-rose-900/40 to-transparent"
        )} />
        
        {/* Core Content */}
        <div className="relative z-10 flex-1 flex flex-col p-8">
          
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#25252B] flex items-center justify-center border border-[#333338]">
                <span className="font-bold text-white text-sm">TS</span>
              </div>
              <span className="text-sm font-semibold tracking-wide text-gray-300">TradeSim</span>
            </div>
            
            <div className="px-3 py-1 bg-[#1A1A24] rounded-full border border-[#2A2A35]">
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
                Trade Execution
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <span className={clsx(
                "px-2 py-1 rounded text-xs font-bold uppercase tracking-wider",
                isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
              )}>
                {side}
              </span>
              <span className="text-white font-bold text-xl tracking-tight">{symbol}</span>
            </div>
            
            <h2 className="text-gray-400 font-medium text-lg leading-snug">
              Executed {quantity} shares at <span className="text-white font-semibold tabular-nums">{formatCurrency(price)}</span>
            </h2>

            <div className="mt-8 pt-6 border-t border-[#2A2A35]">
              <span className="text-xs text-gray-500 uppercase font-semibold tracking-widest">Total Value</span>
              <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                {formatCurrency(totalValue)}
              </div>
            </div>
          </div>

        </div>

        {/* 
          ANTI-FAKE INTEGRITY STRATEGY
          Same exact uncroppable footer as PortfolioCard to maintain consistency.
        */}
        <div className="relative z-20 w-full bg-[#18181D] border-t border-[#2A2A35] p-4 flex items-center justify-center gap-2 mt-auto">
          <ShieldAlert className="w-4 h-4 text-amber-500/80" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-500/80">
            Simulated Paper Trade
          </span>
        </div>
      </div>
    );
  }
);
TradeShareCard.displayName = 'TradeShareCard';
