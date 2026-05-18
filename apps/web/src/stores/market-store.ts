import { create } from 'zustand';
import type { StockQuote } from '@tradesim/shared';

interface MarketState {
  /** Map of symbol → latest quote */
  quotes: Map<string, StockQuote>;
  /** Symbols currently being tracked */
  subscribedSymbols: Set<string>;
  /** Whether market is open */
  isMarketOpen: boolean;

  updateQuote: (quote: StockQuote) => void;
  updateQuotes: (quotes: StockQuote[]) => void;
  addSubscription: (symbol: string) => void;
  removeSubscription: (symbol: string) => void;
  setMarketOpen: (isOpen: boolean) => void;
  getQuote: (symbol: string) => StockQuote | undefined;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  quotes: new Map(),
  subscribedSymbols: new Set(),
  isMarketOpen: false,

  updateQuote: (quote) =>
    set((state) => {
      const newQuotes = new Map(state.quotes);
      newQuotes.set(quote.symbol, quote);
      return { quotes: newQuotes };
    }),

  updateQuotes: (quotes) =>
    set((state) => {
      const newQuotes = new Map(state.quotes);
      quotes.forEach((q) => newQuotes.set(q.symbol, q));
      return { quotes: newQuotes };
    }),

  addSubscription: (symbol) =>
    set((state) => {
      const newSubs = new Set(state.subscribedSymbols);
      newSubs.add(symbol);
      return { subscribedSymbols: newSubs };
    }),

  removeSubscription: (symbol) =>
    set((state) => {
      const newSubs = new Set(state.subscribedSymbols);
      newSubs.delete(symbol);
      return { subscribedSymbols: newSubs };
    }),

  setMarketOpen: (isMarketOpen) => set({ isMarketOpen }),

  getQuote: (symbol) => get().quotes.get(symbol),
}));
