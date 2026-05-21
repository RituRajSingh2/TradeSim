'use client';

import React from 'react';
import { VirtualList } from '@/components/ui/VirtualList';
import { WatchlistRow } from './WatchlistRow';

export interface VirtualWatchlistProps {
  symbols: string[];
  className?: string;
}

export function VirtualWatchlist({ symbols, className }: VirtualWatchlistProps) {
  return (
    <div className={`h-[500px] w-full border border-border-subtle rounded-xl overflow-hidden bg-bg-primary ${className || ''}`}>
      <div className="bg-bg-tertiary px-4 py-3 border-b border-border-subtle flex justify-between items-center z-10 relative shadow-sm">
        <h3 className="font-medium text-sm text-text-primary uppercase tracking-wider">
          Watchlist ({symbols.length})
        </h3>
      </div>
      
      {/* The VirtualList must have a constrained height to scroll! */}
      {/* We use calc(100% - header_height) to fill the container */}
      <VirtualList
        className="h-[calc(100%-45px)]"
        items={symbols}
        estimateSize={() => 73} // ~73px is the height of WatchlistRow (p-4 + text)
        overscan={10} // Pre-render 10 items outside viewport
        keyExtractor={(symbol) => symbol}
        renderItem={(symbol, index) => (
          <WatchlistRow symbol={symbol} index={index} />
        )}
      />
    </div>
  );
}
