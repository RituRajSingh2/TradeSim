'use client';

import React from 'react';
import { useTickHistoryStore } from '@/stores/tick-history-store';
import { cn } from '@/lib/utils';

interface SparklineProps {
  symbol: string;
  width?: number;
  height?: number;
  className?: string;
  isPositive: boolean;
}

export function Sparkline({ symbol, width = 60, height = 24, className, isPositive }: SparklineProps) {
  // We use a selector to only re-render this tiny component when THIS symbol's ticks change
  const ticks = useTickHistoryStore(state => state.ticks[symbol] || []);

  if (ticks.length < 2) {
    return (
      <svg width={width} height={height} className={cn("opacity-30", className)}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
      </svg>
    );
  }

  const min = Math.min(...ticks);
  const max = Math.max(...ticks);
  const range = max - min;
  
  // Padding so the line doesn't hit the exact edges
  const paddingY = 2;
  const innerHeight = height - paddingY * 2;
  
  const points = ticks.map((val, i) => {
    const x = (i / (ticks.length - 1)) * width;
    
    // If range is 0 (all prices identical), draw a straight line in the middle
    let y = height / 2;
    if (range > 0) {
      // SVG y-axis is inverted (0 is top)
      const normalizedY = (val - min) / range;
      y = height - paddingY - (normalizedY * innerHeight);
    }
    
    return `${x},${y}`;
  }).join(' ');

  const strokeColor = isPositive ? 'text-positive' : 'text-negative';

  return (
    <svg width={width} height={height} className={cn(strokeColor, "transition-colors", className)}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="drop-shadow-sm"
      />
    </svg>
  );
}
