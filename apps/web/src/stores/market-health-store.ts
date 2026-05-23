import { create } from 'zustand';
import { Staleness, getWorstStaleness, STALENESS_PRIORITY } from '@tradesim/shared';

interface MarketHealthState {
  /** The most degraded staleness tier across all subscriptions */
  globalStaleness: Staleness;
  /** Whether ANY active subscription is currently driven by a mock provider */
  isSimulated: boolean;

  /** 
   * Push an aggregated tick health state into the store.
   * Degraded states activate immediately.
   * Recovery to a healthier state is debounced/hysteresis protected.
   */
  updateHealth: (staleness: Staleness, isMock: boolean) => void;
  
  // Internal state for hysteresis
  _recoveryTimer: NodeJS.Timeout | null;
  _pendingRecoveryStaleness: Staleness | null;
}

const RECOVERY_DEBOUNCE_MS = 3000; // 3 seconds of stable healthy ticks required to recover

export const useMarketHealthStore = create<MarketHealthState>((set, get) => ({
  globalStaleness: 'fresh',
  isSimulated: false,

  _recoveryTimer: null,
  _pendingRecoveryStaleness: null,

  updateHealth: (newStaleness, newIsMock) => {
    const state = get();
    const currentStaleness = state.globalStaleness;
    const currentIsSimulated = state.isSimulated;

    // Is the new state worse or the same?
    const isDegradingOrSame = 
      STALENESS_PRIORITY[newStaleness] >= STALENESS_PRIORITY[currentStaleness];

    let nextStaleness = currentStaleness;
    let nextTimer = state._recoveryTimer;
    let nextPending = state._pendingRecoveryStaleness;

    if (isDegradingOrSame) {
      // Immediate degradation (or staying at same severity)
      nextStaleness = newStaleness;
      // Clear any pending recovery since we degraded again
      if (nextTimer) {
        clearTimeout(nextTimer);
        nextTimer = null;
      }
      nextPending = null;
    } else {
      // Trying to recover (new state is better than current)
      if (nextPending !== newStaleness) {
        // Start or restart the recovery timer for this specific target state
        if (nextTimer) {
          clearTimeout(nextTimer);
        }
        nextPending = newStaleness;
        nextTimer = setTimeout(() => {
          set({ 
            globalStaleness: newStaleness, 
            _recoveryTimer: null, 
            _pendingRecoveryStaleness: null 
          });
        }, RECOVERY_DEBOUNCE_MS);
      }
      // Keep currentStaleness as-is until timer fires
    }

    // Apply simulation flag immediately (usually doesn't flicker, mock is stable fallback)
    const shouldUpdate = 
      nextStaleness !== currentStaleness || 
      newIsMock !== currentIsSimulated ||
      nextTimer !== state._recoveryTimer ||
      nextPending !== state._pendingRecoveryStaleness;

    if (shouldUpdate) {
      set({
        globalStaleness: nextStaleness,
        isSimulated: newIsMock,
        _recoveryTimer: nextTimer,
        _pendingRecoveryStaleness: nextPending,
      });
    }
  },
}));
