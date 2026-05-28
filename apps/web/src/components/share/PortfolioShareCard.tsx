'use client';

import React, { forwardRef } from 'react';
import { formatCurrency } from '@tradesim/shared';
import { TrendingUp, TrendingDown, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';

interface PortfolioShareCardProps {
  totalValue: number;
  dayPnl: number;
  dayPnlPercent: number;
  userName?: string; // Optional: e.g., "John's Portfolio"
}

export const PortfolioShareCard = forwardRef<HTMLDivElement, PortfolioShareCardProps>(
  ({ totalValue, dayPnl, dayPnlPercent, userName }, ref) => {
    const isPositive = dayPnl >= 0;

    return (
      <div 
        ref={ref}
        // Fixed dimensions optimized for Instagram Story / WhatsApp sharing (Square-ish or 4:5)
        className="w-[400px] h-[480px] bg-[#0F0F13] flex flex-col relative overflow-hidden"
        style={{
          fontFamily: 'Inter, sans-serif' // Ensure fonts render perfectly
        }}
      >
        {/* Subtle, premium gradient mesh (Matte, no glass) */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#1A1A24] to-transparent opacity-80" />
        
        {/* Core Content */}
        <div className="relative z-10 flex-1 flex flex-col p-8">
          
          <div className="flex justify-between items-start mb-12">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#25252B] flex items-center justify-center border border-[#333338]">
                <span className="font-bold text-white text-sm">TS</span>
              </div>
              <span className="text-sm font-semibold tracking-wide text-gray-300">TradeSim</span>
            </div>
            
            <div className="px-3 py-1 bg-[#1A1A24] rounded-full border border-[#2A2A35]">
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
                Weekly Summary
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-1">
            <h3 className="text-gray-400 font-medium text-sm">
              {userName ? `${userName}'s Portfolio` : 'Portfolio Value'}
            </h3>
            
            <div className="text-[42px] leading-tight font-bold text-white tracking-tight tabular-nums">
              {formatCurrency(totalValue)}
            </div>

            <div className={clsx(
              "flex items-center gap-2 mt-2 text-lg font-medium tracking-tight tabular-nums",
              isPositive ? "text-emerald-400" : "text-rose-400"
            )}>
              {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span>{isPositive ? '+' : ''}{formatCurrency(dayPnl)}</span>
              <span className="opacity-70">({isPositive ? '+' : ''}{dayPnlPercent.toFixed(2)}%)</span>
            </div>
          </div>

        </div>

        {/* 
          ANTI-FAKE INTEGRITY STRATEGY
          The watermark is deeply embedded in the footer. It has a strong background contrast, 
          iconography, and stretches full width. If someone crops this out, they crop out the 
          bottom padding and ruin the aspect ratio/layout balance of the card.
        */}
        <div className="relative z-20 w-full bg-[#18181D] border-t border-[#2A2A35] p-5 flex items-center justify-center gap-2 mt-auto">
          <ShieldAlert className="w-4 h-4 text-amber-500/80" />
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-500/80">
            Simulated Paper Trade
          </span>
        </div>
      </div>
    );
  }
);
PortfolioShareCard.displayName = 'PortfolioShareCard';
