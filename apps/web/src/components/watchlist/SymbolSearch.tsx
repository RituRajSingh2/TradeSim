'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Clock, Plus } from 'lucide-react';
import { useWatchlistStore } from '@/stores/watchlist-store';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/lib/hooks/use-debounce'; // Will need to verify this exists or create it

// Mock search function since we don't have a backend search endpoint yet
const MOCK_STOCKS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'L&T', 'BAJFINANCE'];

export function SymbolSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 200);
  const [results, setResults] = useState<string[]>([]);
  
  const { symbols, recentSearches, addSymbol, addRecentSearch } = useWatchlistStore();

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }
    
    // Simple frontend filtering for mock
    const upperQuery = debouncedQuery.toUpperCase();
    const filtered = MOCK_STOCKS.filter(s => s.includes(upperQuery));
    setResults(filtered);
  }, [debouncedQuery]);

  const handleSelect = (symbol: string) => {
    addSymbol(symbol);
    addRecentSearch(symbol);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative w-full">
      {/* Search Input Trigger */}
      <div 
        className="flex items-center w-full h-12 bg-bg-secondary rounded-lg px-4 gap-3 text-text-muted cursor-text transition-colors active:bg-bg-card-hover"
        onClick={() => setIsOpen(true)}
      >
        <Search className="h-5 w-5" />
        <span className="flex-1 text-left text-sm font-medium">Search stocks...</span>
      </div>

      {/* Fullscreen Search Modal for Mobile */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-bg-primary flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150 ease-out">
          {/* Header */}
          <div className="flex items-center h-14 px-4 border-b border-border-subtle shrink-0">
            <div className="flex-1 flex items-center bg-bg-secondary rounded-lg h-10 px-3 gap-2">
              <Search className="h-4 w-4 text-text-muted shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search by symbol..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent border-none outline-none flex-1 text-sm text-text-primary placeholder:text-text-muted"
              />
              {query && (
                <button 
                  onClick={() => setQuery('')}
                  className="p-1 rounded-full hover:bg-bg-primary shrink-0"
                >
                  <X className="h-4 w-4 text-text-muted" />
                </button>
              )}
            </div>
            <button 
              className="ml-4 text-sm font-medium text-accent shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => {
                setIsOpen(false);
                setQuery('');
              }}
            >
              Cancel
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-2">
            {!query ? (
              // Recent Searches
              recentSearches.length > 0 && (
                <div className="py-2">
                  <h3 className="px-3 pb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Recent Searches
                  </h3>
                  <div className="flex flex-col">
                    {recentSearches.map((symbol) => (
                      <button
                        key={symbol}
                        onClick={() => handleSelect(symbol)}
                        className="flex items-center px-3 py-3 rounded-md hover:bg-bg-secondary active:bg-bg-card-hover transition-colors text-left"
                      >
                        <Clock className="h-4 w-4 text-text-muted mr-3 shrink-0" />
                        <span className="flex-1 text-sm font-medium text-text-primary">{symbol}</span>
                        {!symbols.includes(symbol) && (
                          <Plus className="h-4 w-4 text-accent shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : (
              // Results
              <div className="py-2">
                {results.length > 0 ? (
                  <div className="flex flex-col">
                    {results.map((symbol) => {
                      const isAdded = symbols.includes(symbol);
                      return (
                        <button
                          key={symbol}
                          onClick={() => handleSelect(symbol)}
                          disabled={isAdded}
                          className={cn(
                            "flex items-center justify-between px-3 py-4 rounded-md transition-colors text-left",
                            isAdded ? "opacity-50" : "hover:bg-bg-secondary active:bg-bg-card-hover"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-text-primary">{symbol}</span>
                            <span className="text-xs text-text-tertiary mt-0.5">NSE</span>
                          </div>
                          {!isAdded ? (
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-accent/10 text-accent">
                              <Plus className="h-4 w-4" />
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-text-muted">Added</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-text-secondary">
                    No results found for "{query}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
