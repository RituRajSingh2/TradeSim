'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Clock, TrendingUp, ArrowRight, Plus, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWatchlistStore } from '@/stores/watchlist-store';
import { searchSymbols, TRENDING_SYMBOLS, SYMBOL_MASTER, type SearchResult, type SymbolEntry } from '@/lib/symbol-master';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { cn } from '@/lib/utils';

// ---- Inline helper: look up entry from master ----
function getEntry(symbol: string): SymbolEntry | undefined {
  return SYMBOL_MASTER.find(e => e.symbol === symbol);
}

// ---- Result Row ----
interface SymbolRowProps {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  matchType?: SearchResult['matchType'];
  isAdded: boolean;
  onClick: () => void;
}

function SymbolRow({ symbol, name, exchange, sector, isAdded, onClick }: SymbolRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={isAdded}
      className={cn(
        'flex items-center justify-between w-full px-4 py-3.5 text-left',
        'transition-colors duration-100',
        isAdded
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-bg-secondary active:bg-bg-card-hover'
      )}
    >
      <div className="flex flex-col min-w-0 gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-text-primary tracking-tight">{symbol}</span>
          <span className="text-[10px] font-semibold text-text-tertiary bg-bg-secondary px-1.5 py-0.5 rounded uppercase">
            {exchange}
          </span>
        </div>
        <span className="text-xs text-text-secondary truncate pr-4">{name}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {sector && (
          <span className="hidden xs:block text-[10px] text-text-tertiary max-w-[80px] truncate text-right">
            {sector}
          </span>
        )}
        {isAdded ? (
          <span className="flex items-center justify-center h-8 w-8 rounded-full bg-positive/10 text-positive shrink-0">
            <Check className="h-4 w-4" />
          </span>
        ) : (
          <span className="flex items-center justify-center h-8 w-8 rounded-full bg-accent/10 text-accent shrink-0">
            <Plus className="h-4 w-4" />
          </span>
        )}
      </div>
    </button>
  );
}

// ---- Section Header ----
function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      <span className="text-text-tertiary">{icon}</span>
      <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ---- Main SymbolSearch ----
export function SymbolSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 80); // 80ms debounce — feels instant
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { symbols, recentSearches, addSymbol, addRecentSearch } = useWatchlistStore();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Delay slightly to allow CSS paint before focus
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function close() {
    setIsOpen(false);
    setQuery('');
  }

  const handleSelect = useCallback((symbol: string) => {
    addSymbol(symbol);
    addRecentSearch(symbol);
    close();
  }, [addSymbol, addRecentSearch]);

  const handleTrade = useCallback((symbol: string) => {
    addRecentSearch(symbol);
    close();
    router.push(`/trade/${symbol}`);
  }, [addRecentSearch, router]);

  // ---- Compute results purely from in-memory index ----
  const results: SearchResult[] = debouncedQuery.trim().length >= 1
    ? searchSymbols(debouncedQuery, 12)
    : [];

  const trendingEntries = TRENDING_SYMBOLS.map(getEntry).filter(Boolean) as SymbolEntry[];

  return (
    <>
      {/* ---- Search Trigger Bar ---- */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center w-full h-12 bg-bg-secondary rounded-xl px-4 gap-3 text-text-muted
                   transition-colors duration-100 active:bg-bg-card-hover hover:bg-bg-secondary/80
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-label="Search stocks"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left text-sm text-text-muted">Search stocks, companies...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border-subtle bg-bg-primary px-1.5 text-[10px] text-text-tertiary font-mono">
          /
        </kbd>
      </button>

      {/* ---- Fullscreen Search Overlay ---- */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-bg-primary flex flex-col"
          style={{ opacity: 1 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border-subtle shrink-0">
            <div className="flex-1 flex items-center bg-bg-secondary rounded-xl h-11 px-3 gap-2.5">
              <Search className="h-4 w-4 text-text-muted shrink-0" />
              <input
                ref={inputRef}
                type="search"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="RELIANCE, Infosys, SBI..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent border-none outline-none flex-1 text-sm text-text-primary placeholder:text-text-muted caret-accent"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 rounded-full hover:bg-bg-primary shrink-0 text-text-muted"
                  aria-label="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={close}
              className="shrink-0 text-sm font-semibold text-accent min-h-[44px] min-w-[52px] flex items-center justify-center"
            >
              Cancel
            </button>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {!query.trim() ? (
              /* ---- Empty Query: Show recents + trending ---- */
              <div className="pb-8">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <section>
                    <SectionHeader
                      icon={<Clock className="h-3.5 w-3.5" />}
                      label="Recent"
                    />
                    <div className="flex flex-col">
                      {recentSearches.map((sym) => {
                        const entry = getEntry(sym);
                        return (
                          <SymbolRow
                            key={sym}
                            symbol={sym}
                            name={entry?.name ?? sym}
                            exchange={entry?.exchange ?? 'NSE'}
                            sector={entry?.sector ?? ''}
                            isAdded={symbols.includes(sym)}
                            onClick={() => handleSelect(sym)}
                          />
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Trending */}
                <section>
                  <SectionHeader
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                    label="Trending"
                  />
                  <div className="flex flex-col">
                    {trendingEntries.map((entry) => (
                      <SymbolRow
                        key={entry.symbol}
                        symbol={entry.symbol}
                        name={entry.name}
                        exchange={entry.exchange}
                        sector={entry.sector}
                        isAdded={symbols.includes(entry.symbol)}
                        onClick={() => handleSelect(entry.symbol)}
                      />
                    ))}
                  </div>
                </section>
              </div>
            ) : results.length > 0 ? (
              /* ---- Search Results ---- */
              <div className="pb-8">
                <div className="flex flex-col divide-y divide-border-subtle/50">
                  {results.map((result) => {
                    const isAdded = symbols.includes(result.symbol);
                    return (
                      <div key={result.symbol} className="flex items-stretch">
                        {/* Add to watchlist */}
                        <div className="flex-1">
                          <SymbolRow
                            symbol={result.symbol}
                            name={result.name}
                            exchange={result.exchange}
                            sector={result.sector}
                            matchType={result.matchType}
                            isAdded={isAdded}
                            onClick={() => handleSelect(result.symbol)}
                          />
                        </div>

                        {/* Quick Trade CTA */}
                        <button
                          onClick={() => handleTrade(result.symbol)}
                          className="flex items-center gap-1 pr-4 pl-2 text-xs font-semibold text-accent
                                     hover:bg-accent/5 active:bg-accent/10 transition-colors duration-100
                                     border-l border-border-subtle/50 shrink-0"
                          aria-label={`Trade ${result.symbol}`}
                        >
                          Trade
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ---- No Results ---- */
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="h-12 w-12 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
                  <Search className="h-5 w-5 text-text-tertiary" />
                </div>
                <p className="text-sm font-semibold text-text-primary mb-1">
                  No results for &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-text-secondary">
                  Try the NSE ticker symbol (e.g. RELIANCE, TCS)
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
