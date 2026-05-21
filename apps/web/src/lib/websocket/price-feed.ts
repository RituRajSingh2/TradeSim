import { WsStockPricePayload, WsWatchlistPricesPayload, WsChartCandlePayload } from '@tradesim/shared';
import { socketManager } from '../socket-client';

export interface PriceFeedData {
  quote?: WsStockPricePayload;
  version: number;
}

export type PriceFeedListener = (data: PriceFeedData) => void;

class PriceFeed {
  private cache = new Map<string, PriceFeedData>();
  private listeners = new Map<string, Set<PriceFeedListener>>();

  // Maximum symbols to cache (LRU eviction strategy)
  private MAX_CACHE_SIZE = 500;

  constructor() {
    // Bind to socket events globally
    socketManager.onStockPrice(this.handleStockPrice.bind(this));
    socketManager.onWatchlistPrices(this.handleWatchlistPrices.bind(this));
  }

  private incrementVersion(symbol: string, newData: WsStockPricePayload) {
    const existing = this.cache.get(symbol);
    
    // Simple deduplication/stale check based on timestamp or identical ltp/volume if needed
    // For now, if we get a payload, we update. In reality we might check `existing.quote.timestamp < newData.timestamp`
    
    const newVersion = existing ? existing.version + 1 : 1;
    this.cache.set(symbol, { quote: newData, version: newVersion });
    
    this.enforceCacheLimit();
    this.notifyListeners(symbol);
  }

  private handleStockPrice(payload: WsStockPricePayload) {
    this.incrementVersion(payload.symbol, payload);
  }

  private handleWatchlistPrices(payload: WsWatchlistPricesPayload) {
    // Both snapshot and delta have an array of prices
    for (const item of payload.prices) {
      const existing = this.cache.get(item.symbol);
      // We only have WsWatchlistPriceItem here, which is a partial quote.
      // We should merge it carefully.
      const currentQuote = existing?.quote || {} as Partial<WsStockPricePayload>;
      
      const updatedQuote: WsStockPricePayload = {
        ...currentQuote,
        symbol: item.symbol,
        ltp: item.ltp,
        change: item.change,
        changePercent: item.changePercent,
        // Fallbacks for fields not in WatchlistPriceItem
        open: currentQuote.open ?? 0,
        high: currentQuote.high ?? 0,
        low: currentQuote.low ?? 0,
        close: currentQuote.close ?? 0,
        volume: currentQuote.volume ?? 0,
        timestamp: Date.now(), // Estimate timestamp
      };

      this.incrementVersion(item.symbol, updatedQuote);
    }
  }

  private notifyListeners(symbol: string) {
    const symbolListeners = this.listeners.get(symbol);
    if (symbolListeners && symbolListeners.size > 0) {
      const data = this.cache.get(symbol);
      if (data) {
        symbolListeners.forEach(listener => listener(data));
      }
    }
  }

  private enforceCacheLimit() {
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      // LRU logic: find a symbol with no active listeners to evict
      for (const [symbol, _] of this.cache.entries()) {
        const activeListeners = this.listeners.get(symbol)?.size || 0;
        if (activeListeners === 0) {
          this.cache.delete(symbol);
          if (this.cache.size <= this.MAX_CACHE_SIZE) break;
        }
      }
    }
  }

  // ---- Public API ---- //

  public getPrice(symbol: string): PriceFeedData | undefined {
    return this.cache.get(symbol);
  }

  public subscribe(symbol: string, listener: PriceFeedListener): () => void {
    if (!this.listeners.has(symbol)) {
      this.listeners.set(symbol, new Set());
    }
    this.listeners.get(symbol)!.add(listener);

    // Call immediately with cached data if available
    const cachedData = this.cache.get(symbol);
    if (cachedData) {
      listener(cachedData);
    }

    return () => {
      this.unsubscribe(symbol, listener);
    };
  }

  public unsubscribe(symbol: string, listener: PriceFeedListener) {
    const symbolListeners = this.listeners.get(symbol);
    if (symbolListeners) {
      symbolListeners.delete(listener);
      if (symbolListeners.size === 0) {
        this.listeners.delete(symbol);
      }
    }
  }
}

export const priceFeed = new PriceFeed();
