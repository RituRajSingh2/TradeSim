import { WS_EVENTS } from '@tradesim/shared';
import { socketManager } from '../socket-client';

class SubscriptionManager {
  // Reference counting for individual stock subscriptions
  private stockRefs = new Map<string, number>();
  
  // Reference counting for watchlist symbols
  private watchlistRefs = new Map<string, number>();
  
  // To prevent rapid subscribe/unsubscribe thrashing when scrolling fast
  private debounceTimeouts = new Map<string, NodeJS.Timeout>();

  private isTabHidden = false;

  constructor() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
      this.isTabHidden = document.hidden;
    }
  }

  private handleVisibilityChange() {
    this.isTabHidden = document.hidden;
    if (this.isTabHidden) {
      // Degrade connection to paused mode when tab is hidden
      socketManager.getSocket()?.emit(WS_EVENTS.SUBSCRIBE_PAUSE);
    } else {
      socketManager.getSocket()?.emit(WS_EVENTS.SUBSCRIBE_RESUME);
      // Optional: Ask for a forced snapshot update on resume if needed.
    }
  }

  // --- Single Stock (Chart/Ticker) --- //

  public subscribeStock(symbol: string) {
    const current = this.stockRefs.get(symbol) || 0;
    this.stockRefs.set(symbol, current + 1);

    if (current === 0) {
      this.clearDebounce(`stock:${symbol}`);
      socketManager.subscribeStock(symbol);
    }
  }

  public unsubscribeStock(symbol: string) {
    const current = this.stockRefs.get(symbol) || 0;
    if (current <= 1) {
      this.stockRefs.delete(symbol);
      
      // Debounce the unsubscribe by 2 seconds to prevent thrashing
      // if the user is just navigating quickly
      const timeoutId = setTimeout(() => {
        socketManager.unsubscribeStock(symbol);
        this.debounceTimeouts.delete(`stock:${symbol}`);
      }, 2000);
      
      this.debounceTimeouts.set(`stock:${symbol}`, timeoutId);
    } else {
      this.stockRefs.set(symbol, current - 1);
    }
  }

  // --- Watchlist --- //

  public subscribeWatchlistSymbol(symbol: string) {
    const current = this.watchlistRefs.get(symbol) || 0;
    this.watchlistRefs.set(symbol, current + 1);

    if (current === 0) {
      this.clearDebounce('watchlist');
      this.syncWatchlist();
    }
  }

  public unsubscribeWatchlistSymbol(symbol: string) {
    const current = this.watchlistRefs.get(symbol) || 0;
    if (current <= 1) {
      this.watchlistRefs.delete(symbol);
      
      // Debounce the watchlist sync by 2 seconds
      const timeoutId = setTimeout(() => {
        this.syncWatchlist();
        this.debounceTimeouts.delete('watchlist');
      }, 2000);
      
      this.debounceTimeouts.set('watchlist', timeoutId);
    } else {
      this.watchlistRefs.set(symbol, current - 1);
    }
  }

  private syncWatchlist() {
    const symbols = Array.from(this.watchlistRefs.keys());
    if (symbols.length > 0) {
      socketManager.getSocket()?.emit(WS_EVENTS.SUBSCRIBE_WATCHLIST, { symbols });
    } else {
      socketManager.getSocket()?.emit(WS_EVENTS.UNSUBSCRIBE_WATCHLIST);
    }
  }

  private clearDebounce(key: string) {
    const existing = this.debounceTimeouts.get(key);
    if (existing) {
      clearTimeout(existing);
      this.debounceTimeouts.delete(key);
    }
  }
}

export const subscriptionManager = new SubscriptionManager();
