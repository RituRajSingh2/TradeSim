import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

// ============================================================
// Subscription Manager — Symbol Reference Counting
//
// Tracks which clients are watching which symbols.
// Controls upstream polling: only fetch prices for symbols
// that at least one client is watching.
//
// Memory per client: ~200 bytes (Set of max 30 symbol strings)
// Memory per 1000 clients: ~2.4 MB total (trivial)
// ============================================================

const MAX_SUBSCRIPTIONS_PER_CLIENT = 30;

@Injectable()
export class SubscriptionManager implements OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionManager.name);

  /** symbol → Set<clientId> — who's watching each symbol */
  private readonly symbolRefs = new Map<string, Set<string>>();

  /** clientId → Set<symbol> — what each client is watching */
  private readonly clientSymbols = new Map<string, Set<string>>();

  /** Callbacks for when a symbol's first/last subscriber appears/leaves */
  private onFirstSubscriber?: (symbol: string) => void;
  private onLastUnsubscriber?: (symbol: string) => void;

  /**
   * Register callbacks for polling lifecycle.
   * Called by PriceBroadcaster to start/stop polling.
   */
  setCallbacks(
    onFirst: (symbol: string) => void,
    onLast: (symbol: string) => void,
  ) {
    this.onFirstSubscriber = onFirst;
    this.onLastUnsubscriber = onLast;
  }

  /**
   * Register a new client connection.
   */
  registerClient(clientId: string) {
    this.clientSymbols.set(clientId, new Set());
  }

  /**
   * Subscribe a client to a symbol. Idempotent.
   * Returns true if this was the first subscriber (polling should start).
   */
  subscribe(clientId: string, symbol: string): boolean {
    // Enforce per-client limit
    const clientSubs = this.clientSymbols.get(clientId);
    if (!clientSubs) return false;

    if (clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CLIENT) {
      this.logger.warn(
        `Client ${clientId} hit max subscription limit (${MAX_SUBSCRIPTIONS_PER_CLIENT})`,
      );
      return false;
    }

    // Add to client's set (idempotent — Set ignores duplicates)
    clientSubs.add(symbol);

    // Add to symbol's ref set
    let refs = this.symbolRefs.get(symbol);
    if (!refs) {
      refs = new Set();
      this.symbolRefs.set(symbol, refs);
    }

    const isFirst = refs.size === 0;
    refs.add(clientId);

    if (isFirst) {
      this.logger.debug(`First subscriber for ${symbol} — starting poll`);
      this.onFirstSubscriber?.(symbol);
    }

    return isFirst;
  }

  /**
   * Unsubscribe a client from a symbol.
   * Returns true if this was the last subscriber (polling should stop).
   */
  unsubscribe(clientId: string, symbol: string): boolean {
    const clientSubs = this.clientSymbols.get(clientId);
    if (clientSubs) {
      clientSubs.delete(symbol);
    }

    const refs = this.symbolRefs.get(symbol);
    if (!refs) return false;

    refs.delete(clientId);

    if (refs.size === 0) {
      this.symbolRefs.delete(symbol);
      this.logger.debug(`Last subscriber left ${symbol} — stopping poll`);
      this.onLastUnsubscriber?.(symbol);
      return true;
    }

    return false;
  }

  /**
   * Full cleanup when a client disconnects.
   * Decrements ref count for every symbol they were watching.
   */
  disconnectClient(clientId: string) {
    const symbols = this.clientSymbols.get(clientId);
    if (symbols) {
      for (const symbol of symbols) {
        this.unsubscribe(clientId, symbol);
      }
    }
    this.clientSymbols.delete(clientId);
  }

  /**
   * Get all symbols that have at least one subscriber.
   */
  getActiveSymbols(): string[] {
    return Array.from(this.symbolRefs.keys());
  }

  /**
   * Get subscriber count for a symbol.
   */
  getRefCount(symbol: string): number {
    return this.symbolRefs.get(symbol)?.size || 0;
  }

  /**
   * Get all symbols a specific client is watching.
   */
  getClientSymbols(clientId: string): Set<string> {
    return this.clientSymbols.get(clientId) || new Set();
  }

  /**
   * Get total number of connected clients.
   */
  getClientCount(): number {
    return this.clientSymbols.size;
  }

  onModuleDestroy() {
    this.symbolRefs.clear();
    this.clientSymbols.clear();
    this.logger.log('Subscription manager cleaned up');
  }
}
