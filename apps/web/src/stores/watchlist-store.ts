import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WatchlistState {
  symbols: string[];
  recentSearches: string[];
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  addRecentSearch: (symbol: string) => void;
  clearRecentSearches: () => void;
  initializeStarterWatchlistIfEmpty: () => void;
}

// Initial defaults for a beta user
const DEFAULT_SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY'];

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      symbols: DEFAULT_SYMBOLS,
      recentSearches: [],

      addSymbol: (symbol) => {
        const current = get().symbols;
        if (!current.includes(symbol)) {
          set({ symbols: [...current, symbol] });
        }
      },

      removeSymbol: (symbol) => {
        set({
          symbols: get().symbols.filter((s) => s !== symbol),
        });
      },

      addRecentSearch: (symbol) => {
        set((state) => {
          const filtered = state.recentSearches.filter((s) => s !== symbol);
          // Keep max 5 recent searches
          return {
            recentSearches: [symbol, ...filtered].slice(0, 5),
          };
        });
      },

      clearRecentSearches: () => {
        set({ recentSearches: [] });
      },

      initializeStarterWatchlistIfEmpty: () => {
        const { symbols } = get();
        if (symbols.length === 0) {
          set({ symbols: DEFAULT_SYMBOLS });
        }
      },
    }),
    {
      name: 'tradesim-watchlist-storage', // key in local storage
    }
  )
);
