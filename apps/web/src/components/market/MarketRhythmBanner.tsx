'use client';

/**
 * MarketRhythmBanner
 * 
 * Intelligent suppression rules ensure this banner only appears for:
 * - Market session transitions (e.g. pre-open)
 * - Meaningful portfolio deltas
 * - Active watchlist movement
 * 
 * Goal: prevent banner blindness and preserve a quiet, intentional feel.
 */

import { useState, useEffect } from 'react';
import { useMarketSessionStore } from '@/stores/market-session-store';
import { Activity, Bell, Info, Sun, Moon } from 'lucide-react';

interface MarketRhythmBannerProps {
  portfolioDayPnlPercent?: number; // Passed from parent if available
}

export function MarketRhythmBanner({ portfolioDayPnlPercent = 0 }: MarketRhythmBannerProps) {
  const { session } = useMarketSessionStore();
  
  // 1. Show during Pre-Open
  const isTransitioning = session === 'PREOPEN';
  
  // 2. Show if portfolio moved meaningfully (> 1%)
  const hasMeaningfulDelta = Math.abs(portfolioDayPnlPercent) > 1.0;
  
  // 3. Just opened or about to close? (Fallback for when we track exact times)
  const isWeekend = session === 'WEEKEND';

  // Suppress if nothing interesting is happening
  if (!isTransitioning && !hasMeaningfulDelta && !isWeekend && session === 'OPEN') {
    return null; 
  }

  // Derive Banner Content
  let icon = <Activity className="w-4 h-4 text-sky-400" />;
  let text = 'Market is active.';

  if (isTransitioning) {
    icon = <Sun className="w-4 h-4 text-amber-400" />;
    text = 'Market is in pre-open phase. Trading begins soon.';
  } else if (isWeekend) {
    icon = <Moon className="w-4 h-4 text-gray-400" />;
    text = 'Markets are closed for the weekend.';
  } else if (session === 'CLOSED') {
    icon = <Moon className="w-4 h-4 text-indigo-400" />;
    
    // Adaptive messaging based on portfolio
    if (portfolioDayPnlPercent > 0.5) {
      text = 'Your portfolio closed higher today.';
    } else if (portfolioDayPnlPercent < -0.5) {
      text = 'Markets were mixed today.';
    } else {
      text = 'A quiet day for your portfolio.';
    }
  } else if (hasMeaningfulDelta) {
    // Open but portfolio moving
    if (portfolioDayPnlPercent > 0) {
      icon = <Activity className="w-4 h-4 text-emerald-400" />;
      text = 'Your portfolio is seeing strong positive momentum today.';
    } else {
      icon = <Info className="w-4 h-4 text-rose-400" />;
      text = 'Your portfolio is experiencing volatility today.';
    }
  }

  return (
    <div className="w-full bg-[#1A1A1F] border border-[#2A2A2E] rounded-lg px-4 py-3 flex items-center gap-3 animate-fade-in-up">
      <div className="shrink-0 p-1.5 bg-[#25252B] rounded-md border border-[#333338]">
        {icon}
      </div>
      <span className="text-sm font-medium text-gray-200">
        {text}
      </span>
    </div>
  );
}
