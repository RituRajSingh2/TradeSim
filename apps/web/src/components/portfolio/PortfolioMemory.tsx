'use client';

/**
 * PortfolioMemory
 * 
 * A calm, financially grounded surface that anchors the user to their
 * previous day's close. Emphasizes continuity over excitement.
 * No gamification, no dopamine spikes.
 */

import { formatCurrency } from '@tradesim/shared';
import { clsx } from 'clsx';
import { Clock, Share } from 'lucide-react';
import { useRef, useState } from 'react';
import { shareElementAsImage } from '@/lib/share';
import { PortfolioShareCard } from '../share/PortfolioShareCard';

interface PortfolioMemoryProps {
  totalValue: number;
  dayPnl: number;
  dayPnlPercent: number;
}

export function PortfolioMemory({ totalValue, dayPnl, dayPnlPercent }: PortfolioMemoryProps) {
  const yesterdayClose = totalValue - dayPnl;
  const isPositive = dayPnl >= 0;
  const cardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!cardRef.current || isSharing) return;
    setIsSharing(true);
    try {
      await shareElementAsImage(cardRef.current, {
        fileName: 'portfolio-snapshot.png',
        shareTitle: 'My Weekly Summary',
        shareText: 'Check out my portfolio performance on TradeSim.',
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 py-3 mt-1 border-t border-border-subtle bg-bg-primary/30 -mx-4 px-4 rounded-b-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-widest">
          <Clock className="w-3.5 h-3.5 opacity-70" />
          <span>Portfolio Memory</span>
        </div>
        <button 
          onClick={handleShare} 
          disabled={isSharing}
          className="flex items-center gap-1 text-[10px] uppercase font-bold text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          <Share className="w-3 h-3" />
          {isSharing ? 'Exporting...' : 'Share'}
        </button>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[11px] text-text-tertiary">Yesterday's Close</span>
          <span className="text-sm font-medium text-text-secondary tabular-nums tracking-tight">
            {formatCurrency(yesterdayClose)}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[11px] text-text-tertiary">Today vs Yesterday</span>
          <div className="flex items-baseline gap-1.5">
            <span className={clsx(
              "text-sm font-semibold tabular-nums tracking-tight transition-colors duration-300",
              isPositive ? "text-emerald-500/90" : "text-rose-500/90"
            )}>
              {isPositive ? '+' : ''}{formatCurrency(dayPnl)}
            </span>
            <span className={clsx(
              "text-xs font-medium tabular-nums",
              isPositive ? "text-emerald-500/70" : "text-rose-500/70"
            )}>
              ({isPositive ? '+' : ''}{dayPnlPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Hidden Offscreen Export Card */}
      <div className="absolute top-0 left-0 -z-50 opacity-0 pointer-events-none">
        <PortfolioShareCard 
          ref={cardRef} 
          totalValue={totalValue} 
          dayPnl={dayPnl} 
          dayPnlPercent={dayPnlPercent} 
        />
      </div>
    </div>
  );
}
