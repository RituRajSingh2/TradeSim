import { create } from 'zustand';

interface TickHistoryState {
  // Keyed by symbol, stores an array of recent prices (LTP)
  ticks: Record<string, number[]>;
  
  // Adds a new tick for a symbol, maintaining a bounded history size
  addTick: (symbol: string, ltp: number) => void;
}

const MAX_TICKS = 20;

export const useTickHistoryStore = create<TickHistoryState>((set) => ({
  ticks: {},
  addTick: (symbol, ltp) => set((state) => {
    const existing = state.ticks[symbol] || [];
    
    // Simple deduplication: don't add identical consecutive ticks
    if (existing.length > 0 && existing[existing.length - 1] === ltp) {
      return state;
    }

    const nextTicks = [...existing, ltp];
    
    // Ring buffer behavior
    if (nextTicks.length > MAX_TICKS) {
      nextTicks.shift();
    }

    return {
      ticks: {
        ...state.ticks,
        [symbol]: nextTicks
      }
    };
  })
}));
