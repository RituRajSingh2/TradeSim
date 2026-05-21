import { create } from 'zustand';

interface MarketState {
  /** Symbols currently being tracked (for non-realtime metadata) */
  subscribedSymbols: Set<string>;
  /** Whether market is open */
  isMarketOpen: boolean;

  addSubscription: (symbol: string) => void;
  removeSubscription: (symbol: string) => void;
  setMarketOpen: (isOpen: boolean) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  subscribedSymbols: new Set(),
  isMarketOpen: false,

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
}));
