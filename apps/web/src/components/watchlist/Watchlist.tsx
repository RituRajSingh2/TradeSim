'use client';

import React from 'react';
import { useWatchlistStore } from '@/stores/watchlist-store';
import { WatchlistRow } from './WatchlistRow';
import { Search } from 'lucide-react';

export function Watchlist() {
  const symbols = useWatchlistStore((state) => state.symbols);

  if (symbols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="h-12 w-12 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
          <Search className="h-6 w-6 text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Your watchlist is empty
        </h3>
        <p className="text-sm text-text-secondary max-w-[260px]">
          Search for your favorite stocks to track their live performance here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full divide-y divide-border-subtle">
      {symbols.map((symbol, index) => (
        <WatchlistRow key={symbol} symbol={symbol} index={index} />
      ))}
    </div>
  );
}
