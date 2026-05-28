'use client';

import React, { useEffect, useState } from 'react';
import { useMarketSessionStore } from '@/stores/market-session-store';
import { useMarketHealthStore } from '@/stores/market-health-store';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

export function MarketStatusIndicator() {
  const { session, timeRemainingText } = useMarketSessionStore();
  const { globalStaleness } = useMarketHealthStore();
  
  // Hydration safety since time is dynamic
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  if (!mounted) {
    return <div className="h-[22px]" />; // Placeholder to prevent layout shift
  }

  const isStale = globalStaleness === 'critical' || globalStaleness === 'expired';
  const isDelayed = globalStaleness === 'delayed';

  let dotColor = 'bg-text-tertiary'; // default gray for closed/weekend
  let statusText = 'Market Closed';

  if (session === 'OPEN') {
    dotColor = 'bg-positive';
    statusText = 'Market Open';
  } else if (session === 'PREOPEN') {
    dotColor = 'bg-accent';
    statusText = 'Pre-Open';
  } else if (session === 'WEEKEND') {
    statusText = 'Weekend Closed';
  }

  return (
    <div className="flex items-center gap-3">
      {/* Primary Session Status */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-bg-secondary border border-border-subtle">
        <div className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
          {statusText}
        </span>
        {timeRemainingText && (
          <>
            <span className="text-[10px] text-text-tertiary mx-0.5">•</span>
            <span className="text-[10px] font-medium text-text-tertiary lowercase">
              {timeRemainingText}
            </span>
          </>
        )}
      </div>

      {/* Feed Health Warning (Only show if open/preopen and degraded) */}
      {(session === 'OPEN' || session === 'PREOPEN') && (isStale || isDelayed) && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20">
          <AlertCircle className="w-3 h-3 text-warning" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-warning">
            {isStale ? 'Feed Stale' : 'Delayed Feed'}
          </span>
        </div>
      )}
    </div>
  );
}
